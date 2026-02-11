# Sprint 4 Gap Analysis (Check)

## Summary
- Score: 88%
- Date: 2026-02-11
- Sprint: 4 - 테스트 & 보안

Overall the Sprint 4 implementation is solid. Test infrastructure, security middleware, integration tests, and CI pipeline are all in place and closely follow the design document. The deviations found are mostly minor: a few missing test cases compared to the design spec, an environment variable naming discrepancy in CORS config, omitted optional validation rules, and some CI configuration gaps. No severe issues were found.

**Test case count: 69 implemented vs 62 designed** (7 extra tests added, but 3 designed cases missing -- net +7).

---

## Requirement Checklist

### Phase A: Test Infrastructure

| # | Requirement | Status | Notes |
|---|------------|--------|-------|
| A1 | Jest + Supertest installed as devDependencies | YES | `jest@^30.2.0` and `supertest@^7.2.2` installed. Design specified `jest@^29.7.0` and `supertest@^6.3.3` -- newer versions were used instead, which is acceptable. |
| A2 | jest.config.js created with correct settings | YES | Matches design: `testEnvironment: 'node'`, `testMatch`, `globalSetup`, `globalTeardown`, `testTimeout: 15000`, `verbose: true`, coverage thresholds (60/70/70/70). Added `coverageDirectory: 'coverage'` (extra, fine). Also adds `process.env.NODE_ENV = 'test'` at the top of the config file, which is a good defensive measure. |
| A3 | `__tests__/setup.js` - global setup (DB create + schema) | YES | Fully implements the design. Improvements over design: dynamically extracts DB name from `DATABASE_URL`, terminates existing connections before dropping (prevents CI failures), sets fallback env vars (`JWT_SECRET`, `JWT_EXPIRES_IN`, `STORAGE_MODE`). Schema matches design exactly. |
| A4 | `__tests__/teardown.js` - global teardown (DB drop) | YES | Fully implements design. Same improvements: terminates active connections before dropping. |
| A5 | `__tests__/helpers.js` - test utility functions | YES | All 8 functions present: `createTestUser`, `createAdminUser`, `createAgentOwner`, `createTestAgent`, `createTestProblem`, `createTestSubmission`, `cleanDatabase`, `authHeader`. All match design exactly. Exports `app`, `request`, `db` as well. |
| A6 | `server.js` modified: `NODE_ENV=test` skips `listen()` | YES | Line 58: `if (process.env.NODE_ENV !== 'test')` guard around `app.listen()`. `module.exports = app` at end. Matches design exactly. |
| A7 | `package.json`: test scripts added | YES | Scripts present: `test`, `test:coverage`, `test:watch`. |
| A8 | `package.json`: `NODE_ENV=test` prefix on test scripts | NO | Design specifies `"test": "NODE_ENV=test jest --runInBand --forceExit"` but implementation has `"test": "jest --runInBand --forceExit"` without `NODE_ENV=test` prefix. This is partially mitigated by `jest.config.js` setting `process.env.NODE_ENV = 'test'` at the top, and `setup.js` also setting it. However, on Windows this would fail anyway (`NODE_ENV=test` is a Unix syntax). The config-level approach is actually better for cross-platform compatibility. |
| A9 | `package.json`: `--runInBand` and `--forceExit` flags | YES | Both present on all test scripts. |

### Phase B: Security Middleware

