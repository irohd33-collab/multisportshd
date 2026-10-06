// Simple in-memory TTL cache with stale-if-error fallback.
export class TTLCache {
  constructor(ttlMs) {
    this.ttl = ttlMs;
    this.store = new Map();
  }
  get(key) {
    const e = this.store.get(key);
    if (!e) return { hit: false };
    if (Date.now() - e.time > this.ttl) {
      // NOT deleted: stale value stays available for stale-while-revalidate
      return { hit: false, stale: e.value };
    }
    return { hit: true, value: e.value };
  }
  set(key, value) {
    this.store.set(key, { time: Date.now(), value });
  }
}
