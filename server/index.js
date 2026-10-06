import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TTLCache } from './cache.js';
import { fetchStreamList, fetchTokenPage, fetchUpstream, isStreamAlive } from './upstream.js';
import { fetchSportbetData, matchSportbet } from './sportbet.js';
import { fillMissingStarts } from './tsdb.js';
import { enrichBadgesAndReferees } from './badges.js';
import { ViewerTracker } from './viewers.js';
import { generateCover } from './cover.js';
import { aiOrFallbackCover } from './cover-ai.js';

const PORT = Number(process.env.PORT || 3000);
const STREAM_API_URL = process.env.STREAM_API_URL || 'https://api-prime.player-us.xyz/stream-list-v2/';
const CACHE_TTL = Number(process.env.STREAM_CACHE_TTL || 300) * 1000;

const app = express();
app.disable('x-powered-by');

const cache = new TTLCache(CACHE_TTL);
const playlistCache = new TTLCache(4000); // micro-cache: hls.js hammers this endpoint
const viewers = new ViewerTracker(60000);
let refreshing = false;

// ---------- payload builders ----------

function buildPayload(raw) {
  const sportsOut = {};
  let total = 0;
  for (const [key, val] of Object.entries(raw || {})) {
    const evList = Object.values(val.events || {}).map((e) => ({
      stream_id: e.stream_id,
      sport: e.sport,
      sport_key: key,
      league: e.league,
      home: e.competitiors?.home || '',
      away: e.competitiors?.away || '',
    }));
    if (!evList.length) continue;
    sportsOut[key] = { count: evList.length, events: evList };
    total += evList.length;
  }
  return { sports: sportsOut, total, updated_at: Date.now() };
}

function classifyAndCover(payload) {
  const now = Date.now();
  for (const [, v] of Object.entries(payload.sports)) {
    for (const e of v.events || []) {
      if (!e.status) {
        e.status = e.start
          ? (new Date(e.start).getTime() > now ? 'upcoming' : (e.live ? 'live' : 'unknown'))
          : 'unknown';
      }
      e.cover = generateCover(e);
    }
  }
  // AI kapakları arka planda doldurulur; ilk yanıtta fallback, sonra AI versiyonu geçer
  aiFillCovers(payload);
  return payload;
}

// AI + badge üretiminde KAYIT: üretilen değerler stream_id -> alan haritasında tutulur,
// her fullRefresh yeni event objeleri ürettiği için önceki oturumda üretilenler geri yüklenir.
const persisted = new Map(); // streamId -> { ai_cover, home_badge, away_badge, referee }

function restorePersisted(payload) {
  for (const [, v] of Object.entries(payload.sports)) {
    for (const e of v.events || []) {
      const p = persisted.get(String(e.stream_id));
      if (p) {
        if (p.ai_cover && !e.ai_cover) e.ai_cover = p.ai_cover;
        if (p.home_badge && !e.home_badge) e.home_badge = p.home_badge;
        if (p.away_badge && !e.away_badge) e.away_badge = p.away_badge;
        if (p.referee && !e.referee) e.referee = p.referee;
      }
    }
  }
}

function savePersisted(payload) {
  for (const [, v] of Object.entries(payload.sports)) {
    for (const e of v.events || []) {
      persisted.set(String(e.stream_id), {
        ai_cover: e.ai_cover || null,
        home_badge: e.home_badge || null,
        away_badge: e.away_badge || null,
        referee: e.referee || null,
      });
    }
  }
}

