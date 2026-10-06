---
name: api-client-discipline
description: Read before writing any code that calls an external HTTP API (report pullers, webhook senders, integrations).
---
# API Client Discipline

Every outbound HTTP call follows one contract: bounded time, bounded retries, secrets out of URLs and logs, zero trust in response shape. Copy the `ApiClient` helper below instead of raw `requests.get` — it encodes the whole contract.

## Hard rules

1. `timeout=(5, 30)` on every call — connect 5s, read 30s. `requests` defaults to infinite; a Session has no default. Node: `AbortSignal.timeout(35_000)` + undici `Agent({connectTimeout: 5_000})`.
2. Max 3 retries, full jitter 0-0.5s / 1-2s / 2-4s; idempotent methods only (GET/HEAD/PUT/DELETE/OPTIONS); only on 429/500/502/503/504 or connection errors. Other 4xx: fail now, log status + first 300 chars of body.
3. Honor `Retry-After` (integer seconds or HTTP-date), capped at 120s.
4. Retry POST only with a documented idempotency key: `Idempotency-Key: str(uuid.uuid4())`, one per logical operation, reused on every retry of it. Otherwise one attempt — payments especially.
5. 429 = you are too fast: honor Retry-After, halve your rate. 5xx = server hurts: back off, count toward the breaker.
6. Breaker: 5 consecutive failed requests open it for 60s — fail fast while open, log OPEN once, not 500 times.
7. Tokens from env / `{{secret:...}}` into the `Authorization` header, never the URL (URLs land in logs and tracebacks); `redact()` every header dict before printing.
8. Status before `.json()`; check Content-Type contains `json`; validate the 2-3 fields you read; cap streamed unknown bodies at 50 MB.
9. Pagination: page cap 500, progress log every 20 pages, sleep 0.2s/page (~5 rps) unless docs allow more; cursor and offset styles.
10. Timestamps parsed tz-aware, compared in UTC; reject naive.
11. Max 4 in-flight requests to a partner API.

## The helper (`api_client.py` — Python 3.10+, `pip install requests`)

```python
import email.utils
import logging
import random
import time
from datetime import datetime, timezone

import requests

log = logging.getLogger("apiclient")
IDEMPOTENT = {"GET", "HEAD", "PUT", "DELETE", "OPTIONS"}
RETRY_STATUS = {429, 500, 502, 503, 504}
JITTER = [(0.0, 0.5), (1.0, 2.0), (2.0, 4.0)]  # full jitter: retry 1, 2, 3
SENSITIVE = {"authorization", "x-api-key", "cookie", "proxy-authorization"}


def redact(headers) -> dict:
    """Pass EVERY header dict through this before printing it."""
    return {k: ("<redacted>" if k.lower() in SENSITIVE else v) for k, v in dict(headers).items()}


def retry_after_seconds(resp):
    ra = resp.headers.get("Retry-After")
    if ra is None:
        return None
    if ra.strip().isdigit():  # "Retry-After: 7"
        return float(ra)
    dt = email.utils.parsedate_to_datetime(ra)  # HTTP-date form
    return max(0.0, (dt - datetime.now(timezone.utc)).total_seconds())


class ApiError(RuntimeError):
    pass


class ApiClient:
    def __init__(self, base_url, token, timeout=(5, 30), breaker_threshold=5, cooldown=60):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout  # (connect, read); never None
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {token}"  # header, NEVER in the URL
        self.fails, self.threshold = 0, breaker_threshold
        self.cooldown, self.open_until = cooldown, 0.0

    def request(self, method, path, idempotency_key=None, **kw):
        if time.monotonic() < self.open_until:
            raise ApiError("circuit open — failing fast")  # no log spam while open
        method = method.upper()
        headers = dict(kw.pop("headers", {}))
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key  # SAME key on every retry
        can_retry = method in IDEMPOTENT or idempotency_key is not None
        resp = err = None
        for attempt in range(4):  # 1 try + max 3 retries
            try:
                resp, err = self.s.request(method, self.base_url + path, headers=headers,
                                           timeout=self.timeout, **kw), None
            except (requests.ConnectionError, requests.Timeout) as exc:
                resp, err = None, exc
            if resp is not None and resp.status_code not in RETRY_STATUS:
                if resp.ok:
                    self.fails = 0
                    return resp
                raise ApiError(f"{method} {path} -> {resp.status_code}: {resp.text[:300]}")
            if not can_retry or attempt == 3:  # non-idempotent, or budget spent
                break
            wait = retry_after_seconds(resp) if resp is not None else None
            time.sleep(min(wait, 120) if wait is not None else random.uniform(*JITTER[attempt]))
        self.fails += 1
        if self.fails >= self.threshold and time.monotonic() >= self.open_until:
            self.open_until = time.monotonic() + self.cooldown
            log.error("circuit OPEN %ss after %d consecutive failures", self.cooldown, self.fails)
        if resp is not None:
            raise ApiError(f"{method} {path} gave up: {resp.status_code}: {resp.text[:300]}")
        raise ApiError(f"{method} {path} gave up: {err!r}")
```

