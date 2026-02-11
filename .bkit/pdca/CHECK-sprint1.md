# Sprint 1 검증 보고서 (Check Report)

> 검증일: 2026-02-11
> 검증 대상: DESIGN-sprint1.md vs 실제 구현 코드
> 검증자: CHECK Agent (PDCA Sprint 1)

---

## 검증 요약

- **Match Rate: 88%** (구현된 항목 44개 / 설계 항목 50개)
- 총 설계 항목: 50개
- 구현 완료: 44개
- 갭 발견: 6개 (심각 2개, 중간 2개, 경미 2개)

---

## 상세 검증 결과

### 1. DB 스키마 [PASS]

모든 7개 마이그레이션 파일(`002` ~ `008`)이 설계 문서 섹션 1.4의 SQL과 정확히 일치한다.

| 마이그레이션 파일 | 상태 | 비고 |
|---|---|---|
| `002_create_agents.sql` | PASS | users role/email/password_hash 컬럼 추가 + agents 테이블 + 인덱스 3개. 설계 섹션 4.7의 email/password_hash 요구사항도 이 파일에 포함되어 있음. 설계와 완전 일치. |
| `003_create_problems.sql` | PASS | problems 테이블 + 인덱스 4개 + state CHECK 제약. 설계와 완전 일치. |
| `004_create_submissions.sql` | PASS | submissions 테이블 + 인덱스 3개 + UNIQUE 인덱스 + status CHECK 제약. 설계와 완전 일치. |
| `005_update_votes.sql` | PASS | votes_legacy 리네임 + 새 votes 테이블 + 인덱스 3개 + UNIQUE 부분 인덱스 2개. 설계와 완전 일치. |
| `006_create_rewards.sql` | PASS | rewards 테이블 + 인덱스 3개. 설계와 완전 일치. |
| `007_migrate_legacy_data.sql` | PASS | 레거시 에이전트 생성 + matches->problems + titles->submissions 이전. 설계와 완전 일치. |
| `008_drop_legacy_tables.sql` | PASS | votes_legacy, matches, titles DROP. 설계와 완전 일치. |

**To-Be 스키마 일치 확인:**
- `users(id, name, role, email, password_hash, created_at)` -- email, password_hash는 설계 섹션 4.7에 명시됨. PASS.
- `agents(id, name, api_token, owner_id, is_active, meta, created_at, updated_at)` -- PASS.
- `problems(id, title, image_url, description, state, created_by, start_at, end_at, created_at, updated_at)` -- PASS.
- `submissions(id, problem_id, agent_id, title, metadata, status, created_at)` -- PASS.
- `votes(id, submission_id, voter_id, voter_token, weight, created_at)` -- PASS.
- `rewards(id, agent_id, problem_id, points, reason, issued_at)` -- PASS.

### 2. API 엔드포인트 [PASS]

설계 섹션 2.2의 22개 엔드포인트 전수 확인:

| # | 메서드 | 경로 | 구현 위치 | 상태 |
|---|--------|------|-----------|------|
| 1 | POST | `/api/v1/auth/register` | `controllers/v1/auth.js:register` | PASS |
| 2 | POST | `/api/v1/auth/login` | `controllers/v1/auth.js:login` | PASS |
| 3 | POST | `/api/v1/agents` | `controllers/v1/agents.js:create` | PASS |
| 4 | GET | `/api/v1/agents` | `controllers/v1/agents.js:list` | PASS |
| 5 | GET | `/api/v1/agents/:id` | `controllers/v1/agents.js:get` | PASS |
| 6 | PATCH | `/api/v1/agents/:id` | `controllers/v1/agents.js:update` | PASS |
| 7 | POST | `/api/v1/agents/:id/regenerate-token` | `controllers/v1/agents.js:regenerateToken` | PASS |
| 8 | DELETE | `/api/v1/agents/:id` | `controllers/v1/agents.js:remove` | PASS |
| 9 | POST | `/api/v1/problems` | `controllers/v1/problems.js:create` | PASS |
| 10 | GET | `/api/v1/problems` | `controllers/v1/problems.js:list` | PASS |
| 11 | GET | `/api/v1/problems/:id` | `controllers/v1/problems.js:get` | PASS |
| 12 | PATCH | `/api/v1/problems/:id` | `controllers/v1/problems.js:update` | PASS |
| 13 | DELETE | `/api/v1/problems/:id` | `controllers/v1/problems.js:remove` | PASS |
| 14 | POST | `/api/v1/submissions` | `controllers/v1/submissions.js:create` | PASS |
| 15 | GET | `/api/v1/submissions` | `controllers/v1/submissions.js:list` | PASS |
| 16 | GET | `/api/v1/submissions/:id` | `controllers/v1/submissions.js:get` | PASS |
| 17 | POST | `/api/v1/votes` | `controllers/v1/votes.js:create` | PASS |
| 18 | GET | `/api/v1/votes/summary/:problemId` | `controllers/v1/votes.js:summary` | PASS |
| 19 | GET | `/api/v1/rewards` | `controllers/v1/rewards.js:list` | PASS |
| 20 | GET | `/api/v1/rewards/agent/:agentId` | `controllers/v1/rewards.js:getByAgent` | PASS |
| 21 | GET | `/api/v1/stats/top` | `controllers/v1/stats.js:top` | PASS |
| 22 | GET | `/api/v1/stats/problems/:id` | `controllers/v1/stats.js:problemStats` | PASS |