| # | Requirement | Status | Notes |
|---|------------|--------|-------|
| B1 | `express-rate-limit`, `cors`, `helmet` installed | YES | All three in `dependencies` in package.json. `express-rate-limit@^8.2.1`, `cors@^2.8.6`, `helmet@^8.1.0`. |
| B2 | `middleware/rateLimiter.js` created | YES | All 4 limiters implemented: `globalLimiter` (100/min), `authLimiter` (10/min), `submissionLimiter` (5/min, agent-keyed), `voteLimiter` (30/min, user/voter-keyed). All have `skip` for test env. Matches design exactly. |
| B3 | `middleware/corsConfig.js` created | YES | Implements origin whitelist (localhost:5173, 3000, 3001), `credentials: true`, correct methods, `maxAge: 86400`. |
| B4 | CORS env variable name | WARNING | Design specifies `CORS_ORIGINS` (plural), implementation uses `CORS_ORIGIN` (singular). Minor naming mismatch -- documentation or other configs referencing `CORS_ORIGINS` would not work. |
| B5 | `server.js`: helmet integration | YES | `helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })` -- matches design. |
| B6 | `server.js`: CORS integration | YES | `corsMiddleware` applied via `app.use()`. |
| B7 | `server.js`: globalLimiter integration | YES | Applied via `app.use(globalLimiter)`. |
| B8 | `server.js`: middleware order (helmet -> cors -> rateLimiter -> bodyParser -> cookieParser -> auth -> routes -> errorHandler) | YES | Order exactly matches design section 4.6. |
| B9 | `routes/v1/auth.js`: authLimiter on register and login | YES | Both `router.post('/register', authLimiter, ...)` and `router.post('/login', authLimiter, ...)`. |
| B10 | `routes/v1/index.js`: submissionLimiter on POST submissions | YES | `router.post('/submissions', agentAuth, submissionLimiter, submissionsController.create)` |
| B11 | `routes/v1/index.js`: voteLimiter on POST votes | YES | `router.post('/votes', optionalJwtAuth, voteLimiter, votesController.create)` |
| B12 | `routes/v1/index.js`: validate middleware on submissions route | NO | Design section 4.5.2 specifies adding `validate({ problem_id: 'required|uuid', title: 'required|string|min:1|max:300' })` middleware to submissions route. Not implemented. Controller-level validation is relied upon instead. Design notes this is acceptable ("당장 제거하지 않아도 된다") but the middleware was not added. |
| B13 | `routes/v1/index.js`: validate middleware on votes route | NO | Design section 4.5.2 specifies adding `validate({ submission_id: 'required|uuid' })` middleware to votes route. Not implemented, same as B12. |
| B14 | `middleware/validate.js`: `integer`, `url`, `nohtml` rules (optional) | NO | Design section 4.5.1 marks these as optional additions. Not implemented. The validate.js middleware is present and functional with existing rules (`required`, `string`, `uuid`, `email`, `max`, `min`, `in`). |

### Phase C: Integration Tests

#### C1: auth.test.js (Design: 10 cases, Implemented: 12 cases)

| # | Design Test Case | Status | Notes |
|---|-----------------|--------|-------|
| 1 | Register success (201) | YES | Test case present, checks id, token, name, role. |
| 2 | Duplicate email (409) | YES | Checks CONFLICT error. |
| 3 | Missing name (400) | YES | Checks VALIDATION_ERROR. |
| 4 | Password < 6 chars (400) | YES | Checks VALIDATION_ERROR. |
| 5 | Invalid role (400) | YES | Checks VALIDATION_ERROR with 'superadmin'. |
| 6 | agent_owner role register (201) | YES | Checks role=agent_owner. |
| 7 | Login success (200) | YES | Checks token + user object. |
| 8 | Wrong password (401) | YES | Checks UNAUTHORIZED. |
| 9 | Non-existent email (401) | YES | Checks UNAUTHORIZED. |
| 10 | Missing login fields (400) | YES | Checks VALIDATION_ERROR. |
| -- | **Extra**: JWT token validation (registered token works) | YES | Extra test not in design, good addition. |
| -- | **Extra**: JWT role enforcement (voter cannot create agent) | YES | Extra test not in design, good addition. |

#### C2: agents.test.js (Design: 12 cases, Implemented: 13 cases)

