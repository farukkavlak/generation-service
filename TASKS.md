# Tasks

The work is split into small units. Each change is reviewed before it is committed to `main`.

## 0. Tooling

- [x] Set up TypeScript, ESLint, Prettier and EditorConfig
- [x] Add git hooks for checks and commit message format

## 1. Infrastructure

- [x] Add a Dockerfile for the service
- [x] Add Docker Compose with the service, PostgreSQL and Redis
- [x] Read configuration from environment variables
- [x] Connect to PostgreSQL and Redis
- [x] Add a migration runner that runs on startup
- [x] Start the Express app with a request body size limit
- [x] Add a logger interface with a console implementation

Done when `docker compose up` starts all three services and the API responds.

## 2. Database schema

- [x] Create the `generations` table
- [x] Create the `daily_quota` table with one row per user per UTC day
- [x] Add an index for the history query

Done when migrations apply to an empty database and are skipped on restart.

## 3. AI provider

- [x] Define the `AiProvider` interface
- [x] Implement the fake provider with the behaviors described in the case
- [x] Time out provider calls after 3 seconds

Done when every fake provider input behaves as described and the event loop is never blocked.

## 4. Generation endpoint

- [x] Require the `X-User-Id` header
- [x] Validate and normalize the prompt
- [x] Implement `POST /v1/generations`
- [x] Map provider errors to 502 and timeouts to 504
- [x] Add a central error handler

## 5. Daily quota

- [x] Reserve quota atomically before calling the provider
- [x] Release the reservation when the provider fails or times out
- [x] Return 429 when the quota is exhausted
- [x] Expose remaining quota in the `X-Quota-Remaining` header
- [x] Implement `GET /v1/quota`

## 6. Result cache

- [x] Cache successful results in Redis by normalized prompt for 10 minutes
- [x] Check the cache before the quota
- [x] Save cache hits to the user's history
- [x] Keep serving requests when Redis is unavailable

## 7. History endpoint

- [x] Implement `GET /v1/generations` for the requesting user, newest first
- [x] Validate `limit` (default 20, maximum 100)
- [x] Add cursor-based pagination that is stable for equal timestamps

## 8. Tests

- [ ] Run tests against real PostgreSQL and Redis with Testcontainers
- [ ] Add a controllable provider for tests
- [ ] Test concurrent requests against the quota
- [ ] Test cache hits for differently written prompts

## 9. Seed data and query plan

- [ ] Add a seed script that creates 100,000 records for one user
- [ ] Capture `EXPLAIN ANALYZE` output for the history query

## 10. Delivery

- [ ] Run the verification flow from the case end to end
- [ ] Write the README
- [ ] Answer the scaling question
- [ ] Describe how AI was used
- [ ] Review every case requirement once more