22/22 엔드포인트 구현 확인.

### 3. 인증 시스템 [PASS - 경미 이슈 1건]

**3-1. 에이전트 토큰 (tc_agent_ + SHA-256 해시):**
- `utils/token.js:generateAgentToken()` -- `tc_agent_` + `crypto.randomBytes(32).toString('hex')` = 64자 hex. PASS.
- `utils/token.js:hashToken()` -- SHA-256 해시. PASS.
- `utils/token.js:compareToken()` -- `crypto.timingSafeEqual` 사용. 타이밍 공격 방지. PASS.
- `middleware/agentAuth.js` -- Bearer 추출 -> `tc_agent_` 접두사 확인 -> hashToken -> DB 조회 -> is_active 확인. PASS.

**3-2. JWT 인증:**
- `utils/token.js:generateJWT()` -- JWT_SECRET + JWT_EXPIRES_IN 환경변수 사용. PASS.
- `utils/token.js:verifyJWT()` -- jwt.verify 사용. PASS.
- `middleware/auth.js:jwtAuth` -- Authorization 헤더 필수, Bearer 파싱, 에이전트 토큰 거부, JWT 검증 후 req.user 할당. PASS.
- `middleware/auth.js:optionalJwtAuth` -- JWT 있으면 파싱, 없으면 쿠키 기반 voterId. PASS.

**3-3. 쿠키 인증 (익명 투표):**
- `middleware/auth.js:auth` -- voterId 쿠키 확인/생성. PASS.
- `middleware/auth.js:optionalJwtAuth` -- voterId 쿠키 처리도 포함. PASS.

**경미 이슈:** 설계 섹션 3.3에서 `hashToken`에 대해 "bcrypt로 API 토큰 해싱"이라고 기술했으나, 섹션 4.2/4.3에서는 "SHA-256 해시값을 DB에 저장"이라고 기술. 설계 내부 모순이 있으나, 실제 구현은 SHA-256을 사용 (섹션 4.2/4.3과 일치). SHA-256은 토큰 검증에 bcrypt보다 적절한 선택이므로 합리적 판단으로 봄.

### 4. 미들웨어 매트릭스 [PASS]

설계 섹션 4.5의 미들웨어 매트릭스와 `routes/v1/index.js` 비교:

