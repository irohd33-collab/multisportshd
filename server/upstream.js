// Upstream provider access: stream lists (two mirrors) + pph player page -> m3u8 URL.
// The auth_token is an operator credential: server-side ONLY, never sent to the client.

const LIST_URLS = [
  process.env.STREAM_API_URL || 'https://api-prime.player-us.xyz/stream-list-v2/',
  'https://api.gsplayer.xyz/stream-list-v2/?tv=usa', // 2nd mirror: +19 channels/some events
];
const TOKEN_URL = process.env.STREAM_TOKEN_URL || 'https://pph.player-us.xyz/tv/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

// Fetch both mirrors in parallel; merge by stream_id. Returns { sports, source }.
export async function fetchStreamList() {
  const results = await Promise.all(LIST_URLS.map((u) =>
    fetchWithTimeout(u, {}, 12000).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ));
  const primary = results[0];
  if (!primary) {
    if (!results[1]) throw new Error('all list sources failed');
    return { sports: results[1].sports || {}, source: 'mirror' };
  }
  const merged = {};
  for (const [key, val] of Object.entries(primary.sports || {})) {
    merged[key] = { events: { ...(val.events || {}) }, count: Object.keys(val.events || {}).length };
  }
  for (const [key, val] of Object.entries(results[1]?.sports || {})) {
    if (!merged[key]) merged[key] = { events: {}, count: 0 };
    for (const [id, ev] of Object.entries(val.events || {})) {
      if (!merged[key].events[id]) merged[key].events[id] = ev;
    }
    merged[key].count = Object.keys(merged[key].events).length;
  }
  return { sports: merged, source: 'merged' };
}

// Parse pph page -> absolute m3u8 URL (null when page says "not available").
export async function fetchTokenPage(id) {
  const url = `${TOKEN_URL}?stream_id=${id}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/<source\s+src="([^"]+\.m3u8[^"]*)"/i);
  if (!m) {
    if (/not available|Sorry/i.test(html)) return null;
    throw new Error('no source tag');
  }
  return new URL(m[1], url).toString();
}

// Full pph player HTML (kept for parity; frontend uses our own hls.js player).
export async function fetchPlayerPage(id) {
  const url = `${TOKEN_URL}?stream_id=${id}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`player HTTP ${res.status}`);
  return await res.text();
}

// Proxy a segment/key/playlist upstream.
export async function fetchUpstream(url) {
  const res = await fetchWithTimeout(url, {}, 20000);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// Is the stream's m3u8 alive? Masters: follow first variant. Gate text => dead.
export async function isStreamAlive(id) {
  try {
    const m3u8Url = await fetchTokenPage(id);
    if (!m3u8Url) return false;
    const r1 = await fetchWithTimeout(m3u8Url, {}, 12000);
    if (!r1.ok) return false;
    let text = await r1.text();
    if (!/#EXTM3U/.test(text) || /Access for live video|Sorry|not available/i.test(text)) return false;
    if (/EXT-X-STREAM-INF/.test(text)) {
      const lines = text.split('\n');
      const uri = lines.find((l) => l.trim() && !l.trim().startsWith('#'));
      if (uri) {
        const variant = new URL(uri.trim(), m3u8Url).toString();
        const r2 = await fetchWithTimeout(variant, {}, 12000);
        if (!r2.ok) return false;
        const t2 = await r2.text();
        return /#EXTM3U/.test(t2) && !/Access for live video|Sorry|not available/i.test(t2);
      }
    }
    return true;
  } catch { return false; }
}
