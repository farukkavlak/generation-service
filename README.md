# generation-service

## Setup and tests

Node.js 22, PostgreSQL 16, Redis 7. Free ports needed: 3000, 5432, 6379.

```sh
docker compose up -d --build
npm install && npm test
npm run seed && npm run explain
```

## Quota under concurrency

An atomic upsert reserves the slot: `INSERT … ON CONFLICT (user_id, day) DO UPDATE SET used = daily_quota.used + 1 WHERE daily_quota.used < 5`. Concurrent requests wait on its row lock; the sixth gets no row (429). A 502/504 releases the slot.

## Index and EXPLAIN

`(user_id, created_at DESC, id DESC)` matches the cursor `(created_at, id) < ($2, $3)`: no sort, 21 rows read, even 90,000 rows deep:

```
Limit  (cost=0.42..6.46 rows=21 width=59) (actual time=0.016..0.020 rows=21 loops=1)
  Buffers: shared hit=4
  ->  Index Scan using generations_user_history_idx on generations  (cost=0.42..2878.52 rows=10000 width=59) (actual time=0.015..0.018 rows=21 loops=1)
        Index Cond: ((user_id = 'seed-user'::text) AND (ROW(created_at, id) < ROW('2026-10-28 17:03:52.274+00'::timestamp with time zone, 90014)))
        Buffers: shared hit=4
Execution Time: 0.063 ms
```

## Technical choice

Reserve first, release on failure: a transaction around the provider call would hold a row lock and connection for up to 3 s.

## Time spent and known gaps

About 4–5 hours.

- Cache stampede: concurrent misses for one prompt each call the provider.
- A crash, failed release or failed save loses that slot for the day (never over the limit).
- Waiting requests hold their slots, even if they later fail.
- `daily_quota` is never pruned.
- No 504 test (fixed 3 s timeout); checked with curl.

## 10 instances, Redis down for one minute

- Quota stays exact: it lives only in Postgres, and each reservation is one atomic statement, so ten instances behave like one.
- The cache fails open: every request is a miss, calls the provider and counts toward the quota. Users with no quota left get 429 instead of cached results.
- Redis calls fail fast (no offline queue); a hung Redis adds up to ~1 s per miss (two 500 ms timeouts). Every failure is logged.
- I would add a circuit breaker around Redis, a lock so only one request per prompt calls the provider, and PgBouncer: 10 instances × 10 pool connections already reach Postgres's default 100.

## AI usage

I used Claude Code to write and review code. I checked every change against the case and tested it on real Postgres and Redis, with curl on docker compose, and by breaking rules on purpose to see the tests fail.