| # | Design Test Case | Status | Notes |
|---|-----------------|--------|-------|
| 1 | Agent create as agent_owner (201) | YES | Checks api_token prefix, owner_id, is_active. |
| 2 | Agent create as admin (201) | YES | |
| 3 | Agent create as voter (403) | YES | |
| 4 | Agent create without JWT (401) | YES | |
| 5 | Agent list as admin (200 + pagination) | YES | Checks data, pagination, token masking. |
| 6 | Agent list as non-admin (403) | YES | |
| 7 | Agent detail as owner (200 + masked token) | YES | |
| 8 | Agent detail as non-owner (403) | YES | |
| 9 | Agent update as owner (200) | YES | |
| 10 | Token regeneration (200 + new token) | YES | |
| 11 | Agent delete/deactivate as admin (200 + is_active=false) | YES | |
| 12 | Non-existent agent (404) | YES | |
| -- | **Extra**: Token regeneration invalidates old token | YES | Excellent extra test: verifies old token stops working and new token works for submissions. |

#### C3: problems.test.js (Design: 12 cases, Implemented: 13 cases)

| # | Design Test Case | Status | Notes |
|---|-----------------|--------|-------|
| 1 | Problem create as admin (201 + state=draft) | YES | |
| 2 | Problem create as non-admin (403) | YES | |
| 3 | Problem list without auth (200 + pagination) | YES | |
| 4 | Problem list with state filter | YES | |
| 5 | Problem detail (200) | YES | Also checks `submission_count` property. |
| 6 | Non-existent problem (404) | YES | |
| 7 | State transition: draft -> open (200) | YES | |
| 8 | State transition: open -> voting (200) | YES | |
| 9 | State transition: voting -> closed (200) | YES | |
| 10 | Invalid transition: draft -> closed (400) | YES | |
| 11 | Problem delete as admin (200) | YES | Also verifies 404 after delete. |
| 12 | Title required validation (400) | YES | |
| -- | **Extra**: Invalid transition: draft -> voting (400) | YES | Extra coverage of invalid state machine path. |

#### C4: submissions.test.js (Design: 13 cases, Implemented: 13 cases)

| # | Design Test Case | Status | Notes |
|---|-----------------|--------|-------|
| 1 | Normal submission create (201) | YES | |
| 2 | JWT submission rejected (401) | YES | |
| 3 | No auth submission (401) | YES | |
| 4 | **Inactive agent submission (403)** | **NO** | Design case #4 is missing. No test for submitting with a deactivated agent. |
| 5 | Non-open problem submission (422) | YES | |
| 6 | Duplicate submission (409) | YES | |
| 7 | Missing problem_id (400) | YES | |
| 8 | Missing title (400) | YES | |
| 9 | Title > 300 chars (400) | YES | |
| 10 | Submission list without auth (200 + pagination) | YES | |
| 11 | Submission list with problem_id filter (200) | YES | |
| 12 | Submission detail (200 + vote_count) | YES | |
| 13 | Non-existent submission (404) | YES | |
| -- | **Extra**: Invalid agent token (401) | YES | Tests `tc_agent_invalidtoken12345`. Good addition. |

#### C5: votes.test.js (Design: 10 cases, Implemented: 10 cases)

| # | Design Test Case | Status | Notes |
|---|-----------------|--------|-------|
| 1 | JWT user vote (201) | YES | |
| 2 | Cookie anonymous vote (201) | YES | Note: test does not explicitly set a voterId cookie -- it relies on the auth middleware to auto-assign one. |
| 3 | Duplicate JWT vote (409) | YES | |
| 4 | Duplicate cookie vote (409) | YES | Uses conditional logic (`if (voterIdCookie)`) which could silently pass if no cookie is set. |
| 5 | Non-voting/open state vote (422) | YES | Tests with 'closed' state. |
| 6 | Non-existent submission vote (404) | YES | |
| 7 | Missing submission_id (400) | YES | |
| 8 | Vote summary aggregation (200) | YES | Tests 3:1 vote ratio. |
| 9 | Non-existent problem summary (404) | YES | |
| 10 | Percentage calculation verification | YES | Tests 50/50 split, verifies total=100%. |

#### C6: upload.test.js (Design: 5 cases, Implemented: 8 cases)

