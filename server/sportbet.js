// sportbet1.one: rich match details (start time, stage, score) used to enrich and
// classify stream-list events. type=2 (live+near) and type=3 (full program) merged.

const SB_BASE = 'https://sportbet1.one/v1/eventsv2';
const SB_SPORT_MAP = {
  football: 1, ice_hockey: 2, basketball: 3, table_tennis: 7, golf: 8,
  cricket: 9, tennis: 11, rugby: 12, volleyball: 15, darts: 16,
  handball: 18, baseball: 20, formula_1: 23, futsal: 24, boxing: 34,
};

export async function fetchSportbetData() {
  const out = {};
  const tasks = Object.entries(SB_SPORT_MAP).map(async ([key, code]) => {
    try {
      const [rLive, rAll] = await Promise.all([
        fetch(`${SB_BASE}?sport=${code}&type=2&isVip=false`, { signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch(`${SB_BASE}?sport=${code}&type=3&isVip=false`, { signal: AbortSignal.timeout(20000) }).then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
      ]);
      const seen = new Set();
      const merged = [];
      for (const e of [...(rLive.events || []), ...(rAll.events || [])]) {
        if (!e || seen.has(e._)) continue;
        seen.add(e._);
        merged.push({
          bet_id: e._,
          start: e.t,
          home: e.h,
          away: e.a,
          league_name: e.ln,
          stage: e.st,
          game_time: e.gt,
          score_ft: e.round?.ft || e.round?.p1,
          live: e.s === 2,
          status: e.s,
        });
      }
      out[key] = merged;
    } catch { /* skip */ }
  });
  await Promise.all(tasks);
  return out;
}

function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .join(' ')
    .trim();
}

function nameMatch(a, b) {
  const wa = norm(a).split(' ').filter((w) => w.length > 2);
  const wb = norm(b).split(' ').filter((w) => w.length > 2);
  if (!wa.length || !wb.length) return false;
  const inter = wa.filter((w) => wb.some((v) => v === w || v.startsWith(w) || w.startsWith(v)));
  return inter.length >= Math.min(2, wa.length) || (wa.length === 1 && inter.length === 1);
}

function pairMatch(h1, a1, h2, a2) {
  return (nameMatch(h1, h2) && nameMatch(a1, a2)) || (nameMatch(h1, a2) && nameMatch(a1, h2));
}

// Enrich stream events with sportbet data. Returns { enriched, dead }.
// "dead" = matched but finished long ago (live=false AND start older than 3h).
// Future matches (start in future) are NEVER dead — they are upcoming.
export function matchSportbet(streamEvents, sbData) {
  const enriched = {};
  const dead = new Set();
  for (const [key, evs] of Object.entries(streamEvents)) {
    const pool = (sbData[key] || []).concat(sbData['sports_channels'] || []);
    for (const ev of (evs.events || evs || [])) {
      let m = null;
      for (const cand of pool) {
        if (pairMatch(ev.home, ev.away, cand.home, cand.away)) { m = cand; break; }
      }
      if (m) {
        const startMs = m.start ? new Date(m.start).getTime() : 0;
        const isFuture = startMs > Date.now();
        if (!isFuture && m.live === false && startMs < Date.now() - 3 * 60 * 60 * 1000) {
          dead.add(ev.stream_id);
          continue;
        }
        enriched[ev.stream_id] = {
          start: m.start,
          stage: m.stage,
          game_time: m.game_time,
          score_ft: m.score_ft,
          league_name: m.league_name,
          bet_id: m.bet_id,
          live: m.live,
          status: isFuture ? 'upcoming' : (m.live ? 'live' : 'unknown'),
        };
      }
    }
  }
  return { enriched, dead };
}
