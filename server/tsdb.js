// TheSportsDB (free key 3): match start times via per-match search — fallback for matches
// that sportbet1.one doesn't cover. Free tier is rate-limited (30 req/min, HTML when hit),
// so: results are CACHED in-process for TSDB_TTL (default 6h) and requests are throttled.

import { gate, isBlocked, block } from './tsdb-limiter.js';

const TSDB = 'https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=';
const cache = new Map(); // q -> { ts, value }
const TTL = Number(process.env.TSDB_TTL || 6 * 3600 * 1000);

async function tsdbLookup(home, away) {
  const cacheKey = `${home}|${away}`;
  const c = cache.get(cacheKey);
  if (c && Date.now() - c.ts < TTL) return c.value;
  if (isBlocked()) return null;
  // 1) önce "home_away_vs" tam formatı
  const q = `${home} vs ${away}`.replace(/\s+/g, '_');
  const tries = [q, home.replace(/\s+/g, '_')]; // sonra sadece home team
  for (const qq of tries) {
    await gate();
    try {
      const res = await fetch(TSDB + encodeURIComponent(qq), {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });
      const text = await res.text();
      if (text.trim().startsWith('<') || res.status === 429) { block(120 * 1000); return null; }
      const j = JSON.parse(text);
      const evs = j?.event || [];
      if (!evs.length) continue;
      // hem home hem away geçen maçı ara; yoksa home team'in en yakın tarihli maçını al
      const nh = norm(home), na = norm(away);
      const exact = evs.find((e) => {
        const t = `${e.strHomeTeam || ''} ${e.strAwayTeam || ''}`.toLowerCase();
        return t.includes(nh) && t.includes(na);
      });
      const pick = exact || evs[0];
      const val = pick?.strTimestamp || null;
      cache.set(cacheKey, { ts: Date.now(), value: val });
      return val;
    } catch { continue; }
  }
  return null;
}

function norm(s) {
  return (s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]/g, ' ').trim();
}

// Fill missing `start` fields in-place. Budget caps how many upstream calls we make per refresh.
export async function fillMissingStarts(sportsOut, budget = 40) {
  const targets = [];
  for (const v of Object.values(sportsOut || {})) {
    for (const e of v.events || []) {
      if (!e.start) targets.push(e);
    }
  }
  targets.sort((a, b) => String(a.home).localeCompare(String(b.home)));
  const slice = targets.slice(0, budget);
  let i = 0;
  async function worker() {
    while (i < slice.length) {
      const e = slice[i++];
      const ts = await tsdbLookup(e.home, e.away);
      if (ts) e.start = ts;
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  return targets.filter((e) => e.start).length;
}