| 라우트 | 설계 미들웨어 | 구현 미들웨어 | 상태 |
|--------|------------|-------------|------|
| `/auth` | 없음 (공개) | 없음 | PASS |
| `GET /problems` | 없음 (공개) | 없음 | PASS |
| `GET /problems/:id` | 없음 (공개) | 없음 | PASS |
| `POST /problems` | jwtAuth, adminAuth | jwtAuth, adminAuth | PASS |
| `PATCH /problems/:id` | jwtAuth, adminAuth | jwtAuth, adminAuth | PASS |
| `DELETE /problems/:id` | jwtAuth, adminAuth | jwtAuth, adminAuth | PASS |
| `GET /submissions` | 없음 (공개) | 없음 | PASS |
| `GET /submissions/:id` | 없음 (공개) | 없음 | PASS |
| `POST /submissions` | agentAuth | agentAuth | PASS |
| `POST /votes` | optionalJwtAuth | optionalJwtAuth | PASS |
| `GET /votes/summary/:problemId` | 없음 (공개) | 없음 | PASS |
| `GET /stats` | 없음 (공개) | 없음 | PASS |
| `POST /agents` | jwtAuth | jwtAuth | PASS |
| `GET /agents` | jwtAuth, adminAuth | jwtAuth, adminAuth | PASS |
| `GET /agents/:id` | jwtAuth | jwtAuth | PASS |
| `PATCH /agents/:id` | jwtAuth | jwtAuth | PASS |
| `POST /agents/:id/regenerate-token` | jwtAuth | jwtAuth | PASS |
| `DELETE /agents/:id` | jwtAuth, adminAuth | jwtAuth, adminAuth | PASS |
| `GET /rewards` | jwtAuth, adminAuth | jwtAuth, adminAuth | PASS |
| `GET /rewards/agent/:agentId` | jwtAuth (설계에는 명시 없으나 "admin, 본인" 권한) | jwtAuth | PASS |

`routes/v1/index.js`는 설계의 미들웨어 매트릭스와 정확히 일치한다. 단, 개별 라우트 파일(agents.js, problems.js 등)에도 동일 라우트가 정의되어 있으나, `v1/index.js`에서 컨트롤러를 직접 참조하므로 이중 라우트 문제는 없음.

### 5. 에러 핸들링 [FAIL - 심각 이슈 1건]

**5-1. 에러 클래스 정의 (PASS):**
- `AppError(statusCode, errorCode, message)` -- 생성자 시그니처 확인. PASS.
- 서브클래스: `ValidationError(400)`, `NotFoundError(404)`, `UnauthorizedError(401)`, `ForbiddenError(403)`, `ConflictError(409)`, `RateLimitError(429)`. 설계 섹션 2.4의 HTTP 상태 코드와 일치. PASS.

**5-2. 에러 핸들러 미들웨어 (PASS):**
- `errorHandler.js` -- AppError 인스턴스면 toJSON(), 아니면 500. 설계 섹션 3.3과 일치. PASS.
- `server.js`에서 모든 라우트 뒤에 등록. PASS.

**5-3. 에러 응답 형식 (PASS):**
- `{ "error": "ERROR_CODE", "message": "...", "details": {} }` 형식. ValidationError의 toJSON()에 details 포함. PASS.

**5-4. AppError 생성자 인자 순서 오류 (FAIL):**

`AppError`의 생성자 시그니처는 `(statusCode, errorCode, message)` 이다. 그러나 3개 파일에서 인자 순서를 **반대로** 전달하고 있다:

- `controllers/v1/problems.js` 148행:
  ```javascript
  throw new AppError(
    `Cannot transition from '${problem.state}' to '${state}'...`,  // <-- message
    400,                                                             // <-- statusCode
    'INVALID_STATE_TRANSITION'                                       // <-- errorCode
  )
  ```
  올바른 호출: `new AppError(400, 'INVALID_STATE_TRANSITION', message)`

- `controllers/v1/submissions.js` 41행:
  ```javascript
  throw new AppError(
    'Problem is not open for submissions',  // <-- message
    422,                                     // <-- statusCode
    'PROBLEM_NOT_OPEN'                       // <-- errorCode
  )
  ```

- `controllers/v1/votes.js` 39행:
  ```javascript
  throw new AppError(
    'Voting is not open for this problem',  // <-- message
    422,                                     // <-- statusCode
    'VOTING_CLOSED'                          // <-- errorCode
  )
  ```

**결과:** 이 3곳에서 `err.statusCode`에 에러 메시지 문자열이 들어가고, `err.errorCode`에 숫자가 들어가며, `err.message`에 에러코드 문자열이 들어간다. `errorHandler.js`에서 `res.status(err.statusCode)`를 호출할 때 문자열이 전달되므로 Express가 `500` 또는 예상치 못한 상태 코드를 반환하게 된다. 또한 응답 JSON의 `error` 필드에 `400`/`422` 숫자가 들어가고, `message` 필드에 `'INVALID_STATE_TRANSITION'` 등의 코드 문자열이 들어간다.

### 6. 상태 전이 [PASS]

설계 섹션 6.1의 Problem 상태 전이 규칙:

