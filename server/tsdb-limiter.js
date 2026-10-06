// Shared TheSportsDB rate limiter — tsdb.js (start times) and badges.js (team
// badges + referees) hit the same free-tier API (~30 req/min per IP), so they
// must share ONE global limiter instead of two independent ones racing each other.

const MIN_DELAY = 2200; // >2s between ANY two TSDB requests
let lastReq = 0;
let blockedUntil = 0;
const waiters = [];

export function isBlocked() {
  return Date.now() < blockedUntil;
}

export function blockedUntilMs() {
  return blockedUntil;
}

export function block(ms) {
  blockedUntil = Date.now() + ms;
}

export async function gate() {
  if (Date.now() < blockedUntil) {
    await new Promise((r) => setTimeout(r, blockedUntil - Date.now()));
  }
  const wait = lastReq + MIN_DELAY - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReq = Date.now();
}
