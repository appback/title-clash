# Sprint 1 상세 설계서 - 스키마 통합 & 에이전트 인증

> 작성일: 2026-02-11
> 프로젝트: title-clash
> 스프린트: Sprint 1
> 선행 문서: `.bkit/pdca/PLAN.md`, `docs/architecture/ARCHITECTURE.md`

---

## 1. DB 마이그레이션 계획

### 1.1 현재 스키마 (As-Is)

```
users(id, name, created_at)
titles(id, title, author_id, status, created_at)
matches(id, title_a_id, title_b_id, status, created_at)
votes(id, match_id, title_id, voter_id, created_at)
```

### 1.2 목표 스키마 (To-Be)

```
users(id, name, role, created_at)
agents(id, name, api_token, owner_id, is_active, meta, created_at, updated_at)
problems(id, title, image_url, description, state, created_by, start_at, end_at, created_at, updated_at)
submissions(id, problem_id, agent_id, title, metadata, status, created_at)
votes(id, submission_id, voter_id, voter_token, weight, created_at)
rewards(id, agent_id, problem_id, points, reason, issued_at)
```

### 1.3 마이그레이션 전략

**원칙:** 기존 `titles`, `matches` 테이블은 즉시 삭제하지 않는다. 새 테이블을 먼저 생성한 후, 다음 마이그레이션에서 데이터를 이전하고, 최종적으로 레거시 테이블을 제거한다.

**마이그레이션 파일 순서:**
1. `002_create_agents.sql` - agents 테이블 생성, users에 role 컬럼 추가
2. `003_create_problems.sql` - problems 테이블 생성
3. `004_create_submissions.sql` - submissions 테이블 생성
4. `005_update_votes.sql` - votes 테이블 스키마 변경
5. `006_create_rewards.sql` - rewards 테이블 생성
6. `007_migrate_legacy_data.sql` - 레거시 데이터 이전 (titles -> submissions, matches -> problems)
7. `008_drop_legacy_tables.sql` - 레거시 테이블 제거 (matches, titles)

### 1.4 마이그레이션 SQL

#### 파일: `db/migrations/002_create_agents.sql`

```sql
-- Sprint 1: agents 테이블 생성 및 users 역할 추가

-- users 테이블에 role 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'voter';
-- role 값: 'voter' (일반 사용자), 'admin' (운영자), 'agent_owner' (에이전트 소유자)

-- agents 테이블
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_token TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS agents_api_token_idx ON agents(api_token);
CREATE INDEX IF NOT EXISTS agents_owner_id_idx ON agents(owner_id);
CREATE INDEX IF NOT EXISTS agents_is_active_idx ON agents(is_active) WHERE is_active = true;
```

#### 파일: `db/migrations/003_create_problems.sql`

```sql
-- Sprint 1: problems 테이블 생성

CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  state TEXT NOT NULL DEFAULT 'draft',
  -- state 값: 'draft', 'open', 'voting', 'closed', 'archived'
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS problems_state_idx ON problems(state);
CREATE INDEX IF NOT EXISTS problems_created_by_idx ON problems(created_by);
CREATE INDEX IF NOT EXISTS problems_start_at_idx ON problems(start_at);
CREATE INDEX IF NOT EXISTS problems_end_at_idx ON problems(end_at);

-- state 유효값 제약
ALTER TABLE problems ADD CONSTRAINT problems_state_check
  CHECK (state IN ('draft', 'open', 'voting', 'closed', 'archived'));
```

#### 파일: `db/migrations/004_create_submissions.sql`

```sql
-- Sprint 1: submissions 테이블 생성

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  -- status 값: 'active', 'disqualified', 'winner'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS submissions_problem_id_idx ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS submissions_agent_id_idx ON submissions(agent_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions(status);

-- 동일 에이전트가 동일 문제에 동일 제목을 중복 제출 방지
CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_agent_problem_title
  ON submissions(agent_id, problem_id, title);

-- status 유효값 제약
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('active', 'disqualified', 'winner'));
```

#### 파일: `db/migrations/005_update_votes.sql`

```sql
-- Sprint 1: votes 테이블 스키마 변경
-- 기존 votes 테이블을 새 스키마로 교체
-- 기존 데이터가 있으면 보존 후 이전

-- 새 votes 테이블 생성 (기존 테이블 리네임 후)
ALTER TABLE votes RENAME TO votes_legacy;

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  voter_token TEXT,
  -- voter_token: 비로그인 사용자의 익명 투표 토큰 (쿠키 기반)
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS votes_submission_id_idx ON votes(submission_id);
CREATE INDEX IF NOT EXISTS votes_voter_id_idx ON votes(voter_id);
CREATE INDEX IF NOT EXISTS votes_voter_token_idx ON votes(voter_token);

-- 한 사용자가 한 제출물에 한 번만 투표 (로그인 사용자)
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_voter_submission
  ON votes(submission_id, voter_id) WHERE voter_id IS NOT NULL;

-- 한 익명 토큰이 한 제출물에 한 번만 투표
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_token_submission
  ON votes(submission_id, voter_token) WHERE voter_token IS NOT NULL;
```

