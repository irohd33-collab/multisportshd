// Team badge (logo) + referee lookup via TheSportsDB free API.
// Badges are cached in-process (team name -> badge URL) and rate-limit aware.
// Referee comes from the matched event (strOfficial) when present.

import { gate, isBlocked, block, blockedUntilMs } from './tsdb-limiter.js';

const TSDB = 'https://www.thesportsdb.com/api/v1/json/3/';
const HDRS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0', Accept: 'application/json' };

const badgeCache = new Map(); // team -> url|null
const refereeCache = new Map(); // "home|away" -> string|null
const TTL = 24 * 3600 * 1000;

async function throttledFetch(url) {
  // rate-limit block'una isBlocked() ile düşmek yerine BEKLE (badge worker asla boş dönmesin)
  for (let attempt = 0; attempt < 2; attempt++) {
    if (isBlocked()) {
      await new Promise((r) => setTimeout(r, Math.min(blockedUntilMs() - Date.now(), 130 * 1000) + 1000));
    }    await gate();
    try {
      const res = await fetch(url, { headers: HDRS, signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      if (text.trim().startsWith('<') || res.status === 429) {
        // rate limited (Cloudflare 429 or HTML) — back off 2 minutes (shared limiter)
        block(120 * 1000);
        console.error('[badges] rate limited, 2dk backoff (paylaşımlı limiter)');
        continue; // 2. deneme: block bittikten sonra tekrar dene
      }
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return null;
}

// team name -> badge PNG url (null when not found)
export async function teamBadge(team) {
  const key = (team || '').toLowerCase().trim();
  if (!key) return null;
  const c = badgeCache.get(key);
  if (c && Date.now() - c.ts < TTL) return c.value;
  const j = await throttledFetch(`${TSDB}searchteams.php?t=${encodeURIComponent(team)}`);
  const t = (j?.teams || [])[0];
  const url = t?.strBadge || t?.strTeamBadge || null;
  console.log('[badges]', team, '→', url ? 'OK' : 'NULL (j:' + (j ? Object.keys(j).join(',') : 'null') + ')');
// null değerleri kısa cache'le (1h değil 2dk) — rate limiti bitince tekrar denenir
  badgeCache.set(key, { ts: Date.now() - (url ? 0 : TTL - 2 * 60 * 1000), value: url });
  return url;
}

// match (home, away) -> referee name|null via event search
export async function matchReferee(home, away) {
  const key = `${(home || '').toLowerCase()}|${(away || '').toLowerCase()}`;
  if (!home || !away) return null;
  const c = refereeCache.get(key);
  if (c && Date.now() - c.ts < TTL) return c.value;
  const q = `${home} vs ${away}`.replace(/\s+/g, '_');
  const j = await throttledFetch(`${TSDB}searchevents.php?e=${encodeURIComponent(q)}`);
  const ev = (j?.event || []).find((e) => {
    const t = `${e.strHomeTeam || ''} ${e.strAwayTeam || ''}`.toLowerCase();
    return t.includes(home.toLowerCase().replace(/\(.*?\)/g, '').trim()) && t.includes(away.toLowerCase().replace(/\(.*?\)/g, '').trim());
  }) || (j?.event || [])[0];
  const ref = ev?.strOfficial || ev?.strReferee || null;
  refereeCache.set(key, { ts: Date.now() - (ref ? 0 : TTL - 3600 * 1000), value: ref });
  return ref;
}

// enrich payload events in-place: home_badge, away_badge, referee (budgeted)
export async function enrichBadgesAndReferees(sportsOut, budget = 40) {
  const targets = [];
  for (const [, v] of Object.entries(sportsOut || {})) {
    for (const e of v.events || []) {
  // null-cache'lenmiş takımlar tekrar hedefe girsin (2dk sonra yeniden dene)
  if (!e.home_badge || (e.away && !e.away_badge) || !e.referee) targets.push(e);
    }
  }
  if (!targets.length) return 0;
  console.log('[badges] hedef:', Math.min(targets.length, budget), '/', targets.length);
  // prioritize live matches first
  targets.sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1));
  const slice = targets.slice(0, budget);
  let i = 0;
  async function worker() {
    while (i < slice.length) {
      const e = slice[i++];
      try {
        if (!e.home_badge) e.home_badge = await teamBadge(e.home);
        if (!e.away_badge && e.away) e.away_badge = await teamBadge(e.away);
        if (!e.referee && e.away) e.referee = await matchReferee(e.home, e.away);
      } catch { /* skip on error */ }
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  return slice.filter((e) => e.home_badge || e.away_badge || e.referee).length;
}
