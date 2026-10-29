# Tasks

The work is split into small units. Each unit is built on its own branch and reviewed before it is merged into `main`.

## 0. Tooling

- [x] Set up TypeScript, ESLint, Prettier and EditorConfig
- [x] Add git hooks for checks and commit message format

## 1. Infrastructure

- [ ] Add a Dockerfile for the service
- [ ] Add Docker Compose with the service, PostgreSQL and Redis
- [ ] Read configuration from environment variables
- [ ] Connect to PostgreSQL and Redis
- [ ] Add a migration runner that runs on startup
- [ ] Start the Express app with a request body size limit

Done when `docker compose up` starts all three services and the API responds.

## 2. Database schema

- [ ] Create the `generations` table
- [ ] Create the `daily_quota` table with one row per user per UTC day
- [ ] Add an index for the history query

Done when migrations apply to an empty database and are skipped on restart.

## 3. AI provider

- [ ] Define the `AiProvider` interface
- [ ] Implement the fake provider with the behaviors described in the case
- [ ] Time out provider calls after 3 seconds

Done when every fake provider input behaves as described and the event loop is never blocked.

## 4. Generation endpoint

- [ ] Require the `X-User-Id` header
- [ ] Validate and normalize the prompt
- [ ] Implement `POST /v1/generations`
- [ ] Map provider errors to 502 and timeouts to 504
- [ ] Add a central error handler

## 5. Daily quota

- [ ] Reserve quota atomically before calling the provider
- [ ] Release the reservation when the provider fails or times out
- [ ] Return 429 when the quota is exhausted
- [ ] Expose remaining quota in the `X-Quota-Remaining` header
- [ ] Implement `GET /v1/quota`

## 6. Result cache

- [ ] Cache successful results in Redis by normalized prompt for 10 minutes
- [ ] Check the cache before the quota
- [ ] Save cache hits to the user's history
- [ ] Keep serving requests when Redis is unavailable

## 7. History endpoint

- [ ] Implement `GET /v1/generations` for the requesting user, newest first
- [ ] Validate `limit` (default 20, maximum 100)
- [ ] Add cursor-based pagination that is stable for equal timestamps

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