async function aiFillCovers(payload) {
  const pending = [];
  for (const [, v] of Object.entries(payload.sports)) {
    for (const e of v.events || []) {
      if (!e.ai_cover) pending.push(e);
    }
  }
  if (!pending.length) return;
  const CONC = 3;
  let i = 0;
  async function worker() {
    while (i < pending.length) {
      const e = pending[i++];
      e.ai_cover = await aiOrFallbackCover(e);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  savePersisted(payload);
  console.log('[ai-cover] üretildi:', pending.length);
}

function attachViewers(payload) {
  for (const [, v] of Object.entries(payload.sports || {})) {
    for (const e of v.events || []) e.viewers = viewers.count(e.stream_id);
  }
  payload.fetched_at = Date.now();
  return payload;
}

function filterPayload(base, sport, q) {
  const sportsOut = {};
  let total = 0;
  for (const [key, val] of Object.entries(base.sports || {})) {
    if (sport && key !== sport) continue;
    const events = q
      ? (val.events || []).filter((e) => `${e.league} ${e.home} ${e.away}`.toLowerCase().includes(q))
      : (val.events || []);
    if (!events.length) continue;
    sportsOut[key] = { count: events.length, events };
    total += events.length;
  }
  return {
    sports: sportsOut,
    total,
    live_total: Object.values(sportsOut).reduce((a, v) => a + v.events.filter((e) => e.status === 'live').length, 0),
    upcoming_total: Object.values(sportsOut).reduce((a, v) => a + v.events.filter((e) => e.status === 'upcoming').length, 0),
    updated_at: Date.now(),
  };
}

// ---------- background refresh (never blocks requests) ----------

async function fullRefresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const listResp = await fetchStreamList();
    let payload = buildPayload(listResp.sports || {});
    payload.source = listResp.source;

    try {
      const sb = await fetchSportbetData();
      const { enriched, dead } = matchSportbet(payload.sports, sb);
      for (const [, v] of Object.entries(payload.sports)) {
        v.events = (v.events || []).filter((e) => !dead.has(e.stream_id));
        for (const e of v.events) {
          if (enriched[e.stream_id]) Object.assign(e, enriched[e.stream_id]);
        }
      }
    } catch (e) { console.error('[sportbet]', e.message); }

    try {
      const filled = await fillMissingStarts(payload.sports);
      if (filled) console.log('[tsdb] filled:', filled);
    } catch (e) { console.error('[tsdb]', e.message); }

    // takım logoları + hakem (bütçeli, cache'li)
    try {
      const n = await enrichBadgesAndReferees(payload.sports, 40);
      console.log('[badges] doldurulan:', n);
      savePersisted(payload);
    } catch (e) { console.error('[badges]', e.message); }

    classifyAndCover(payload);
    restorePersisted(payload);
    for (const [k, v] of Object.entries(payload.sports)) {
      if (!v.events.length) delete payload.sports[k];
    }
    payload.total = Object.values(payload.sports).reduce((a, v) => a + v.events.length, 0);
    payload.live_total = Object.values(payload.sports).reduce((a, v) => a + v.events.filter((e) => e.status === 'live').length, 0);
    payload.upcoming_total = Object.values(payload.sports).reduce((a, v) => a + v.events.filter((e) => e.status === 'upcoming').length, 0);
    cache.set('streams:base', payload);
    cache.set('streams:base:shown', payload);
    console.log('[streams] refreshed:', payload.total, 'events');
  } catch (err) {
    console.error('[streams] refresh failed:', err.message);
  } finally {
    refreshing = false;
  }
}

// cold start: list only (fast), full enrichment follows in background
async function lightLoad() {
  const listResp = await fetchStreamList();
  const payload = buildPayload(listResp.sports || {});
  payload.source = listResp.source;
  const now = Date.now();
  for (const [, v] of Object.entries(payload.sports)) {
    for (const e of v.events || []) {
      e.status = e.start && new Date(e.start).getTime() > now ? 'upcoming' : 'live';
      e.cover = generateCover(e);
    }
  }
  payload.total = Object.values(payload.sports).reduce((a, v) => a + v.events.length, 0);
  payload.upcoming_total = Object.values(payload.sports).reduce((a, v) => a + v.events.filter((e) => e.status === 'upcoming').length, 0);
  restorePersisted(payload);
  cache.set('streams:base', payload);
  cache.set('streams:base:shown', payload);
  return payload;
}

// ---------- routes ----------