| # | Design Test Case | Status | Notes |
|---|-----------------|--------|-------|
| 1 | JPEG upload as admin (201) | YES | Checks url, key, content_type, size. |
| 2 | Non-admin upload (403) | YES | |
| 3 | No auth upload (401) | YES | |
| 4 | Non-allowed file format (400) | YES | |
| 5 | No file attached (400) | YES | |
| -- | **Extra**: PNG upload (201) | YES | Tests a second valid format. |
| -- | **Extra**: SVG upload rejected (400) | YES | Tests disallowed image subtype. |
| -- | **Extra**: agent_owner upload rejected (403) | YES | Tests another non-admin role. |

### Phase D: CI/CD

| # | Requirement | Status | Notes |
|---|------------|--------|-------|
| D1 | `.github/workflows/ci.yml` updated | YES | Complete rewrite from old structure. |
| D2 | PostgreSQL 15 service container | YES | `postgres:15` with health checks. |
| D3 | Correct env vars (NODE_ENV, DATABASE_URL, JWT_SECRET, STORAGE_MODE) | YES | All present. |
| D4 | `JWT_EXPIRES_IN` env var in CI | NO | Design specifies `JWT_EXPIRES_IN: 1h` in CI env. Not set in implementation. Fallback in `setup.js` covers this (`process.env.JWT_EXPIRES_IN || '1h'`), so tests still work. |
| D5 | Node.js 18 setup | YES | `node-version: 18`. |
| D6 | `npm ci` install | YES | Uses `cd apps/api && npm ci`. |
| D7 | `npm test` execution | YES | |
| D8 | `npm run test:coverage` execution | YES | |
| D9 | Coverage artifact upload | NO | Design specifies `actions/upload-artifact@v4` step to upload coverage report with 7-day retention. Not implemented. |
| D10 | Separate health-check job | NO | Design specifies a second `health-check` job that depends on `test`, starts the server in development mode, and runs `curl --fail http://localhost:3000/health`. Implementation inlines the health check at the end of the test job instead of a separate job. The inline approach works but is different from design (single job vs two jobs). |
| D11 | `npm cache` with `cache-dependency-path` | NO | Design specifies `cache: 'npm'` with `cache-dependency-path: apps/api/package-lock.json` in setup-node step. Not implemented. CI runs will be slower without npm caching. |
| D12 | Branch triggers | YES | `push` on `main`, `feature/**`, `feat/**`; `pull_request` on `main`. Slightly broader than design (`feature/*` vs `feature/**`, `feat/**`) -- implementation is more permissive, which is fine. |
| D13 | POSTGRES_DB matches test DB name | YES | `POSTGRES_DB: titleclash_test` matches `DATABASE_URL` DB name. Design had `POSTGRES_DB: titleclash` (mismatch); implementation fixed this. |
| D14 | Health check uses production-mode server start | YES | Sets `NODE_ENV=production` before starting server so listen() executes. |
| D15 | `.gitignore` updated for coverage and test uploads | YES | Both `apps/api/coverage/` and `apps/api/uploads/test-*` entries added. |

---

## Issues Found

### SEVERE
None.

### WARNING

**W1: Missing test case -- Inactive agent submission (submissions.test.js)**
- Design case #4 specifies testing that a deactivated (inactive) agent receives 403 when attempting to submit. This test is not present. This is a meaningful gap in agent lifecycle security testing.

**W2: Cookie-based duplicate vote test has conditional logic (votes.test.js:103)**
- The duplicate cookie vote test wraps the assertion in `if (voterIdCookie)`. If the API does not set a `voterId` cookie in the response (e.g., due to a regression), the test silently passes without verifying duplicate rejection. This weakens the test's reliability as a regression detector.

**W3: CI missing npm cache configuration**
- Without `cache: 'npm'` and `cache-dependency-path`, every CI run will do a full `npm ci` download. This increases CI runtime and could cause flaky builds under slow network conditions.

### MINOR

**M1: CORS environment variable naming mismatch (corsConfig.js:12)**
- Design specifies `CORS_ORIGINS` (plural) but implementation checks `CORS_ORIGIN` (singular). If deployment docs or `.env.example` reference `CORS_ORIGINS`, the variable won't be read. Low impact for development but could cause production CORS issues.