| 현재 상태 | 허용 전이 (설계) | 구현 (`VALID_TRANSITIONS`) | 상태 |
|-----------|-----------------|--------------------------|------|
| draft | open, archived | open, archived | PASS |
| open | voting, archived | voting, archived | PASS |
| voting | closed | closed | PASS |
| closed | archived | archived | PASS |
| archived | 없음 | [] (빈 배열) | PASS |

상태 전이 검증 로직이 `problems.js:update`에서 올바르게 구현됨.
단, 위 항목 5에서 지적한 AppError 인자 순서 문제로 인해 실제로 상태 전이 실패 시 올바른 HTTP 상태 코드가 반환되지 않음.

### 7. 보안 [PASS]

**7-1. 파라미터화 쿼리 (PASS):**
전체 코드에서 SQL 쿼리에 `$1`, `$2` 등의 파라미터 바인딩만 사용. 문자열 보간을 통한 SQL 인젝션 위험 없음.

- `controllers/v1/auth.js` -- `$1`, `$2`, `$3`, `$4` 바인딩. PASS.
- `controllers/v1/agents.js` -- 동적 쿼리 빌드 시에도 `$${paramIdx}` 사용. PASS.
- `controllers/v1/problems.js` -- 동적 쿼리 빌드 시에도 `$${paramIdx}` 사용. PASS.
- `controllers/v1/submissions.js` -- 모든 쿼리 파라미터화. PASS.
- `controllers/v1/votes.js` -- 트랜잭션 내 모든 쿼리 파라미터화. PASS.
- `controllers/v1/rewards.js` -- 모든 쿼리 파라미터화. PASS.
- `controllers/v1/stats.js` -- 모든 쿼리 파라미터화. PASS.

**7-2. 토큰 해싱 (PASS):**
- 에이전트 토큰은 SHA-256 해시 후 DB 저장 (`agents.js:create`, `agents.js:regenerateToken`).
- 검증 시 해시 비교에 `crypto.timingSafeEqual` 사용 (`token.js:compareToken`).
- 단, `agentAuth.js`에서는 `hashToken`으로 해시 후 직접 `WHERE api_token = $1`로 비교. `compareToken`을 사용하지 않아 timingSafeEqual의 이점이 무효화되어 있음 (경미).

**7-3. 비밀번호 해싱 (PASS):**
- bcryptjs로 `BCRYPT_ROUNDS = 10`으로 해싱 (`auth.js:register`).
- `bcrypt.compare`로 검증 (`auth.js:login`). PASS.

**7-4. 토큰 마스킹 (PASS):**
- 에이전트 토큰 목록/상세 조회 시 `maskToken()` 함수로 마스킹. PASS.
- 생성/재발급 시에만 원본 반환. PASS.

### 8. 레거시 호환성 [PASS]

**8-1. Deprecation 헤더 (PASS):**
`routes/index.js`에서 `/titles`, `/matches`, `/stats` 경로에:
- `Deprecation: true` 헤더 설정. PASS.
- `Sunset: Sat, 01 Aug 2026 00:00:00 GMT` 헤더 설정 (설계에는 명시 없으나 추가적으로 좋은 관행). PASS.
- `Link: </api/v1/...>; rel="successor-version"` 헤더 설정. PASS.

**8-2. 레거시 라우트 유지 (PASS):**
`server.js`에서 `app.use('/api', routes)`로 기존 라우트 유지. PASS.

### 9. 패키지 의존성 [PASS]

설계 섹션 8의 요구사항:

| 패키지 | 요구 버전 | 실제 버전 | 상태 |
|--------|-----------|----------|------|
| jsonwebtoken | ^9.0.0 | ^9.0.0 | PASS |
| bcryptjs | ^2.4.3 | ^2.4.3 | PASS |
| express | (기존 유지) | ^4.18.2 | PASS |
| body-parser | (기존 유지) | ^1.20.2 | PASS |
| cookie-parser | (기존 유지) | ^1.4.6 | PASS |
| pg | (기존 유지) | ^8.11.0 | PASS |
| uuid | (기존 유지) | ^9.0.0 | PASS |

### 10. 코드 품질 [FAIL - 중간 이슈 2건]

**10-1. CommonJS 일관성 (PASS):**
모든 파일이 `require()`/`module.exports` 사용. ESM 혼재 없음. PASS.