// /api/streams — stale-while-revalidate; search filters the cached base instantly
app.get('/api/streams', async (req, res) => {
  const sport = (req.query.sport || '').toString().toLowerCase();
  const q = (req.query.q || '').toString().toLowerCase().trim();
  const isSearch = !!(q || sport);

  const hit = cache.get('streams:base');
  if (hit.hit) {
    const out = isSearch ? filterPayload(hit.value, sport, q) : hit.value;
    return res.json(attachViewers(out));
  }
  if (hit.stale) {
    if (!refreshing) fullRefresh();
    const out = isSearch ? filterPayload(hit.stale, sport, q) : hit.stale;
    return res.json({ ...attachViewers(out), stale: true });
  }
  try {
    const payload = await lightLoad();
    if (!refreshing) fullRefresh();
    const out = isSearch ? filterPayload(payload, sport, q) : payload;
    return res.json(attachViewers(out));
  } catch (err) {
    console.error('[streams] light load failed:', err.message);
    const stale = cache.get('streams:base:shown')?.value;
    if (stale) return res.json({ ...attachViewers(isSearch ? filterPayload(stale, sport, q) : stale), stale: true });
    return res.status(502).json({ error: 'upstream_unavailable', message: 'Yayın listesi alınamadı' });
  }
});

// /api/config — ad settings (NO secrets)
app.get('/api/config', (req, res) => {
  res.json({
    adMode: process.env.AD_MODE || 'off',
    adVideoUrl: process.env.AD_VIDEO_URL || '',
    adImageUrl: process.env.AD_IMAGE_URL || '',
    adLink: process.env.AD_LINK || '',
    adDuration: Number(process.env.AD_DURATION || 10),
    refreshInterval: 60000,
  });
});

// /api/stream/:id/playlist — real m3u8 content, URIs rewritten through our proxy
app.get('/api/stream/:id/playlist', async (req, res) => {
  const id = String(req.params.id).replace(/[^0-9]/g, '');
  if (!id) return res.status(400).json({ error: 'bad_id' });
  res.set('Access-Control-Allow-Origin', '*');
  const cached = playlistCache.get(id);
  if (cached.hit) {
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-store');
    return res.send(cached.value);
  }
  try {
    const m3u8Url = await fetchTokenPage(id);
    if (!m3u8Url) return res.status(404).json({ error: 'stream_not_found', message: 'Yayın şu an aktif değil.' });
    const buf = await fetchUpstream(m3u8Url);
    if (!buf) return res.status(502).json({ error: 'playlist_failed' });
    const text = buf.toString('utf8');
    if (!text.includes('#EXTM3U')) return res.status(502).json({ error: 'playlist_failed' });
    const rewritten = text.split('\n').map((line) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      const abs = new URL(t, m3u8Url).href;
      return `/api/stream/${id}/media?u=${encodeURIComponent(abs)}`;
    }).join('\n');
    playlistCache.set(id, rewritten);
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-store');
    res.send(rewritten);
  } catch (err) {
    console.error('[playlist]', err.message);
    const stale = playlistCache.get(id);
    if (stale.stale) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Cache-Control', 'no-store');
      return res.send(stale.stale);
    }
    res.status(502).json({ error: 'playlist_failed', message: 'Yayın açılamadı' });
  }
});

// /api/stream/:id/media — segment/key proxy (host allow-list)
app.get('/api/stream/:id/media', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const u = String(req.query.u || '');
  let target;
  try { target = new URL(u); } catch { return res.status(400).json({ error: 'bad_url' }); }
  const ok = /(^|\.)(n4154|player-us|gsplayer|akamaihd|tubi)\.(xyz|net|video)$/.test(target.hostname)
    || /(^|\.)(akamaihd\.net|tubi\.video)$/.test(target.hostname);
  if (!ok) return res.status(403).json({ error: 'host_not_allowed' });
  try {
    const buf = await fetchUpstream(target.toString());
    if (buf === null) return res.status(502).json({ error: 'media_failed' });
    const text = buf.toString('utf8');
    if (text.includes('#EXTM3U')) {
      const rewritten = text.split('\n').map((line) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return line;
        const abs = new URL(t, target).toString();
        return `/api/stream/${req.params.id}/media?u=${encodeURIComponent(abs)}`;
      }).join('\n');
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.send(rewritten);
    } else {
      res.set('Content-Type', 'application/octet-stream');
      res.send(buf);
    }
  } catch (err) {
    console.error('[media]', err.message);
    res.status(502).json({ error: 'media_failed', message: 'Segment alınamadı' });
  }
});