#### 파일: `db/migrations/006_create_rewards.sql`

```sql
-- Sprint 1: rewards 테이블 생성

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'round_winner',
  -- reason 값: 'round_winner', 'runner_up', 'participation', 'bonus'
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS rewards_agent_id_idx ON rewards(agent_id);
CREATE INDEX IF NOT EXISTS rewards_problem_id_idx ON rewards(problem_id);
CREATE INDEX IF NOT EXISTS rewards_issued_at_idx ON rewards(issued_at);
```

#### 파일: `db/migrations/007_migrate_legacy_data.sql`

```sql
-- Sprint 1: 레거시 데이터 이전
-- 주의: 이 마이그레이션은 기존 titles/matches 데이터를 새 구조로 이전
-- 실행 전 반드시 DB 백업 필수

-- 1. 기존 titles 데이터를 submissions로 이전하려면
--    agent가 필요하므로 '레거시' 에이전트를 먼저 생성
INSERT INTO agents (id, name, api_token, owner_id, is_active, meta)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'legacy-migration-agent',
  'legacy-token-do-not-use',
  NULL,
  false,
  '{"note": "레거시 titles 데이터 이전용 더미 에이전트"}'
)
ON CONFLICT (api_token) DO NOTHING;

-- 2. 기존 matches를 problems로 이전
--    각 match를 하나의 problem으로 변환
INSERT INTO problems (id, title, state, created_at, updated_at)
SELECT
  id,
  'Legacy Match ' || id::text,
  CASE
    WHEN status = 'open' THEN 'closed'
    ELSE 'archived'
  END,
  created_at,
  created_at
FROM matches
ON CONFLICT (id) DO NOTHING;

-- 3. 기존 titles를 submissions로 이전
--    problem_id 연결이 필요하므로, matches를 통해 연결
INSERT INTO submissions (id, problem_id, agent_id, title, status, created_at)
SELECT
  t.id,
  m.id AS problem_id,
  '00000000-0000-0000-0000-000000000001' AS agent_id,
  t.title,
  'active',
  t.created_at
FROM titles t
JOIN matches m ON m.title_a_id = t.id OR m.title_b_id = t.id
ON CONFLICT (id) DO NOTHING;

-- 참고: votes_legacy -> votes 이전은 submission_id 매핑이 복잡하므로
-- 레거시 투표 데이터는 보존하되 새 시스템으로는 이전하지 않음
-- votes_legacy 테이블에 그대로 유지
```

#### 파일: `db/migrations/008_drop_legacy_tables.sql`

```sql
-- Sprint 1 (최종): 레거시 테이블 제거
-- 주의: 이 마이그레이션은 되돌릴 수 없음. 반드시 007 이후 데이터 확인 후 실행

-- 레거시 테이블 DROP
DROP TABLE IF EXISTS votes_legacy CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS titles CASCADE;
```

### 1.5 마이그레이션 실행 전략

1. **로컬 환경**: 모든 마이그레이션을 순차 실행하여 검증
2. **스테이징**: 007까지만 실행, 데이터 정합성 확인
3. **프로덕션**: 007까지 실행 후 1주일 모니터링, 이후 008 실행
4. **롤백 계획**: 각 마이그레이션 파일에 대응하는 `down` SQL 준비

---

## 2. API 엔드포인트 설계

### 2.1 URL 구조 변경

**현재:**
```
/api/titles
/api/matches
/api/stats
```

**목표:**
```
/api/v1/agents
/api/v1/problems
/api/v1/submissions
/api/v1/votes
/api/v1/rewards
/api/v1/stats
/api/v1/auth
```

**하위 호환성:** 기존 `/api/titles`, `/api/matches` 경로는 deprecated 경고를 포함하여 일정 기간 유지하되, 내부적으로 새 로직으로 위임한다.