**M2: `NODE_ENV=test` not in package.json test scripts**
- Design specifies `NODE_ENV=test jest ...` but implementation omits the prefix. This is mitigated by `jest.config.js` setting `process.env.NODE_ENV = 'test'` and is actually a cross-platform improvement (Unix `NODE_ENV=test` syntax does not work on Windows). The config-level approach is arguably better. Classified as minor rather than a bug.

**M3: CI missing coverage artifact upload step**
- Design specifies `actions/upload-artifact@v4` to preserve coverage reports. Without this, coverage data is only visible in CI logs and not downloadable as an artifact.

**M4: CI health check is inline rather than a separate job**
- Design has a two-job workflow (`test` then `health-check`). Implementation runs the health check at the end of the single `test` job. This means the health check runs within the test environment (NODE_ENV=test) context and must override it. The implementation correctly sets `NODE_ENV=production` for the server start, so it works, but the approach differs from design.

**M5: `JWT_EXPIRES_IN` not set in CI env block**
- Covered by `setup.js` fallback, but explicit CI configuration is cleaner and matches design intent.

**M6: Optional validation rules not added to validate.js**
- `integer`, `url`, `nohtml` rules from design section 4.5.1 are not implemented. Design marked these as optional ("선택적 수정"), so this is purely informational.

**M7: Validate middleware not added to submission/vote routes**
- Design section 4.5.2 specifies adding `validate()` middleware to `POST /submissions` and `POST /votes` routes. Not implemented. Controller-level validation handles these checks currently. Design itself notes dual validation is fine, but the route-level middleware was part of the design spec.

**M8: Package versions differ from design**
- Design: `jest@^29.7.0`, `supertest@^6.3.3`. Implementation: `jest@^30.2.0`, `supertest@^7.2.2`. Both are major version bumps. This is likely intentional (latest stable versions) and is acceptable, but should be noted for reproducibility.

---

## Test Case Coverage Analysis

| Test File | Design Cases | Implemented Cases | Missing | Extra |
|-----------|:---:|:---:|---------|-------|
| auth.test.js | 10 | 12 | 0 | +2 (JWT validation tests) |
| agents.test.js | 12 | 13 | 0 | +1 (token invalidation after regen) |
| problems.test.js | 12 | 13 | 0 | +1 (draft->voting invalid transition) |
| submissions.test.js | 13 | 13 | 1 (inactive agent) | +1 (invalid token) |
| votes.test.js | 10 | 10 | 0 | 0 |
| upload.test.js | 5 | 8 | 0 | +3 (PNG, SVG, agent_owner) |
| **TOTAL** | **62** | **69** | **1** | **+8** |

---

## Recommendations

1. **Add the missing inactive agent submission test** (W1): Create a test in `submissions.test.js` that deactivates an agent via `DELETE /api/v1/agents/:id` and then verifies that the deactivated agent's token receives a 403 when trying to submit. This is an important security boundary.

2. **Fix the conditional cookie vote test** (W2): Remove the `if (voterIdCookie)` guard and make the test fail explicitly if no cookie is set. Either assert that the cookie exists first, or inject a known `voterId` cookie manually.

3. **Add npm cache to CI** (W3): Add `cache: 'npm'` and `cache-dependency-path: apps/api/package-lock.json` to the `actions/setup-node@v4` step.

4. **Standardize the CORS env variable name** (M1): Change `CORS_ORIGIN` to `CORS_ORIGINS` in `corsConfig.js` to match the design document, or document the singular form as canonical.

5. **Add coverage artifact upload to CI** (M3): Add the `actions/upload-artifact@v4` step to preserve coverage reports across CI runs for trend tracking.

6. **Consider adding route-level validation middleware** (M7): While controller-level validation works, adding `validate()` middleware to routes provides an earlier rejection point and cleaner separation of concerns, as designed.

---

> **PDCA Status**: Plan -> Design (Sprint 4) -> Do (Sprint 4) -> **Check (Sprint 4)** -- Act (next)