// Social-share previews (Telegram/WhatsApp/Facebook spiders) — per-match OG tags.
// Spiders don't run React, so /watch/:id must return real match data server-side.
const UA_SPIDER = /telegrambot|whatsapp|facebookexternalhit|twitterbot|slackbot|discordbot|embedly|vkshare|python-requests|curl|googlebot|bingbot|yandex/i;

async function matchFromCache(id) {
  const hit = cache.get('streams:base');
  const pool = hit.hit ? hit.value : hit.stale;
  if (!pool) return null;
  for (const [, v] of Object.entries(pool.sports || {})) {
    for (const e of v.events || []) {
      if (String(e.stream_id) === String(id)) return e;
    }
  }
  return null;
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

app.get('/watch/:id', async (req, res) => {
  const id = String(req.params.id).replace(/[^0-9]/g, '');
  if (!UA_SPIDER.test(req.headers['user-agent'] || '')) {
    return res.sendFile(path.join(DIST, 'index.html'), (err) => {
      if (err) res.status(404).send('Frontend build yok');
    });
  }
  let e = await matchFromCache(id);
  if (!e && !refreshing) await fullRefresh();
  if (!e) e = await matchFromCache(id);
  const teams = e?.away ? `${e.home} vs ${e.away}` : (e?.home || 'Canlı Yayın');
  const league = e?.league || 'Spor Yayını';
  let when = 'Canlı İzle';
  if (e?.start) {
    const ts = new Date(e.start);
    when = ts.getTime() > Date.now()
      ? `Başlangıç: ${ts.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} ${ts.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
      : 'Şu an canlı — İzle';
  }
  const title = `${teams} Canlı İzle | ${league} — MultiSportsHD`;
  const desc = e?.status === 'upcoming'
    ? `${teams} (${league}) — ${when}. MultiSportsHD ile HD kalitede canlı izle.`
    : `${teams} (${league}) — ${when}. MultiSportsHD ile HD kalitede canlı izle.`;
  const html = `<!DOCTYPE html><html lang="tr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="MultiSportsHD">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="https://multisportshd.com/watch/${esc(id)}">
<meta property="og:image" content="https://multisportshd.com/assets/og-logo.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="https://multisportshd.com/assets/og-logo.png">
<link rel="canonical" href="https://multisportshd.com/watch/${esc(id)}">
<meta http-equiv="refresh" content="0;url=/watch/${esc(id)}?s=1">
</head><body><p>${esc(title)} — ${esc(desc)}</p><p><a href="/watch/${esc(id)}?s=1">Yayına git</a></p></body></html>`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-cache');
  res.send(html);
});

// /api/stream/:id/cover — per-match generated SVG cover
app.get('/api/stream/:id/cover', (req, res) => {  const id = String(req.params.id);
  const home = (req.query.home || '').toString().slice(0, 40);
  const away = (req.query.away || '').toString().slice(0, 40);
  const league = (req.query.league || '').toString().slice(0, 60);
  const sport_key = (req.query.sport_key || '').toString();
  res.set('Content-Type', 'text/plain');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(generateCover({ stream_id: id, home, away, league, sport_key }));
});

// viewers: heartbeat + count
app.post('/api/stream/:id/viewers', (req, res) => {
  const id = String(req.params.id);
  viewers.ping(id, String(req.query.s || 'v'));
  res.json({ stream_id: id, viewers: viewers.count(id), ts: Date.now() });
});
app.get('/api/stream/:id/viewers', (req, res) => {
  const id = String(req.params.id);
  viewers.ping(id, String(req.query.s || 'v'));
  res.json({ stream_id: id, viewers: viewers.count(id), ts: Date.now() });
});

// static client + SPA fallback (last)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../client/dist');
app.use(express.static(DIST, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  },
}));
app.use((req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(DIST, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend build yok: `cd client && npm run build` çalıştırın.');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on :${PORT} | TTL=${CACHE_TTL / 1000}s`);
  fullRefresh(); // warm the enriched cache in background
  // periyodik yenileme: her 5 dakikada bir badges/referee/saatler tazelenir
  setInterval(() => { if (!refreshing) fullRefresh(); }, CACHE_TTL);
});
