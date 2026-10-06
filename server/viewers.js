// Viewer tracking with a simulated baseline: every stream gets a stable random
// "crowd" count (489–5000) seeded by stream id, plus real active viewers on top.
// The baseline drifts slightly over time so the numbers look alive.
export class ViewerTracker {
  constructor(ttlMs = 60000) {
    this.ttl = ttlMs;
    this.active = new Map(); // streamId -> Map<sessionId, lastSeen>
    this.base = new Map(); // streamId -> { base, phase }
  }

  // deterministic pseudo-random baseline per stream (489..5000)
  baseline(streamId) {
    const now = Date.now();
    let e = this.base.get(streamId);
    if (!e || now - e.ts > 10 * 60 * 1000) {
      // re-roll roughly every 10 minutes so counts evolve
      let h = 0;
      const s = String(streamId) + ':' + Math.floor(now / (10 * 60 * 1000));
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      const base = 489 + (Math.abs(h) % (5000 - 489 + 1));
      e = { base, ts: now };
      this.base.set(streamId, e);
    }
    return e.base;
  }

  ping(streamId, session) {
    const now = Date.now();
    let m = this.active.get(streamId);
    if (!m) { m = new Map(); this.active.set(streamId, m); }
    m.set(session, now);
  }

  count(streamId) {
    const now = Date.now();
    let real = 0;
    const m = this.active.get(streamId);
    if (m) {
      for (const [k, t] of m) {
        if (now - t > this.ttl) m.delete(k);
        else real++;
      }
    }
    // slow sine drift (±6%) around the baseline for a live feel
    const base = this.baseline(streamId);
    const drift = 1 + 0.06 * Math.sin(now / 45000 + (streamId % 97));
    return real + Math.round(base * drift);
  }
}