### 2.2 전체 엔드포인트 목록

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/auth/register` | 공개 | 사용자/에이전트 소유자 등록 |
| POST | `/api/v1/auth/login` | 공개 | 로그인 (JWT 발급) |
| POST | `/api/v1/agents` | admin, agent_owner | 에이전트 등록 (API 토큰 발급) |
| GET | `/api/v1/agents` | admin | 에이전트 목록 조회 |
| GET | `/api/v1/agents/:id` | admin, 본인 | 에이전트 상세 조회 |
| PATCH | `/api/v1/agents/:id` | admin, 본인 | 에이전트 정보 수정 |
| POST | `/api/v1/agents/:id/regenerate-token` | admin, 본인 | API 토큰 재발급 |
| DELETE | `/api/v1/agents/:id` | admin | 에이전트 비활성화 |
| POST | `/api/v1/problems` | admin | 문제(이미지) 등록 |
| GET | `/api/v1/problems` | 공개 | 문제 목록 조회 |
| GET | `/api/v1/problems/:id` | 공개 | 문제 상세 조회 |
| PATCH | `/api/v1/problems/:id` | admin | 문제 수정 (상태 변경 포함) |
| DELETE | `/api/v1/problems/:id` | admin | 문제 삭제 |
| POST | `/api/v1/submissions` | agent | 제목 제출 |
| GET | `/api/v1/submissions` | 공개 | 제출물 목록 (문제별 필터) |
| GET | `/api/v1/submissions/:id` | 공개 | 제출물 상세 |
| POST | `/api/v1/votes` | voter, 익명 | 투표 |
| GET | `/api/v1/votes/summary/:problemId` | 공개 | 문제별 투표 집계 |
| GET | `/api/v1/rewards` | admin, agent_owner | 보상 내역 조회 |
| GET | `/api/v1/rewards/agent/:agentId` | admin, 본인 | 에이전트별 보상 조회 |
| GET | `/api/v1/stats/top` | 공개 | 상위 에이전트 순위 |
| GET | `/api/v1/stats/problems/:id` | 공개 | 문제별 통계 |

### 2.3 요청/응답 스키마 상세

#### POST `/api/v1/auth/register`

사용자 등록. 에이전트 소유자 등록 시 role을 명시.

```
요청 헤더: Content-Type: application/json
요청 본문:
{
  "name": "홍길동",
  "email": "hong@example.com",
  "password": "securePassword123",
  "role": "voter"            // "voter" | "agent_owner"
}

성공 응답 (201):
{
  "id": "uuid",
  "name": "홍길동",
  "role": "voter",
  "token": "jwt-token-here",
  "created_at": "2026-02-11T00:00:00Z"
}

실패 응답:
- 400: { "error": "VALIDATION_ERROR", "message": "name은 필수입니다" }
- 409: { "error": "DUPLICATE_EMAIL", "message": "이미 등록된 이메일입니다" }
```

#### POST `/api/v1/auth/login`

```
요청 본문:
{
  "email": "hong@example.com",
  "password": "securePassword123"
}

성공 응답 (200):
{
  "token": "jwt-token-here",
  "user": {
    "id": "uuid",
    "name": "홍길동",
    "role": "voter"
  }
}

실패 응답:
- 401: { "error": "INVALID_CREDENTIALS", "message": "이메일 또는 비밀번호가 올바르지 않습니다" }
```

#### POST `/api/v1/agents`

에이전트 등록. agent_owner 또는 admin 권한 필요.

```
요청 헤더:
  Content-Type: application/json
  Authorization: Bearer <jwt-token>

요청 본문:
{
  "name": "GPT-Title-Agent",
  "meta": {
    "model": "gpt-4",
    "version": "1.0",
    "description": "이미지에서 창의적 제목을 생성하는 에이전트"
  }
}

성공 응답 (201):
{
  "id": "uuid",
  "name": "GPT-Title-Agent",
  "api_token": "tc_agent_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "owner_id": "owner-uuid",
  "is_active": true,
  "meta": { "model": "gpt-4", "version": "1.0", "description": "..." },
  "created_at": "2026-02-11T00:00:00Z"
}

주의: api_token은 생성 시에만 전체 값을 반환. 이후 조회 시에는 마스킹 처리.

실패 응답:
- 400: { "error": "VALIDATION_ERROR", "message": "name은 필수입니다" }
- 401: { "error": "UNAUTHORIZED", "message": "인증이 필요합니다" }
- 403: { "error": "FORBIDDEN", "message": "에이전트 등록 권한이 없습니다" }
```

#### GET `/api/v1/agents`

```
요청 헤더:
  Authorization: Bearer <jwt-token>   (admin 전용)

쿼리 파라미터:
  ?page=1&limit=20&active=true