**10-2. async/await 에러 핸들링 (PASS):**
모든 컨트롤러 함수가 `try/catch`로 감싸고 `catch(err) { next(err) }` 패턴 사용. PASS.
`votes.js:create`는 트랜잭션 사용 시 `finally { client.release() }` 포함. PASS.

**10-3. rewards/getByAgent 권한 검증 누락 (FAIL):**
설계 섹션 2.2에서 `GET /api/v1/rewards/agent/:agentId` 엔드포인트의 권한은 "admin, 본인"으로 명시. 그러나 `controllers/v1/rewards.js:getByAgent` 함수에서 요청한 사용자가 admin인지 또는 해당 에이전트의 owner인지 확인하는 로직이 없음. `jwtAuth` 미들웨어만 적용되므로 로그인한 모든 사용자가 아무 에이전트의 보상 내역을 조회할 수 있다.

**10-4. agentAuth에서 compareToken 미사용 (FAIL):**
`utils/token.js`에 timingSafeEqual 기반의 `compareToken()` 함수가 구현되어 있으나, `middleware/agentAuth.js`에서는 이를 사용하지 않고 `hashToken(token)`으로 해시 후 DB의 `WHERE api_token = $1`로 직접 비교한다. DB 쿼리 방식은 기능적으로 동작하지만, `compareToken`이 구현된 목적이 무효화됨. 이 자체는 보안 결함은 아니나 (DB 쿼리 자체가 상수 시간은 아니므로), 설계 의도와 구현 간의 불일치.

---

## 발견된 갭 (Issues)

| # | 심각도 | 영역 | 설명 | 설계 내용 | 구현 상태 |
|---|--------|------|------|-----------|-----------|
| 1 | **심각** | 에러 핸들링 | `AppError` 생성자 인자 순서 오류 (3개 파일) | `new AppError(statusCode, errorCode, message)` | `new AppError(message, statusCode, errorCode)` 로 호출 -- problems.js:148, submissions.js:41, votes.js:39 |
| 2 | **심각** | 권한 검증 | `rewards/getByAgent`에서 권한 확인 누락 | "admin, 본인" 만 접근 가능 | JWT 인증만 확인, admin/owner 구분 없음 |
| 3 | **중간** | 보안 | `agentAuth.js`에서 `compareToken()` 미사용 | `compareToken()`의 timingSafeEqual 보안 이점 | DB WHERE 쿼리로 직접 비교 (기능적으로 동작하나 설계 의도와 불일치) |
| 4 | **중간** | 설계 불일치 | 설계 내부 모순: hashToken 해싱 방식 | 섹션 3.3: "bcrypt로 해싱" vs 섹션 4.2/4.3: "SHA-256 해시" | SHA-256 구현 (섹션 4.2/4.3과 일치, 기술적으로 올바른 선택) |
| 5 | **경미** | 에러 코드 | `ConflictError` 에러코드가 설계 응답과 불일치 | `DUPLICATE_EMAIL` (register), `DUPLICATE_SUBMISSION`, `ALREADY_VOTED` 등 구체적 코드 | 일괄 `CONFLICT` 코드 사용 |
| 6 | **경미** | 에러 메시지 | `UnauthorizedError` 로그인 실패 시 에러코드 | 설계: `INVALID_CREDENTIALS` | 구현: `UNAUTHORIZED` (일반적 에러코드 사용) |

---

## 코드 품질 이슈

### 버그 (반드시 수정 필요)

1. **AppError 인자 순서 뒤바뀜 (3곳)** -- 이 버그로 인해 상태 전이 실패, 문제 미오픈 상태 제출, 투표 마감 시 HTTP 응답이 의도와 다르게 전달됨:
   - `apps/api/controllers/v1/problems.js` 148행
   - `apps/api/controllers/v1/submissions.js` 41행
   - `apps/api/controllers/v1/votes.js` 39행

   **예상 결과:** `res.status(문자열)`이 호출되어 Express가 기본 500 에러를 반환하거나, NaN 상태 코드로 비정상 동작. 응답 JSON의 `error` 필드에 숫자가, `message` 필드에 에러 코드 문자열이 들어감.

### 미흡 사항 (권장 수정)

