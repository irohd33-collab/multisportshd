// AI-assisted per-match cover generation.
//
// Primary path: platform AI (TEKNO_AI_API_KEY) writes a bespoke SVG cover per match —
// prompt built from team names, league and channel, so every match gets a unique,
// hand-tailored design. Deterministic caching by stream_id: one AI call per match, reused.
//
// Fallback path (AI unreachable): rich deterministic SVG built from team-name hash
// (dual-color split, halftone pattern, sport-specific icon) — still per-match unique.
//
// The key never leaves the server; generated SVGs are cached in memory.

const BASE = process.env.TEKNO_AI_BASE_URL || '';
const KEY = process.env.TEKNO_AI_API_KEY || '';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

const cache = new Map(); // streamId -> svg (hits persist for server lifetime)

const SPORT_ICON = {
  football: '⚽', basketball: '🏀', tennis: '🎾', ice_hockey: '🏒', table_tennis: '🏓',
  volleyball: '🏐', baseball: '⚾', cricket: '🏏', rugby: '🏉', handball: '🤾',
  futsal: '⚽', badminton: '🏸', golf: '⛳', boxing: '🥊', darts: '🎯',
  formula_1: '🏎️', horse_racing: '🏇', motorsport: '🏎️', snooker: '🎱', sports_channels: '📺',
};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hashNum(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---------- Fallback: deterministic, rich, per-match SVG ----------
export function fallbackCover(e) {
  const home = String(e.home || 'Home').slice(0, 22);
  const away = String(e.away || '').slice(0, 22);
  const league = String(e.league || '').slice(0, 46);
  const referee = e.referee ? String(e.referee).slice(0, 28) : '';
  const icon = SPORT_ICON[e.sport_key] || '📺';
  const h = hashNum(String(e.stream_id) + e.home + e.away);
  const hue = h % 360;
  const hue2 = (hue + 60 + (h % 80)) % 360;
  const rot = (h % 3) * 12;
  const homeLen = home.length;
  const awayLen = away.length;
  // split-court proportions derived from team-name lengths (feels bespoke)
  const split = 50 + (homeLen - awayLen) * 2;
  const homeBadge = e.home_badge || '';
  const awayBadge = e.away_badge || '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="l" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},48%,15%)"/>
      <stop offset="1" stop-color="hsl(${hue2},55%,7%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="${(split / 100).toFixed(2)}" cy="0.1" r="1">
      <stop offset="0" stop-color="hsl(${hue},85%,55%)" stop-opacity="0.28"/>
      <stop offset="1" stop-color="hsl(${hue},85%,55%)" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})">
      <circle cx="6" cy="6" r="1.6" fill="hsl(${hue},60%,60%)" opacity="0.25"/>
      <circle cx="17" cy="17" r="1.1" fill="hsl(${hue2},60%,60%)" opacity="0.18"/>
    </pattern>
  </defs>
  <rect width="640" height="360" fill="url(#l)"/>
  <rect width="640" height="360" fill="url(#dots)"/>
  <rect width="640" height="360" fill="url(#glow)"/>
  <rect x="${split}" y="0" width="2" height="360" fill="#ffffff" opacity="0.10"/>
  ${homeBadge ? `<image href="${esc(homeBadge)}" x="30" y="70" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>` : ''}
  ${awayBadge ? `<image href="${esc(awayBadge)}" x="30" y="188" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>` : ''}
  <text x="${homeBadge ? 100 : 30}" y="${homeBadge ? 106 : 150}" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="#ffffff" opacity="0.97">${esc(home)}</text>
  ${away ? `<text x="30" y="${awayBadge ? 250 : 212}" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#ffffff" opacity="0.55">${esc('vs')}</text>
  <text x="${awayBadge ? 100 : 30}" y="${awayBadge ? 306 : 268}" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="#ffffff" opacity="0.97">${esc(away)}</text>` : `<text x="30" y="212" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff" opacity="0.8">CANLI YAYIN</text>`}
  ${referee ? `<text x="610" y="290" text-anchor="end" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="#ffffff" opacity="0.7">⚖ Hakem: ${esc(referee)}</text>` : ''}
  <rect x="0" y="318" width="640" height="42" fill="#000000" opacity="0.35"/>
  <text x="30" y="346" font-family="Arial, sans-serif" font-size="17" font-weight="800" fill="hsl(${hue},95%,75%)" letter-spacing="2">MULTISPORTSHD</text>
  <text x="610" y="346" text-anchor="end" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#ffffff" opacity="0.75">● CANLI</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ---------- Primary: AI-written bespoke SVG ----------
async function aiCover(e) {
  if (!BASE || !KEY) return null;
  const home = String(e.home || 'Home');
  const away = String(e.away || '');
  const league = String(e.league || '');
  const sport = String(e.sport || e.sport_key || '');
  const prompt = [
    'You are a TV-graphics designer. Produce ONLY a complete, self-contained SVG string for a 640x360 live-sport match cover card.',
    'Rules: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"> root; dark premium look (deep navy/charcoal base);',
    'use gradients + geometric sport motif relevant to the sport; include BOTH team names as legible white text (max 42px,',
    'truncate visually if long, never overlap), league name as a small accent-colored label, and the brand text',
    `"MULTISPORTSHD" small in a footer band plus a small "● CANLI" tag; no external images/fonts; no XML errors;`,
    'choose 2 accent colors that differ per match. Return ONLY the SVG, no markdown, no explanation.',
    `Match: sport="${sport}", league="${league}", home="${home}", away="${away || '—'}"`,
    e.referee ? `Match referee (include as a small "⚖ Referee: ${e.referee}" text in the bottom-right area): yes` : 'No referee info.',
  ].join('\n');

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'coder-pro',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1800,
        temperature: 0.9,
      }),
    });
    clearTimeout(t);
    if (!res.ok) { console.error('[aiCover] HTTP', res.status); return null; }
    const j = await res.json();
    let svg = j?.choices?.[0]?.message?.content || '';
    svg = svg.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();
    if (!/^<svg[\s\S]*<\/svg>$/i.test(svg)) { console.error('[aiCover] not a pure svg'); return null; }
    if (svg.length > 20000) { console.error('[aiCover] too big'); return null; }
    // sanity: must mention brand + one team
    if (!/MULTISPORTSHD/i.test(svg) || !svg.includes(esc(home.slice(0, 12)))) { console.error('[aiCover] missing brand/team'); return null; }
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  } catch (err) {
    console.error('[aiCover]', err.message);
    return null;
  }
}

// Public: AI first, fallback second — cached per stream for the server lifetime.
export async function aiOrFallbackCover(e) {
  const id = String(e.stream_id);
  if (cache.has(id)) return cache.get(id);
  let svg = await aiCover(e);
  if (!svg) svg = fallbackCover(e);
  cache.set(id, svg);
  return svg;
}

export { SPORT_ICON };
