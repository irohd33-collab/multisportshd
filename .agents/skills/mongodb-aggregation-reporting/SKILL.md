---
name: mongodb-aggregation-reporting
description: Read before any query against live production MongoDB — reporting aggregations, pymongo safety, currency rules.
---
# MongoDB Aggregation Reporting (Live Production)

You are querying LIVE brand databases that serve real payment traffic. Every report (daily deposits, top players, hourly breakdowns) must read from secondaries, be time-bounded, and prove index usage before it runs. A sloppy query here degrades production, not a test box.

## Hard rules

1. **Connection**: URI comes from env / secret store only (`os.environ["MONGO_URI"]`, injected as `{{secret:brand_mongo_uri}}`). Always set `serverSelectionTimeoutMS=5000`, `readPreference="secondaryPreferred"`, and an `appname` so ops can find you in `currentOp`. Reports NEVER run with the default `primary` read preference.
2. **`maxTimeMS` on every operation**: 60000 for aggregations, 30000 for finds/counts. No exceptions — an unbounded query can pin a snapshot open and stall the cluster.
3. **Datetimes are tz-aware UTC**: `datetime.now(timezone.utc)`. Data is stored in UTC; query in UTC with a half-open window (`{"$gte": t0, "$lt": t1}`). A naive datetime silently shifts your window by the host's tz offset.
4. **`$match` is the FIRST pipeline stage** and only touches indexed fields (here: the `(type, status, approved_at)` compound index on `payments`).
5. **Currency isolation**: every `$group` that sums money includes currency in `_id`. Amounts of different currencies are NEVER added together — 100 TRY + 100 USD is garbage that looks plausible.
6. **Cross-collection username join = second `$in` query**, batched at 1000 ids per round trip, results into a dict. `$lookup` cannot cross databases at all, and same-DB `$lookup` on an unindexed foreign field does a collection scan per input document.
7. **Explain gate**: before the first production run of any new filter shape, run `explain` with `executionStats` and assert the winning plan is IXSCAN. COLLSCAN → abort and report the missing index; do not "run it anyway".
8. **Counting**: `[{"$match": ...}, {"$count": "n"}]` aggregation for filtered counts; `estimated_document_count()` (O(1) metadata) for whole-collection size. Never `count_documents({})` on a large collection — it is a full scan that returns one number.
9. **Memory**: `allowDiskUse=True` on any pipeline grouping more than ~100k docs (each stage has a 100 MB RAM limit). `$project` away unused fields before `$group` to shrink transfer and working set.
10. **Cursors**: iterate them; never `list()` an unbounded result. Every `$sort` that feeds output has a `$limit` after it.

## Example 1 — daily deposit report, one `$facet` pass

```python
# python -m pip install "pymongo[srv]==4.8.0"   # srv extra = dnspython for mongodb+srv:// URIs
import os
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

# export MONGO_URI={{secret:brand_mongo_uri}}  — credentials never appear in code or logs
client = MongoClient(
    os.environ["MONGO_URI"],
    serverSelectionTimeoutMS=5000,        # fail fast if the cluster is unreachable
    connectTimeoutMS=5000,
    socketTimeoutMS=120000,
    readPreference="secondaryPreferred",  # reports NEVER hammer the primary
    appname="tekno-report",               # visible in db.currentOp() / profiler
)
db = client["brand_db"]

# Yesterday, UTC. approved_at is stored in UTC -> tz-aware UTC bounds, half-open window.
midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
t0, t1 = midnight - timedelta(days=1), midnight
match = {"type": "IN", "status": 3, "approved_at": {"$gte": t0, "$lt": t1}}

pipeline = [
    {"$match": match},                    # FIRST stage, hits (type, status, approved_at) index
    {"$project": {"_id": 0, "player_id": 1, "amount": 1, "currency": 1,
                  "approved_at": 1}},     # shrink docs before grouping
    {"$facet": {                          # totals + top10 + hourly in ONE pass over the data
        "totals": [
            {"$group": {"_id": "$currency",              # NEVER sum across currencies
                        "total": {"$sum": "$amount"},
                        "count": {"$sum": 1},
                        "players": {"$addToSet": "$player_id"}}},
            {"$project": {"_id": 0, "currency": "$_id", "total": 1, "count": 1,
                          "unique_players": {"$size": "$players"}}},
            {"$sort": {"total": -1}},
        ],
        "top10": [
            {"$group": {"_id": {"pid": "$player_id", "cur": "$currency"},
                        "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
            {"$sort": {"total": -1}},
            {"$limit": 10},               # $sort always followed by $limit
        ],
        "hourly": [  # data stays UTC; timezone below is DISPLAY-only bucket alignment
            {"$group": {"_id": {"h": {"$dateTrunc": {"date": "$approved_at",
                                                     "unit": "hour",
                                                     "timezone": "Europe/Istanbul"}},
                                "cur": "$currency"},
                        "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
            {"$sort": {"_id.h": 1}},
        ],
    }},
]

report = db.payments.aggregate(pipeline, maxTimeMS=60000, allowDiskUse=True).next()
for row in report["totals"]:
    print(f'{row["currency"]}: {row["total"]:,.2f} '
          f'({row["count"]} yatırım, {row["unique_players"]} oyuncu)')
```