성공 응답 (200):
{
  "data": [
    {
      "id": "uuid",
      "name": "GPT-Title-Agent",
      "api_token": "tc_agent_xxxx...xxxx",     // 마스킹
      "owner_id": "owner-uuid",
      "is_active": true,
      "meta": {},
      "created_at": "2026-02-11T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

#### POST `/api/v1/agents/:id/regenerate-token`

```
요청 헤더:
  Authorization: Bearer <jwt-token>

성공 응답 (200):
{
  "id": "uuid",
  "api_token": "tc_agent_yyyyyyyyyyyyyyyyyyyyyyyyyyyy",
  "message": "새 토큰이 발급되었습니다. 기존 토큰은 즉시 무효화됩니다."
}
```

#### POST `/api/v1/problems`

```
요청 헤더:
  Content-Type: application/json
  Authorization: Bearer <jwt-token>   (admin 전용)

요청 본문:
{
  "title": "해변의 석양",
  "image_url": "https://s3.amazonaws.com/title-clash/images/sunset.jpg",
  "description": "해변에서 찍은 석양 사진입니다. 창의적인 제목을 지어주세요.",
  "start_at": "2026-02-12T09:00:00Z",
  "end_at": "2026-02-12T21:00:00Z"
}

성공 응답 (201):
{
  "id": "uuid",
  "title": "해변의 석양",
  "image_url": "https://...",
  "description": "...",
  "state": "draft",
  "created_by": "admin-uuid",
  "start_at": "2026-02-12T09:00:00Z",
  "end_at": "2026-02-12T21:00:00Z",
  "created_at": "2026-02-11T00:00:00Z"
}

실패 응답:
- 400: { "error": "VALIDATION_ERROR", "message": "title은 필수입니다" }
- 403: { "error": "FORBIDDEN", "message": "관리자 권한이 필요합니다" }
```

#### GET `/api/v1/problems`

```
쿼리 파라미터:
  ?state=open&page=1&limit=20

성공 응답 (200):
{
  "data": [
    {
      "id": "uuid",
      "title": "해변의 석양",
      "image_url": "https://...",
      "state": "open",
      "start_at": "2026-02-12T09:00:00Z",
      "end_at": "2026-02-12T21:00:00Z",
      "submission_count": 15,
      "created_at": "2026-02-11T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

#### PATCH `/api/v1/problems/:id`

```
요청 헤더:
  Authorization: Bearer <jwt-token>   (admin 전용)

요청 본문 (부분 업데이트):
{
  "state": "open"
}

성공 응답 (200):
{
  "id": "uuid",
  "title": "해변의 석양",
  "state": "open",
  "updated_at": "2026-02-11T01:00:00Z"
}

실패 응답:
- 400: { "error": "INVALID_STATE_TRANSITION", "message": "draft에서 voting으로 직접 전환할 수 없습니다" }
```

#### POST `/api/v1/submissions`

에이전트 전용. Authorization 헤더에 에이전트 API 토큰 사용.

```
요청 헤더:
  Content-Type: application/json
  Authorization: Bearer tc_agent_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

요청 본문:
{
  "problem_id": "problem-uuid",
  "title": "황금빛 바다의 마지막 인사",
  "metadata": {
    "confidence": 0.92,
    "model": "gpt-4",
    "generation_time_ms": 1200
  }
}

성공 응답 (201):
{
  "id": "submission-uuid",
  "problem_id": "problem-uuid",
  "agent_id": "agent-uuid",
  "title": "황금빛 바다의 마지막 인사",
  "metadata": { "confidence": 0.92 },
  "status": "active",
  "created_at": "2026-02-11T00:00:00Z"
}

실패 응답:
- 400: { "error": "VALIDATION_ERROR", "message": "title은 1~300자여야 합니다" }
- 401: { "error": "INVALID_TOKEN", "message": "유효하지 않은 에이전트 토큰입니다" }
- 403: { "error": "AGENT_INACTIVE", "message": "비활성화된 에이전트입니다" }
- 404: { "error": "PROBLEM_NOT_FOUND", "message": "존재하지 않는 문제입니다" }
- 409: { "error": "DUPLICATE_SUBMISSION", "message": "동일한 제목이 이미 제출되었습니다" }
- 422: { "error": "PROBLEM_NOT_OPEN", "message": "제출 기간이 아닙니다" }
- 429: { "error": "RATE_LIMIT", "message": "제출 빈도 제한을 초과했습니다" }
```

#### GET `/api/v1/submissions`

```
쿼리 파라미터:
  ?problem_id=uuid&page=1&limit=20

성공 응답 (200):
{
  "data": [
    {
      "id": "submission-uuid",
      "problem_id": "problem-uuid",
      "agent_id": "agent-uuid",
      "agent_name": "GPT-Title-Agent",
      "title": "황금빛 바다의 마지막 인사",
      "status": "active",
      "vote_count": 42,
      "created_at": "2026-02-11T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

#### POST `/api/v1/votes`

```
요청 헤더:
  Content-Type: application/json
  Authorization: Bearer <jwt-token>     (선택 - 로그인 사용자)

요청 본문:
{
  "submission_id": "submission-uuid"
}

주의: voter_id는 JWT에서 추출. 비로그인 시 쿠키 기반 voter_token 사용.

성공 응답 (201):
{
  "id": "vote-uuid",
  "submission_id": "submission-uuid",
  "created_at": "2026-02-11T00:00:00Z"
}

실패 응답:
- 400: { "error": "VALIDATION_ERROR", "message": "submission_id는 필수입니다" }
- 404: { "error": "SUBMISSION_NOT_FOUND", "message": "존재하지 않는 제출물입니다" }
- 409: { "error": "ALREADY_VOTED", "message": "이미 이 제출물에 투표했습니다" }
- 422: { "error": "VOTING_CLOSED", "message": "투표 기간이 종료되었습니다" }
```

#### GET `/api/v1/votes/summary/:problemId`

```
성공 응답 (200):
{
  "problem_id": "problem-uuid",
  "total_votes": 156,
  "submissions": [
    {
      "submission_id": "uuid",
      "title": "황금빛 바다의 마지막 인사",
      "agent_name": "GPT-Title-Agent",
      "vote_count": 42,
      "percentage": 26.9
    },
    {
      "submission_id": "uuid",
      "title": "노을 속으로",
      "agent_name": "Claude-Poet",
      "vote_count": 38,
      "percentage": 24.4
    }
  ]
}
```

#### GET `/api/v1/rewards`

```
요청 헤더:
  Authorization: Bearer <jwt-token>

쿼리 파라미터:
  ?agent_id=uuid&page=1&limit=20

성공 응답 (200):
{
  "data": [
    {
      "id": "reward-uuid",
      "agent_id": "agent-uuid",
      "agent_name": "GPT-Title-Agent",
      "problem_id": "problem-uuid",
      "problem_title": "해변의 석양",
      "points": 100,
      "reason": "round_winner",
      "issued_at": "2026-02-12T22:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

### 2.4 공통 에러 응답 형식

모든 에러 응답은 아래 형식을 따른다:

```json
{
  "error": "ERROR_CODE",
  "message": "사람이 읽을 수 있는 설명",
  "details": {}           // 선택: 추가 정보 (검증 오류 상세 등)
}
```

HTTP 상태 코드:
- `400` - 요청 형식 오류 / 검증 실패
- `401` - 인증 실패 (토큰 없음/만료/무효)
- `403` - 권한 부족
- `404` - 리소스 없음
- `409` - 충돌 (중복 등)
- `422` - 비즈니스 로직 오류 (상태 전이 불가 등)
- `429` - 요청 빈도 초과
- `500` - 서버 내부 오류

---

## 3. 파일 구조 계획

### 3.1 현재 디렉터리 구조

```
apps/api/
  server.js
  store.js
  db/
    index.js
  middleware/
    auth.js
  routes/
    index.js
    titles.js
    matches.js
    stats.js
  controllers/
    titles.js
    matches.js
db/
  migrations/
    init.sql
```

### 3.2 목표 디렉터리 구조

```
apps/api/
  server.js                          [수정] /api/v1 마운트 추가
  store.js                           [유지] 향후 제거 예정
  db/
    index.js                         [유지]
  middleware/
    auth.js                          [수정] 기존 쿠키 로직 유지 + JWT/토큰 분기
    agentAuth.js                     [신규] 에이전트 API 토큰 검증 미들웨어
    adminAuth.js                     [신규] 관리자 권한 검증 미들웨어
    errorHandler.js                  [신규] 공통 에러 핸들러
    validate.js                      [신규] 요청 검증 미들웨어
  routes/
    index.js                         [수정] v1 라우터 추가, 레거시 라우트 유지
    v1/
      index.js                       [신규] v1 라우트 루트
      auth.js                        [신규] 인증 라우트
      agents.js                      [신규] 에이전트 관리 라우트
      problems.js                    [신규] 문제 라우트
      submissions.js                 [신규] 제출 라우트
      votes.js                       [신규] 투표 라우트
      rewards.js                     [신규] 보상 라우트
      stats.js                       [신규] 통계 라우트
    titles.js                        [유지] deprecated, 호환용
    matches.js                       [유지] deprecated, 호환용
    stats.js                         [유지] deprecated, 호환용
  controllers/
    titles.js                        [유지] deprecated, 호환용
    matches.js                       [유지] deprecated, 호환용
    v1/
      auth.js                        [신규] 사용자 등록/로그인 로직
      agents.js                      [신규] 에이전트 CRUD 로직
      problems.js                    [신규] 문제 CRUD 로직
      submissions.js                 [신규] 제출 로직
      votes.js                       [신규] 투표 로직
      rewards.js                     [신규] 보상 조회 로직
      stats.js                       [신규] 통계 집계 로직
  utils/
    token.js                         [신규] 토큰 생성/검증 유틸리티
    pagination.js                    [신규] 페이지네이션 헬퍼
    errors.js                        [신규] 에러 클래스 정의
db/
  migrations/
    init.sql                         [유지]
    002_create_agents.sql            [신규]
    003_create_problems.sql          [신규]
    004_create_submissions.sql       [신규]
    005_update_votes.sql             [신규]
    006_create_rewards.sql           [신규]
    007_migrate_legacy_data.sql      [신규]
    008_drop_legacy_tables.sql       [신규]
  migrate.js                         [신규] 마이그레이션 실행 스크립트
```

### 3.3 신규 파일 상세

#### `apps/api/utils/token.js`
- `generateAgentToken()` - `tc_agent_` 접두사 + crypto.randomBytes(32) hex
- `generateJWT(payload)` - jsonwebtoken으로 JWT 생성
- `verifyJWT(token)` - JWT 검증
- `hashToken(token)` - bcrypt로 API 토큰 해싱 (DB 저장용)

#### `apps/api/utils/errors.js`
- `AppError` 클래스 (statusCode, errorCode, message)
- `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError` 등 서브클래스

#### `apps/api/utils/pagination.js`
- `parsePagination(query)` - page, limit 파싱 (기본값: page=1, limit=20, max=100)
- `formatPaginatedResponse(data, total, page, limit)` - 표준 응답 포맷

#### `apps/api/middleware/agentAuth.js`
- Bearer 토큰 추출 → `tc_agent_` 접두사 확인 → DB에서 agents 테이블 조회 → `req.agent` 할당

#### `apps/api/middleware/adminAuth.js`
- JWT 디코드 → users 테이블에서 role 확인 → admin이 아니면 403

#### `apps/api/middleware/errorHandler.js`
- Express 4 에러 핸들링 미들웨어 `(err, req, res, next)`
- AppError 인스턴스이면 해당 상태 코드, 아니면 500

#### `apps/api/middleware/validate.js`
- 요청 본문 검증 팩토리 함수
- 예: `validate({ title: 'required|string|max:300', problem_id: 'required|uuid' })`

#### `db/migrate.js`
- migrations 디렉터리의 SQL 파일을 이름 순으로 실행
- `schema_migrations` 테이블로 실행 이력 관리
- `node db/migrate.js up` / `node db/migrate.js status`

### 3.4 수정 파일 상세

#### `apps/api/server.js` 수정 사항
```javascript
// 변경 전
app.use('/api', routes)

// 변경 후
const v1Routes = require('./routes/v1')
const errorHandler = require('./middleware/errorHandler')

app.use('/api', routes)          // 레거시 호환
app.use('/api/v1', v1Routes)     // 새 v1 API
app.use(errorHandler)            // 공통 에러 핸들러
```

#### `apps/api/routes/index.js` 수정 사항
```javascript
// 레거시 라우트에 deprecation 경고 헤더 추가
router.use('/titles', (req, res, next) => {
  res.set('Deprecation', 'true')
  res.set('Link', '</api/v1/submissions>; rel="successor-version"')
  next()
}, titles)
```

#### `apps/api/middleware/auth.js` 수정 사항
```javascript
// 기존 쿠키 기반 voterId 로직 유지
// 추가: Authorization 헤더가 있으면 JWT 디코드 시도
// JWT가 있으면 req.user 할당, 없으면 기존 쿠키 로직 실행
```

---

## 4. 에이전트 인증 설계

### 4.1 인증 체계 개요

시스템에는 3가지 인증 주체가 있다:

| 주체 | 인증 방식 | 토큰 형식 | 용도 |
|------|-----------|-----------|------|
| 에이전트 | API 토큰 (Bearer) | `tc_agent_<64자 hex>` | 제목 제출 |
| 관리자/에이전트 소유자 | JWT (Bearer) | `eyJ...` (표준 JWT) | 관리 작업 |
| 일반 사용자 (익명) | 쿠키 | `voterId` 쿠키 (UUID) | 투표 |

### 4.2 에이전트 토큰 생성 흐름

```
[에이전트 소유자] --JWT인증--> POST /api/v1/agents
                                    |
                                    v
                             토큰 생성 로직:
                             1. crypto.randomBytes(32).toString('hex')
                             2. 접두사 추가: "tc_agent_" + hex
                             3. SHA-256 해시값을 DB에 저장
                             4. 원본 토큰을 응답으로 1회만 반환
                                    |
                                    v
                             agents 테이블에 저장:
                             { id, name, api_token: SHA256(원본), owner_id, ... }
                                    |
                                    v
                             응답: { api_token: "tc_agent_원본..." }
```

**보안 원칙:**
- DB에는 토큰의 SHA-256 해시만 저장 (원본 저장 금지)
- 토큰 전체 값은 생성 시 1회만 반환
- 이후 조회 시에는 `tc_agent_xxxx...xxxx` 형태로 마스킹

### 4.3 에이전트 토큰 검증 흐름

```
[에이전트] --Bearer 토큰--> agentAuth 미들웨어
                                |
                                v
                          1. Authorization 헤더 파싱
                          2. "tc_agent_" 접두사 확인
                          3. 토큰 SHA-256 해싱
                          4. agents 테이블에서 해시 매칭 조회
                                |
                          +-----+-----+
                          |           |
                       일치함      불일치
                          |           |
                          v           v
                    is_active 확인   401 반환
                          |
                    +-----+-----+
                    |           |
                  활성        비활성
                    |           |
                    v           v
              req.agent 할당   403 반환
              next() 호출
```

### 4.4 JWT 인증 흐름 (관리자/에이전트 소유자)

```
[사용자] --POST /api/v1/auth/login--> 로그인 로직
                                          |
                                          v
                                    1. email + password 검증
                                    2. JWT 생성:
                                       payload: { userId, role, iat, exp }
                                       secret: process.env.JWT_SECRET
                                       만료: 24시간
                                          |
                                          v
                                    응답: { token: "eyJ...", user: {...} }
```

### 4.5 미들웨어 적용 매트릭스

```javascript
// routes/v1/index.js 에서의 미들웨어 적용

const { jwtAuth, optionalJwtAuth } = require('../../middleware/auth')
const agentAuth = require('../../middleware/agentAuth')
const adminAuth = require('../../middleware/adminAuth')

// 공개 라우트 (인증 불필요)
router.use('/auth', authRoutes)
router.get('/problems', problemsRoutes.list)
router.get('/problems/:id', problemsRoutes.get)
router.get('/submissions', submissionsRoutes.list)
router.get('/submissions/:id', submissionsRoutes.get)
router.get('/votes/summary/:problemId', votesRoutes.summary)
router.get('/stats', statsRoutes)

// 에이전트 전용 (API 토큰)
router.post('/submissions', agentAuth, submissionsRoutes.create)

// 로그인 사용자 (JWT)
router.post('/votes', optionalJwtAuth, votesRoutes.create)

// 에이전트 소유자 (JWT + role 확인)
router.post('/agents', jwtAuth, agentsRoutes.create)
router.get('/agents/:id', jwtAuth, agentsRoutes.get)
router.patch('/agents/:id', jwtAuth, agentsRoutes.update)
router.post('/agents/:id/regenerate-token', jwtAuth, agentsRoutes.regenerateToken)

// 관리자 전용 (JWT + admin role)
router.get('/agents', jwtAuth, adminAuth, agentsRoutes.list)
router.delete('/agents/:id', jwtAuth, adminAuth, agentsRoutes.delete)
router.post('/problems', jwtAuth, adminAuth, problemsRoutes.create)
router.patch('/problems/:id', jwtAuth, adminAuth, problemsRoutes.update)
router.delete('/problems/:id', jwtAuth, adminAuth, problemsRoutes.delete)
router.get('/rewards', jwtAuth, adminAuth, rewardsRoutes.list)
```

### 4.6 토큰 관련 환경변수

```env
JWT_SECRET=<최소 32자 랜덤 문자열>
JWT_EXPIRES_IN=24h
AGENT_TOKEN_PREFIX=tc_agent_
```

### 4.7 users 테이블 확장 (인증 지원)

Sprint 1에서 인증을 위해 users 테이블에 추가할 컬럼:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'voter';

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email) WHERE email IS NOT NULL;
```

이 변경은 `002_create_agents.sql` 마이그레이션에 함께 포함한다.

---

## 5. 구현 순서

### Phase A: 인프라 준비 (의존성 없음)

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| A-1 | 공통 유틸리티 생성 | `apps/api/utils/errors.js` | 없음 |
| A-2 | 페이지네이션 헬퍼 생성 | `apps/api/utils/pagination.js` | 없음 |
| A-3 | 토큰 유틸리티 생성 | `apps/api/utils/token.js` | 없음 |
| A-4 | 에러 핸들러 미들웨어 생성 | `apps/api/middleware/errorHandler.js` | A-1 |
| A-5 | 검증 미들웨어 생성 | `apps/api/middleware/validate.js` | A-1 |
| A-6 | 마이그레이션 실행기 생성 | `db/migrate.js` | 없음 |

### Phase B: DB 마이그레이션 (Phase A-6 완료 후)

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| B-1 | users 확장 + agents 테이블 생성 | `db/migrations/002_create_agents.sql` | A-6 |
| B-2 | problems 테이블 생성 | `db/migrations/003_create_problems.sql` | B-1 |
| B-3 | submissions 테이블 생성 | `db/migrations/004_create_submissions.sql` | B-2 |
| B-4 | votes 테이블 변경 | `db/migrations/005_update_votes.sql` | B-3 |
| B-5 | rewards 테이블 생성 | `db/migrations/006_create_rewards.sql` | B-4 |
| B-6 | 레거시 데이터 이전 | `db/migrations/007_migrate_legacy_data.sql` | B-5 |
| B-7 | 레거시 테이블 제거 | `db/migrations/008_drop_legacy_tables.sql` | B-6 + 검증 완료 |

### Phase C: 인증 시스템 (Phase A 완료 후)

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| C-1 | JWT 인증 미들웨어 (auth.js 수정) | `apps/api/middleware/auth.js` | A-3 |
| C-2 | 에이전트 인증 미들웨어 | `apps/api/middleware/agentAuth.js` | A-3, B-1 |
| C-3 | 관리자 권한 미들웨어 | `apps/api/middleware/adminAuth.js` | C-1 |
| C-4 | 인증 컨트롤러 (register, login) | `apps/api/controllers/v1/auth.js` | C-1, B-1 |
| C-5 | 인증 라우트 | `apps/api/routes/v1/auth.js` | C-4 |

### Phase D: 핵심 API 구현 (Phase B, C 완료 후)

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| D-1 | 에이전트 컨트롤러 (CRUD) | `apps/api/controllers/v1/agents.js` | B-1, C-2 |
| D-2 | 에이전트 라우트 | `apps/api/routes/v1/agents.js` | D-1 |
| D-3 | 문제 컨트롤러 (CRUD) | `apps/api/controllers/v1/problems.js` | B-2, C-3 |
| D-4 | 문제 라우트 | `apps/api/routes/v1/problems.js` | D-3 |
| D-5 | 제출 컨트롤러 | `apps/api/controllers/v1/submissions.js` | B-3, C-2 |
| D-6 | 제출 라우트 | `apps/api/routes/v1/submissions.js` | D-5 |
| D-7 | 투표 컨트롤러 | `apps/api/controllers/v1/votes.js` | B-4, C-1 |
| D-8 | 투표 라우트 | `apps/api/routes/v1/votes.js` | D-7 |
| D-9 | 보상 컨트롤러 | `apps/api/controllers/v1/rewards.js` | B-5, C-3 |
| D-10 | 보상 라우트 | `apps/api/routes/v1/rewards.js` | D-9 |
| D-11 | 통계 컨트롤러 | `apps/api/controllers/v1/stats.js` | B-3, B-4 |
| D-12 | 통계 라우트 | `apps/api/routes/v1/stats.js` | D-11 |

### Phase E: 통합 (Phase D 완료 후)

| 순서 | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| E-1 | v1 라우트 루트 (모든 v1 라우트 마운트) | `apps/api/routes/v1/index.js` | D 전체 |
| E-2 | server.js 수정 (v1 마운트 + 에러 핸들러) | `apps/api/server.js` | E-1, A-4 |
| E-3 | 레거시 라우트 deprecation 헤더 추가 | `apps/api/routes/index.js` | E-2 |

### Phase F: 검증 (Phase E 완료 후)

| 순서 | 작업 | 설명 | 의존성 |
|------|------|------|--------|
| F-1 | 에이전트 등록 → 토큰 발급 → 제출 E2E 테스트 | 수동 또는 스크립트 | E 전체 |
| F-2 | 관리자 문제 생성 → 상태 전이 테스트 | | F-1 |
| F-3 | 투표 → 집계 테스트 | | F-2 |
| F-4 | 레거시 엔드포인트 호환성 확인 | | F-1 |

### 의존성 다이어그램

```
Phase A (유틸리티/인프라)
  |
  +---> Phase B (DB 마이그레이션)
  |         |
  |         v
  +---> Phase C (인증 시스템) --+
            |                   |
            v                   v
        Phase D (핵심 API 구현)
                |
                v
        Phase E (통합)
                |
                v
        Phase F (검증)
```

### 예상 소요 시간

| Phase | 예상 시간 | 누적 |
|-------|-----------|------|
| A | 2시간 | 2시간 |
| B | 2시간 | 4시간 |
| C | 3시간 | 7시간 |
| D | 6시간 | 13시간 |
| E | 1시간 | 14시간 |
| F | 2시간 | 16시간 |

---

## 6. 상태 전이 규칙

### 6.1 Problem 상태 전이

```
draft --> open --> voting --> closed --> archived
  |                                        ^
  +-------- (직접 archived로 전이 가능) ---+
```

| 현재 상태 | 허용 전이 | 트리거 |
|-----------|-----------|--------|
| draft | open | 관리자 수동 / start_at 도달 |
| open | voting | 관리자 수동 / 제출 마감 시간 |
| open | archived | 관리자가 취소 |
| voting | closed | 관리자 수동 / end_at 도달 |
| closed | archived | 보상 처리 완료 후 |
| draft | archived | 관리자가 취소 |

### 6.2 Submission 상태 전이

```
active --> winner
active --> disqualified
```

---

## 7. 환경변수 추가 목록

```env
# 인증 관련 (신규)
JWT_SECRET=<32자 이상 랜덤 문자열>
JWT_EXPIRES_IN=24h

# 기존 유지
DATABASE_URL=postgres://postgres:postgres@localhost:5432/titleclash
PORT=3000
```

---

## 8. 패키지 의존성 추가

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3"
  }
}
```

기존 의존성 (`express`, `body-parser`, `cookie-parser`, `pg`, `uuid`)은 유지.

---

## 9. 성공 기준 (Sprint 1 DoD)

- [ ] 모든 마이그레이션 SQL이 오류 없이 실행됨
- [ ] `POST /api/v1/auth/register` 로 사용자 등록 가능
- [ ] `POST /api/v1/auth/login` 으로 JWT 발급 가능
- [ ] `POST /api/v1/agents` 로 에이전트 등록 및 API 토큰 발급 가능
- [ ] 에이전트 API 토큰으로 `POST /api/v1/submissions` 제출 가능
- [ ] 유효하지 않은 토큰으로 접근 시 401 반환
- [ ] 권한 부족 시 403 반환
- [ ] `POST /api/v1/problems` 로 관리자가 문제 생성 가능
- [ ] 기존 `/api/titles`, `/api/matches` 엔드포인트가 여전히 동작 (하위 호환)
- [ ] `GET /api/v1/problems`, `GET /api/v1/submissions` 공개 조회 가능
- [ ] `POST /api/v1/votes` 로 투표 가능 (로그인/익명 모두)

---

> **PDCA 상태**: Plan -> **Design** -> Do -> Check -> Act
>
> 구현을 시작하려면 Phase A부터 순서대로 진행합니다.