2. **rewards/getByAgent 권한 검사 미구현** -- `controllers/v1/rewards.js:getByAgent`에 다음 로직 추가 필요:
   ```javascript
   const agent = agentResult.rows[0]
   if (req.user.role !== 'admin' && req.user.userId !== agent.owner_id) {
     throw new ForbiddenError('You do not have access to this agent\'s rewards')
   }
   ```

3. **구체적 에러 코드 미사용** -- `ConflictError`의 기본 에러코드가 `CONFLICT`이지만, 설계에서는 `DUPLICATE_EMAIL`, `DUPLICATE_SUBMISSION`, `ALREADY_VOTED` 등 구체적 코드를 명시함. 현재 `ConflictError` 클래스에 커스텀 에러코드를 전달하는 방법이 없음 (생성자가 message만 받음).

### 설계 참고 사항

4. **validate.js의 in 룰에서 파이프 구분자 충돌** -- `validate({ role: 'in:voter|agent_owner' })`에서 `|`가 룰 구분자와 in 값 구분자로 이중 사용됨. 현재 구현은 `ruleString.split('|')`로 먼저 분리 후 각 룰을 처리하므로, `in:voter`와 `agent_owner`로 잘못 파싱될 수 있음. 그러나 실제 코드에서 validate 미들웨어가 라우트에 적용된 곳은 발견되지 않아 현시점에서는 잠재적 이슈로만 기록.

---

## 권장 사항

### 즉시 수정 (Sprint 1 ACT 단계)

1. **AppError 인자 순서 수정 (우선순위 1):**
   - `problems.js:148` -> `new AppError(400, 'INVALID_STATE_TRANSITION', message)`
   - `submissions.js:41` -> `new AppError(422, 'PROBLEM_NOT_OPEN', 'Problem is not open for submissions')`
   - `votes.js:39` -> `new AppError(422, 'VOTING_CLOSED', 'Voting is not open for this problem')`

2. **rewards/getByAgent 권한 검사 추가 (우선순위 1):**
   - agent의 owner_id와 req.user.userId 비교, admin 여부 확인 로직 추가.

### 후속 개선 (Sprint 2 이후)

3. **ConflictError에 커스텀 에러코드 지원 추가** -- 생성자에 errorCode 파라미터를 받도록 수정하여 `new ConflictError('DUPLICATE_EMAIL', 'Email already registered')` 형태 지원.

4. **validate 미들웨어 실제 적용** -- 현재 라우트에서 validate 미들웨어가 사용되지 않음. 컨트롤러 내에서 수동 검증 중. 일관성을 위해 라우트 수준에서 validate 미들웨어 적용 권장.

5. **agentAuth에서 compareToken 활용 검토** -- DB WHERE 방식에서 벗어나 전체 토큰 목록을 가져온 후 compareToken으로 비교하는 것은 성능상 비효율적이므로, 현재 DB 쿼리 방식이 실용적. `compareToken` 함수를 제거하거나 용도를 재정의하는 것을 권장.

---

## 결론

Sprint 1의 구현은 설계 문서의 핵심 요구사항 대부분을 충실히 반영하고 있다. **22개 전체 엔드포인트**가 구현되었고, **DB 마이그레이션 7개** 모두 설계와 완전 일치하며, **인증 3중 체계** (에이전트 토큰, JWT, 쿠키)가 올바르게 작동하며, **미들웨어 매트릭스**가 설계와 정확히 일치한다. 보안 면에서도 모든 SQL 쿼리가 파라미터화되어 있고, 토큰 해싱이 적절히 구현되어 있다.

그러나 **2건의 심각한 버그**가 발견되었다:

1. `AppError` 생성자 인자 순서가 3곳에서 뒤바뀌어 있어 상태 전이 실패, 미오픈 문제 제출, 투표 마감 시 HTTP 응답이 비정상적으로 동작한다.
2. `rewards/getByAgent` 엔드포인트에서 권한 검증이 누락되어 인증된 모든 사용자가 타인의 보상 내역을 조회할 수 있다.

이 2건은 **ACT 단계에서 즉시 수정**이 필요하며, 수정 후 Sprint 1 DoD를 충족할 수 있을 것으로 판단된다.

**전체 매치율 88%**, 심각 이슈 수정 후 예상 매치율 **96%**.

---

> **PDCA 상태**: Plan -> Design -> Do -> **Check** -> Act
>
> ACT 단계에서 위 심각 이슈 2건을 수정하고 재검증하세요.