## Example 2 — explain gate, safe count, batched username join

```python
# Continues Example 1 in the same file (reuses client, db, match, report).
import json
from itertools import islice

# 1) Safety gate: prove the filter shape uses an index BEFORE the heavy run.
plan = db.command("explain",
                  {"find": "payments", "filter": match, "projection": {"_id": 1}},
                  verbosity="executionStats")
winning = json.dumps(plan["queryPlanner"]["winningPlan"])
assert "COLLSCAN" not in winning, "COLLSCAN on payments — missing index, ABORT"
st = plan["executionStats"]
print(f'IXSCAN ok: examined={st["totalDocsExamined"]} '
      f'returned={st["nReturned"]} ms={st["executionTimeMillis"]}')

# 2) Filtered count via aggregation — never count_documents({}) on a big collection.
n = next(db.payments.aggregate([{"$match": match}, {"$count": "n"}],
                               maxTimeMS=30000), {"n": 0})["n"]
print(f"{n} onaylı yatırım")

# 3) Username join: SECOND query with batched $in — not $lookup across DBs,
#    not one find_one() per row.
def chunked(seq, size=1000):
    it = iter(seq)
    while batch := list(islice(it, size)):
        yield batch

player_ids = [r["_id"]["pid"] for r in report["top10"]]
usernames = {}
for batch in chunked(player_ids, 1000):            # 1000 ids per round trip
    for p in db.players.find({"_id": {"$in": batch}},
                             {"username": 1},      # project only what you need
                             max_time_ms=30000):
        usernames[p["_id"]] = p.get("username", str(p["_id"]))

print("\nEn çok yatıran 10 oyuncu:")
for r in report["top10"]:
    name = usernames.get(r["_id"]["pid"], "bilinmiyor")
    print(f'{name}: {r["total"]:,.2f} {r["_id"]["cur"]} ({r["count"]} işlem)')

client.close()
```

## Self-check (before running against prod)

- [ ] URI read from env/secret; no credentials in code, output, or error messages
- [ ] `readPreference="secondaryPreferred"` and `serverSelectionTimeoutMS=5000` set
- [ ] `maxTimeMS` (or `max_time_ms`) present on every aggregate/find/count
- [ ] `t0`/`t1` are tz-aware UTC; window is half-open `$gte`/`$lt`
- [ ] `$match` is the first stage and its fields are indexed; explain shows IXSCAN
- [ ] every money `$group` has currency in `_id`; no cross-currency sums anywhere
- [ ] cross-collection ids resolved via `$in` batches of ≤1000, not per-row queries
- [ ] every `$sort` in the pipeline is followed by a `$limit`
- [ ] `allowDiskUse=True` on group-heavy pipelines; `$project` before `$group`
- [ ] cursors iterated (not `list()` on unbounded results); `client.close()` at end

## Anti-patterns (seen in real incidents)

- **`$lookup` for the username join** — `$lookup` cannot reach another database, and even same-DB on an unindexed `foreignField` it scans `players` once per matched payment (O(N×M)). Use the batched `$in` second query.
- **Per-row resolution**: `for r in rows: db.players.find_one({"_id": r["pid"]})` — 10,000 rows × 2 ms RTT = 20+ seconds and 10,000 extra ops against a live cluster. Batched `$in` does it in 10 round trips.
- **Naive datetimes**: `datetime(2026, 8, 19)` or `datetime.now()` — the report window silently shifts by the host tz offset (3 h wrong for Europe/Istanbul). Always `timezone.utc`.
- **Analytics on the primary at peak** — pymongo defaults to `readPreference="primary"`; a 60 s `$group` there competes with live payment writes. Set `secondaryPreferred`, and schedule backfills off-peak.
- **`list(db.payments.find({}))`** — full collection scan pulled into RAM: OOMs the sandbox and hammers the cluster. Filter, project, iterate.
- **`count_documents({})` on a 100M+ doc collection** — a full scan to fetch one integer. Use `estimated_document_count()` (metadata) or `$match`+`$count` for filtered counts.
- **Summing `$amount` without currency in the group key** — the number renders fine and is meaningless. Currency in `_id`, always.
- **Converting timestamps to local time before querying** — store and query UTC; the display timezone belongs only in `$dateTrunc`/`$dateToString` (`timezone: "Europe/Istanbul"`) at render time.