## Using it: paginated report puller

```python
import logging
import time
from datetime import datetime, timezone

from api_client import ApiClient, redact

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("puller")


def fetch_all(client, path, limit=100, page_cap=500):
    items, cursor, page = [], None, 0
    while page < page_cap:
        params = ({"limit": limit, "cursor": cursor} if cursor is not None
                  else {"limit": limit, "offset": page * limit})  # cursor or offset style
        r = client.request("GET", path, params=params)
        ct = r.headers.get("Content-Type", "")
        if "json" not in ct:  # content-type surprise = fail loud
            raise RuntimeError(f"expected JSON, got {ct!r}: {r.text[:300]}")
        data = r.json()
        batch = data.get("items", data.get("data", []))
        for row in batch[:3]:  # spot-check the 2-3 fields you USE
            if "id" not in row or "created_at" not in row:
                raise RuntimeError(f"unexpected row shape: {str(row)[:300]}")
        items.extend(batch)
        page += 1
        if page % 20 == 0:
            log.info("page %d, %d items so far", page, len(items))
        cursor = data.get("next_cursor")
        if cursor is None and len(batch) < limit:  # both styles: short/absent page = done
            return items
        time.sleep(0.2)  # ~5 rps: polite to prod APIs
    raise RuntimeError(f"page_cap={page_cap} hit — endpoint loops or cap too low")


def age_hours(iso_ts):
    ts = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    if ts.tzinfo is None:  # never compare naive vs aware
        raise ValueError(f"naive timestamp from API: {iso_ts!r}")
    return (datetime.now(timezone.utc) - ts).total_seconds() / 3600


if __name__ == "__main__":
    import os
    c = ApiClient("https://api.example.com/v1", os.environ["BRAND_API_TOKEN"])
    log.info("headers: %s", redact(c.s.headers))  # never print raw headers
    rows = fetch_all(c, "/orders")
    print(f"Toplam {len(rows)} kayit, {sum(age_hours(r['created_at']) < 24 for r in rows)} yeni")
```

Streaming an unknown/bulk endpoint — cap the body:

```python
r = c.request("GET", "/export", stream=True)
buf, cap = bytearray(), 50 * 1024 * 1024  # 50 MB hard cap
for chunk in r.iter_content(65536):
    buf += chunk
    if len(buf) > cap:
        r.close()
        raise RuntimeError("response exceeded 50 MB cap")
```

## Same shape in Node (fetch/undici)

Node 18+ global fetch is undici underneath, but the connect timeout needs an explicit Agent. Same jitter, retry statuses, idempotency key, breaker — only the timeout plumbing differs.

```js
import { Agent } from "undici";  // npm i undici
const dispatcher = new Agent({ connectTimeout: 5_000, headersTimeout: 30_000, bodyTimeout: 30_000 });
const res = await fetch("https://api.example.com/v1/reports", {
  dispatcher,  // Node's fetch accepts undici options
  headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
  signal: AbortSignal.timeout(35_000),  // hard total cap
});
if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
```

## Self-check

- `timeout=(5, 30)` (or Node equivalent) everywhere?
- Max 3 jittered retries, idempotent-only, 429/5xx/connection errors only?
- `Retry-After` honored in both forms, capped at 120s?
- Retried POSTs: documented `Idempotency-Key`, one uuid4 per operation, reused across retries?
- Token in zero URLs and zero log lines; headers `redact()`ed?
- Errors log status + first 300 chars of body?
- Status before `.json()`; Content-Type and consumed fields checked?
- Page cap + progress log + 0.2s inter-page sleep?
- Timestamps tz-aware, UTC compares?
- Breaker for >10-call scripts; max 4 in flight?

## Anti-patterns

- `while True:` retry on a 400 — a client bug retried forever, plus a rate-limit ban.
- `requests.get(url)` with no timeout — hangs for hours when the partner blackholes.
- `?api_key=tk_live_...` in the query string — token lands in their access logs and your tracebacks.
- Retrying a payment POST without an idempotency key — duplicate charge.
- `except Exception: pass` or raising bare status — keep status + first 300 chars of body.
- 100 parallel calls to a partner API "for speed" — token banned, everything slower.
- Fresh `uuid4()` per retry attempt (defeats idempotency) or one key per batch (dedupes distinct ops).
- Naive `datetime.now()` vs the API's UTC timestamps — silently off by your timezone offset.