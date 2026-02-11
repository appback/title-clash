# title-clash Sprint 4 설계 문서: 테스트 & 보안

> 작성일: 2026-02-11
> 스프린트: Sprint 4
> 범위: [12] API 통합 테스트 작성, [13] Rate limiting / CORS / 입력 검증, [14] CI 테스트 파이프라인 강화

---

## 1. 현재 상태 요약

### 1.1 구현 완료 항목 (Sprint 1~3)
- **API 엔드포인트 22+개**: auth(register/login), agents(CRUD+토큰재발급), problems(CRUD+상태전이), submissions(생성/목록/상세), votes(생성/요약), rewards(목록/에이전트별), stats(overview/top/problem/agent), upload(이미지)
- **인증 체계**: JWT(사용자) + Agent API 토큰(`tc_agent_` 접두사 + SHA-256 해시) + 쿠키 기반 익명 voterId
- **미들웨어**: `auth`(쿠키+JWT 파싱), `jwtAuth`(JWT 필수), `optionalJwtAuth`(선택적 JWT), `agentAuth`(에이전트 토큰), `adminAuth`(관리자 권한), `validate`(입력 검증 팩토리), `errorHandler`(전역 에러 처리)
- **서비스**: `storage`(S3/로컬), `rewardDistributor`(보상 분배), `scheduler`(라운드 스케줄러)
- **DB**: PostgreSQL 15, 6개 테이블 (users, agents, problems, submissions, votes, rewards)
- **에러 체계**: AppError 클래스 계층 (ValidationError 400, NotFoundError 404, UnauthorizedError 401, ForbiddenError 403, ConflictError 409, RateLimitError 429)

### 1.2 미비 사항
- **테스트 코드**: 전무 (테스트 파일 0개, Jest/Vitest 미설치)
- **보안 미들웨어**: Rate limiting 없음, CORS 설정 없음, Helmet 없음
- **CI**: 구형 구조 참조 (`backend/` 경로), 헬스체크만 수행, 테스트 미실행, DB 서비스 없음
- **package.json**: `devDependencies` 없음, `test` 스크립트 없음

---

## 2. 테스트 프레임워크 설정

### 2.1 패키지 설치

```bash
cd apps/api
npm install --save-dev jest supertest
```

**선택 이유:**
- **Jest**: Node.js 생태계에서 가장 보편적인 테스트 프레임워크. 설정이 간단하고 assertion, mocking, 코드 커버리지가 내장됨
- **Supertest**: Express 앱에 대한 HTTP 통합 테스트를 위한 표준 도구. `app` 객체를 직접 전달하여 실제 포트 없이 테스트 가능

### 2.2 디렉토리 구조

```
apps/api/
  __tests__/
    setup.js              # 전역 테스트 설정 (DB 연결, 환경변수)
    teardown.js           # 전역 테스트 정리 (DB 풀 종료)
    helpers.js            # 테스트 유틸리티 함수
    integration/
      auth.test.js        # 인증 API 테스트
      agents.test.js      # 에이전트 CRUD 테스트
      problems.test.js    # 문제 CRUD + 상태전이 테스트
      submissions.test.js # 제출 API 테스트
      votes.test.js       # 투표 API 테스트
      upload.test.js      # 이미지 업로드 테스트
  jest.config.js          # Jest 설정 파일
```

### 2.3 jest.config.js

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  globalSetup: '<rootDir>/__tests__/setup.js',
  globalTeardown: '<rootDir>/__tests__/teardown.js',
  testTimeout: 15000,
  verbose: true,
  // 커버리지 설정
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### 2.4 테스트 데이터베이스 전략

**선택: 동일 PostgreSQL 인스턴스, 별도 `titleclash_test` 데이터베이스 사용**

이유:
- 실제 PostgreSQL 동작과 100% 동일한 테스트 (SQLite와 달리 UUID, JSON, 트랜잭션 행잠금 등 동일)
- docker-compose에 이미 PostgreSQL 서비스가 있으므로 추가 비용 없음
- CI에서 GitHub Actions의 PostgreSQL 서비스 컨테이너 사용 가능

**환경 변수:**

```
# .env.test (로컬 테스트용)
NODE_ENV=test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/titleclash_test
JWT_SECRET=test-jwt-secret-for-testing-only
JWT_EXPIRES_IN=1h
STORAGE_MODE=local
```

### 2.5 전역 Setup / Teardown

**`__tests__/setup.js`** - 테스트 시작 전 1회 실행:

```js
const { Pool } = require('pg');

module.exports = async function globalSetup() {
  // 기본 연결로 test DB 생성
  const adminPool = new Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/postgres'
  });

  try {
    // 기존 test DB가 있으면 드롭 후 재생성 (깨끗한 상태 보장)
    await adminPool.query('DROP DATABASE IF EXISTS titleclash_test');
    await adminPool.query('CREATE DATABASE titleclash_test');
  } finally {
    await adminPool.end();
  }

  // test DB에 스키마 생성
  const testPool = new Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/titleclash_test'
  });

  try {
    await testPool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'voter',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE agents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        api_token VARCHAR(255) NOT NULL,
        owner_id UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE problems (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(500) NOT NULL,
        image_url TEXT,
        description TEXT,
        state VARCHAR(50) DEFAULT 'draft',
        created_by UUID REFERENCES users(id),
        start_at TIMESTAMP,
        end_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE submissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES agents(id),
        title VARCHAR(300) NOT NULL,
        metadata JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(agent_id, problem_id, title)
      );

      CREATE TABLE votes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
        voter_id UUID REFERENCES users(id),
        voter_token VARCHAR(255),
        weight INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(submission_id, voter_id),
        UNIQUE(submission_id, voter_token)
      );

      CREATE TABLE rewards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        problem_id UUID REFERENCES problems(id),
        agent_id UUID REFERENCES agents(id),
        submission_id UUID REFERENCES submissions(id),
        points INT NOT NULL,
        rank INT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } finally {
    await testPool.end();
  }
};
```

**`__tests__/teardown.js`** - 모든 테스트 완료 후 1회 실행:

```js
const { Pool } = require('pg');

module.exports = async function globalTeardown() {
  const adminPool = new Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/postgres'
  });

  try {
    await adminPool.query('DROP DATABASE IF EXISTS titleclash_test');
  } finally {
    await adminPool.end();
  }
};
```

### 2.6 테스트 헬퍼 (`__tests__/helpers.js`)

```js
const request = require('supertest');
const app = require('../server');
const db = require('../db');
const { generateAgentToken, hashToken, generateJWT } = require('../utils/token');

/**
 * 테스트 사용자 생성 (DB 직접 삽입)
 * @param {object} overrides - 기본값 덮어쓰기
 * @returns {{ id, name, email, role, token }}
 */
async function createTestUser(overrides = {}) {
  const bcrypt = require('bcryptjs');
  const defaults = {
    name: 'Test User',
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'password123',
    role: 'voter'
  };
  const data = { ...defaults, ...overrides };
  const passwordHash = await bcrypt.hash(data.password, 4); // 낮은 라운드 (테스트 속도)

  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [data.name, data.email, passwordHash, data.role]
  );

  const user = result.rows[0];
  const token = generateJWT({ userId: user.id, role: user.role });

  return { ...user, password: data.password, token };
}

/**
 * 관리자 사용자 생성
 */
async function createAdminUser(overrides = {}) {
  return createTestUser({ role: 'admin', name: 'Admin User', ...overrides });
}

/**
 * 에이전트 소유자 사용자 생성
 */
async function createAgentOwner(overrides = {}) {
  return createTestUser({ role: 'agent_owner', name: 'Agent Owner', ...overrides });
}

/**
 * 테스트 에이전트 생성 (DB 직접 삽입)
 * @param {string} ownerId - 소유자 UUID
 * @param {object} overrides - 기본값 덮어쓰기
 * @returns {{ id, name, rawToken, tokenHash }}
 */
async function createTestAgent(ownerId, overrides = {}) {
  const rawToken = generateAgentToken();
  const tokenHash = hashToken(rawToken);
  const defaults = { name: 'Test Agent' };
  const data = { ...defaults, ...overrides };

  const result = await db.query(
    `INSERT INTO agents (name, api_token, owner_id, is_active, meta)
     VALUES ($1, $2, $3, true, '{}')
     RETURNING id, name, owner_id, is_active`,
    [data.name, tokenHash, ownerId]
  );

  return { ...result.rows[0], rawToken, tokenHash };
}

/**
 * 테스트 문제 생성 (DB 직접 삽입)
 * @param {string} createdBy - 생성자 UUID
 * @param {object} overrides - 기본값 덮어쓰기
 * @returns {{ id, title, state, ... }}
 */
async function createTestProblem(createdBy, overrides = {}) {
  const defaults = {
    title: 'Test Problem',
    state: 'draft',
    image_url: 'https://example.com/test.jpg',
    description: 'A test problem'
  };
  const data = { ...defaults, ...overrides };

  const result = await db.query(
    `INSERT INTO problems (title, image_url, description, state, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.title, data.image_url, data.description, data.state, createdBy]
  );

  return result.rows[0];
}

/**
 * 테스트 제출 생성 (DB 직접 삽입)
 */
async function createTestSubmission(problemId, agentId, overrides = {}) {
  const defaults = { title: `Submission ${Date.now()}` };
  const data = { ...defaults, ...overrides };

  const result = await db.query(
    `INSERT INTO submissions (problem_id, agent_id, title, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [problemId, agentId, data.title]
  );

  return result.rows[0];
}

/**
 * 테이블 데이터 전체 삭제 (테스트 격리)
 * 외래키 순서에 맞춰 삭제
 */
async function cleanDatabase() {
  await db.query('DELETE FROM rewards');
  await db.query('DELETE FROM votes');
  await db.query('DELETE FROM submissions');
  await db.query('DELETE FROM problems');
  await db.query('DELETE FROM agents');
  await db.query('DELETE FROM users');
}

/**
 * supertest 요청에 JWT 인증 헤더 추가
 */
function authHeader(token) {
  return `Bearer ${token}`;
}

module.exports = {
  app,
  request,
  db,
  createTestUser,
  createAdminUser,
  createAgentOwner,
  createTestAgent,
  createTestProblem,
  createTestSubmission,
  cleanDatabase,
  authHeader
};
```

### 2.7 server.js 수정 사항

현재 `server.js`에서 `app.listen()`이 모듈 로드 시점에 바로 실행된다. Supertest와의 호환을 위해 **서버 시작과 앱 정의를 분리**해야 한다.

**변경 방안:**

```js
// server.js 하단 수정
const port = process.env.PORT || 3000;

// 테스트 환경에서는 listen 하지 않음 (supertest가 직접 관리)
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log('TitleClash API listening on', port);
    startScheduler();
  });
}

module.exports = app;
```

이렇게 하면 테스트에서 `const app = require('../server')` 시 포트 충돌 없이 supertest에서 사용 가능하다.

### 2.8 package.json 변경 사항

```json
{
  "scripts": {
    "start": "node server.js",
    "test": "NODE_ENV=test jest --runInBand --forceExit",
    "test:coverage": "NODE_ENV=test jest --runInBand --forceExit --coverage",
    "test:watch": "NODE_ENV=test jest --runInBand --watch"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

**`--runInBand` 사용 이유:** 통합 테스트가 공유 DB를 사용하므로 순차 실행으로 테스트 격리를 보장한다.
**`--forceExit` 사용 이유:** DB 풀이 열려 있어 Jest 프로세스가 종료되지 않는 문제를 방지한다.

---

## 3. API 통합 테스트 설계

### 3.1 auth.test.js (인증 API)

| # | 테스트 케이스 | 메서드 | 경로 | 기대 상태 | 검증 항목 |
|---|-------------|--------|------|-----------|----------|
| 1 | 정상 회원가입 | POST | /api/v1/auth/register | 201 | id, name, role, token 반환 |
| 2 | 이메일 중복 회원가입 | POST | /api/v1/auth/register | 409 | CONFLICT 에러 |
| 3 | 필수 필드 누락 (name 없음) | POST | /api/v1/auth/register | 400 | VALIDATION_ERROR |
| 4 | 비밀번호 6자 미만 | POST | /api/v1/auth/register | 400 | VALIDATION_ERROR |
| 5 | 잘못된 role 지정 | POST | /api/v1/auth/register | 400 | VALIDATION_ERROR |
| 6 | agent_owner role로 가입 | POST | /api/v1/auth/register | 201 | role=agent_owner |
| 7 | 정상 로그인 | POST | /api/v1/auth/login | 200 | token + user 객체 |
| 8 | 잘못된 비밀번호 | POST | /api/v1/auth/login | 401 | UNAUTHORIZED |
| 9 | 존재하지 않는 이메일 | POST | /api/v1/auth/login | 401 | UNAUTHORIZED |
| 10 | 필수 필드 누락 (email/password 없음) | POST | /api/v1/auth/login | 400 | VALIDATION_ERROR |

### 3.2 agents.test.js (에이전트 API)

| # | 테스트 케이스 | 메서드 | 경로 | 인증 | 기대 상태 |
|---|-------------|--------|------|------|-----------|
| 1 | 에이전트 생성 (agent_owner) | POST | /api/v1/agents | JWT(agent_owner) | 201 + api_token 반환 |
| 2 | 에이전트 생성 (admin) | POST | /api/v1/agents | JWT(admin) | 201 |
| 3 | 에이전트 생성 (voter 거부) | POST | /api/v1/agents | JWT(voter) | 403 |
| 4 | 인증 없이 에이전트 생성 | POST | /api/v1/agents | 없음 | 401 |
| 5 | 에이전트 목록 (admin) | GET | /api/v1/agents | JWT(admin) | 200 + pagination |
| 6 | 에이전트 목록 (non-admin 거부) | GET | /api/v1/agents | JWT(voter) | 403 |
| 7 | 에이전트 상세 (owner) | GET | /api/v1/agents/:id | JWT(owner) | 200 + 마스킹된 토큰 |
| 8 | 에이전트 상세 (타인 거부) | GET | /api/v1/agents/:id | JWT(other) | 403 |
| 9 | 에이전트 수정 (owner) | PATCH | /api/v1/agents/:id | JWT(owner) | 200 |
| 10 | 토큰 재발급 | POST | /api/v1/agents/:id/regenerate-token | JWT(owner) | 200 + 새 토큰 |
| 11 | 에이전트 삭제/비활성화 (admin) | DELETE | /api/v1/agents/:id | JWT(admin) | 200 + is_active=false |
| 12 | 존재하지 않는 에이전트 조회 | GET | /api/v1/agents/:id | JWT(admin) | 404 |

### 3.3 problems.test.js (문제 API)

| # | 테스트 케이스 | 메서드 | 경로 | 인증 | 기대 상태 |
|---|-------------|--------|------|------|-----------|
| 1 | 문제 생성 (admin) | POST | /api/v1/problems | JWT(admin) | 201 + state=draft |
| 2 | 문제 생성 (non-admin 거부) | POST | /api/v1/problems | JWT(voter) | 403 |
| 3 | 문제 목록 (인증 불필요) | GET | /api/v1/problems | 없음 | 200 + pagination |
| 4 | 상태 필터 목록 | GET | /api/v1/problems?state=open | 없음 | 200 |
| 5 | 문제 상세 | GET | /api/v1/problems/:id | 없음 | 200 |
| 6 | 존재하지 않는 문제 | GET | /api/v1/problems/:id | 없음 | 404 |
| 7 | 상태 전이: draft -> open | PATCH | /api/v1/problems/:id | JWT(admin) | 200 |
| 8 | 상태 전이: open -> voting | PATCH | /api/v1/problems/:id | JWT(admin) | 200 |
| 9 | 상태 전이: voting -> closed | PATCH | /api/v1/problems/:id | JWT(admin) | 200 |
| 10 | 잘못된 상태 전이: draft -> closed | PATCH | /api/v1/problems/:id | JWT(admin) | 400 + INVALID_STATE_TRANSITION |
| 11 | 문제 삭제 (admin) | DELETE | /api/v1/problems/:id | JWT(admin) | 200 |
| 12 | title 필수 검증 | POST | /api/v1/problems | JWT(admin) | 400 |

### 3.4 submissions.test.js (제출 API)

| # | 테스트 케이스 | 메서드 | 경로 | 인증 | 기대 상태 |
|---|-------------|--------|------|------|-----------|
| 1 | 정상 제출 생성 | POST | /api/v1/submissions | Agent 토큰 | 201 |
| 2 | JWT로 제출 (거부) | POST | /api/v1/submissions | JWT(user) | 401 |
| 3 | 인증 없이 제출 | POST | /api/v1/submissions | 없음 | 401 |
| 4 | 비활성 에이전트 제출 | POST | /api/v1/submissions | 비활성 Agent | 403 |
| 5 | open 상태 아닌 문제에 제출 | POST | /api/v1/submissions | Agent 토큰 | 422 + PROBLEM_NOT_OPEN |
| 6 | 중복 제출 (같은 agent, problem, title) | POST | /api/v1/submissions | Agent 토큰 | 409 + CONFLICT |
| 7 | problem_id 누락 | POST | /api/v1/submissions | Agent 토큰 | 400 |
| 8 | title 누락 | POST | /api/v1/submissions | Agent 토큰 | 400 |
| 9 | title 300자 초과 | POST | /api/v1/submissions | Agent 토큰 | 400 |
| 10 | 제출 목록 (인증 불필요) | GET | /api/v1/submissions | 없음 | 200 + pagination |
| 11 | problem_id 필터로 목록 | GET | /api/v1/submissions?problem_id=X | 없음 | 200 |
| 12 | 제출 상세 | GET | /api/v1/submissions/:id | 없음 | 200 + vote_count |
| 13 | 존재하지 않는 제출 상세 | GET | /api/v1/submissions/:id | 없음 | 404 |

### 3.5 votes.test.js (투표 API)

| # | 테스트 케이스 | 메서드 | 경로 | 인증 | 기대 상태 |
|---|-------------|--------|------|------|-----------|
| 1 | JWT 인증 사용자 투표 | POST | /api/v1/votes | JWT(voter) | 201 |
| 2 | 쿠키 익명 투표 | POST | /api/v1/votes | 쿠키(voterId) | 201 |
| 3 | 같은 제출에 중복 투표 (JWT) | POST | /api/v1/votes | JWT(voter) | 409 + CONFLICT |
| 4 | 같은 제출에 중복 투표 (쿠키) | POST | /api/v1/votes | 쿠키 | 409 + CONFLICT |
| 5 | voting/open 아닌 상태 투표 | POST | /api/v1/votes | JWT(voter) | 422 + VOTING_CLOSED |
| 6 | 존재하지 않는 제출에 투표 | POST | /api/v1/votes | JWT(voter) | 404 |
| 7 | submission_id 누락 | POST | /api/v1/votes | JWT(voter) | 400 |
| 8 | 투표 요약 조회 | GET | /api/v1/votes/summary/:problemId | 없음 | 200 + total_votes + submissions[] |
| 9 | 존재하지 않는 문제 요약 | GET | /api/v1/votes/summary/:problemId | 없음 | 404 |
| 10 | 투표 요약의 percentage 계산 검증 | GET | /api/v1/votes/summary/:problemId | 없음 | 200 + percentage 합계 |

### 3.6 upload.test.js (이미지 업로드 API)

| # | 테스트 케이스 | 메서드 | 경로 | 인증 | 기대 상태 |
|---|-------------|--------|------|------|-----------|
| 1 | 정상 이미지 업로드 (JPEG) | POST | /api/v1/upload/image | JWT(admin) | 201 + url, key |
| 2 | admin 아닌 사용자 (거부) | POST | /api/v1/upload/image | JWT(voter) | 403 |
| 3 | 인증 없이 업로드 | POST | /api/v1/upload/image | 없음 | 401 |
| 4 | 허용되지 않는 파일 형식 | POST | /api/v1/upload/image | JWT(admin) | 400 |
| 5 | 파일 없이 요청 | POST | /api/v1/upload/image | JWT(admin) | 400 |

**S3 모킹 전략:**

`STORAGE_MODE=local` 환경에서 테스트하므로 실제 S3 호출이 발생하지 않는다. 로컬 스토리지 모드에서 `uploads/` 디렉토리에 파일이 저장되며, 테스트 후 정리한다. 만약 S3 모드를 테스트해야 한다면 `jest.mock('@aws-sdk/client-s3')`로 모킹한다.

### 3.7 각 테스트 파일의 공통 구조

```js
const {
  app, request, db,
  createTestUser, createAdminUser, createAgentOwner,
  createTestAgent, createTestProblem, createTestSubmission,
  cleanDatabase, authHeader
} = require('../helpers');

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  // DB 풀 정리는 globalTeardown에서 처리
});

describe('리소스 API', () => {
  describe('POST /api/v1/리소스', () => {
    it('정상 케이스', async () => {
      // setup
      const admin = await createAdminUser();
      // act
      const res = await request(app)
        .post('/api/v1/리소스')
        .set('Authorization', authHeader(admin.token))
        .send({ ... });
      // assert
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
  });
});
```

---

## 4. 보안 강화 설계

### 4.1 패키지 설치

```bash
cd apps/api
npm install express-rate-limit cors helmet
```

### 4.2 Rate Limiting 설계

`express-rate-limit` 패키지를 사용하여 메모리 기반 Rate Limiting을 구현한다.

> **향후 확장**: Redis 스토어(`rate-limit-redis`)로 교체하면 다중 인스턴스에서도 동작. 현재는 단일 인스턴스이므로 메모리 스토어로 충분.

#### Rate Limit 정책

| 적용 대상 | 윈도우 | 최대 요청 | 키 | 적용 위치 |
|-----------|--------|----------|-----|----------|
| 전역 (Global) | 1분 | 100 | IP | `app.use()` |
| 인증 (Auth) | 1분 | 10 | IP | `/api/v1/auth/*` |
| 제출 (Submission) | 1분 | 5 | Agent Token Hash | `POST /api/v1/submissions` |
| 투표 (Vote) | 1분 | 30 | IP + voterId | `POST /api/v1/votes` |

#### 구현 파일: `middleware/rateLimiter.js`

```js
const rateLimit = require('express-rate-limit');

// 전역 Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1분
  max: 100,                    // IP당 최대 100회
  standardHeaders: true,       // RateLimit-* 헤더 포함
  legacyHeaders: false,        // X-RateLimit-* 헤더 제거
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many requests. Please try again later.'
  },
  skip: (req) => process.env.NODE_ENV === 'test'  // 테스트에서는 건너뜀
});

// 인증 엔드포인트 Rate Limiter (로그인/가입)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many authentication attempts. Please try again later.'
  },
  skip: (req) => process.env.NODE_ENV === 'test'
});

// 제출 엔드포인트 Rate Limiter
const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    // 에이전트 토큰 해시 기반 (agentAuth가 먼저 실행)
    return req.agent ? req.agent.id : req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many submissions. Please try again later.'
  },
  skip: (req) => process.env.NODE_ENV === 'test'
});

// 투표 엔드포인트 Rate Limiter
const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => {
    // 인증 사용자는 userId, 익명은 voterId+IP
    if (req.user && req.user.userId) return req.user.userId;
    return `${req.voterId || 'anon'}_${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT',
    message: 'Too many votes. Please try again later.'
  },
  skip: (req) => process.env.NODE_ENV === 'test'
});

module.exports = {
  globalLimiter,
  authLimiter,
  submissionLimiter,
  voteLimiter
};
```

### 4.3 CORS 설계

#### 구현 파일: `middleware/corsConfig.js`

```js
const cors = require('cors');

// 허용 출처 목록
const ALLOWED_ORIGINS = [
  'http://localhost:5173',     // Vite 개발 서버
  'http://localhost:3000',     // 로컬 API (프론트엔드 프록시 시)
  'http://localhost:3001',     // 프론트엔드 대체 포트
];

// 환경변수에서 추가 출처 허용
if (process.env.CORS_ORIGINS) {
  ALLOWED_ORIGINS.push(...process.env.CORS_ORIGINS.split(',').map(s => s.trim()));
}

const corsOptions = {
  origin: function (origin, callback) {
    // 서버 간 요청 (origin 없음) 또는 허용 목록에 포함된 경우 허용
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,           // 쿠키 전송 허용 (voterId 쿠키)
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400                // preflight 캐시 24시간
};

module.exports = cors(corsOptions);
```

### 4.4 Helmet (보안 헤더) 설계

```js
// server.js에 추가
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: false,  // API 서버이므로 CSP 비활성화
  crossOriginEmbedderPolicy: false
}));
```

**Helmet이 자동으로 설정하는 헤더:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (최신 브라우저는 자체 XSS 보호)
- `Strict-Transport-Security` (HTTPS 강제)
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-Permitted-Cross-Domain-Policies: none`
- `Referrer-Policy: no-referrer`

### 4.5 입력 검증 강화

현재 `validate.js`는 이미 잘 구현되어 있다. 추가할 사항:

#### 4.5.1 추가 검증 규칙

```js
// validate.js에 추가할 규칙들

case 'integer':
  if (!Number.isInteger(value) && !/^\d+$/.test(value)) {
    return `${field} must be an integer`;
  }
  break;

case 'url':
  try {
    new URL(value);
  } catch {
    return `${field} must be a valid URL`;
  }
  break;

case 'nohtml':
  if (typeof value === 'string' && /<[^>]*>/.test(value)) {
    return `${field} must not contain HTML tags`;
  }
  break;
```

#### 4.5.2 라우트별 검증 미들웨어 적용

현재 컨트롤러 내부에서 수동으로 검증하고 있다. `validate` 미들웨어를 라우트에 적용하여 검증 로직을 분리한다.

```js
// routes/v1/index.js 에서 validate 미들웨어 추가

const validate = require('../../middleware/validate');

// Submissions - 검증 미들웨어 추가
router.post('/submissions', agentAuth, validate({
  problem_id: 'required|uuid',
  title: 'required|string|min:1|max:300'
}), submissionsController.create);

// Votes - 검증 미들웨어 추가
router.post('/votes', optionalJwtAuth, validate({
  submission_id: 'required|uuid'
}), votesController.create);
```

> **참고:** 컨트롤러 내부의 기존 검증 코드는 당장 제거하지 않아도 된다. 이중 검증은 안전하며, 향후 리팩토링 시 제거한다.

### 4.6 server.js 최종 미들웨어 순서

```js
const express = require('express');
const helmet = require('helmet');
const corsMiddleware = require('./middleware/corsConfig');
const { globalLimiter } = require('./middleware/rateLimiter');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const auth = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// 1. 보안 헤더 (최우선)
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// 2. CORS (preflight 포함)
app.use(corsMiddleware);

// 3. Rate Limiting (전역)
app.use(globalLimiter);

// 4. Body 파싱
app.use(bodyParser.json({ limit: '1mb' }));
app.use(cookieParser());

// 5. 인증 (쿠키 + JWT 파싱)
app.use(auth);

// 6. 라우트 (기존 유지)
// ...

// 7. 에러 핸들러 (마지막)
app.use(errorHandler);
```

### 4.7 Rate Limiter 라우트 적용

```js
// routes/v1/auth.js 수정
const { authLimiter } = require('../../middleware/rateLimiter');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// routes/v1/index.js 수정
const { submissionLimiter, voteLimiter } = require('../../middleware/rateLimiter');

router.post('/submissions', agentAuth, submissionLimiter, submissionsController.create);
router.post('/votes', optionalJwtAuth, voteLimiter, votesController.create);
```

---

## 5. CI 파이프라인 강화

### 5.1 현재 CI 문제점

1. `backend/` 경로 참조 -> 실제 구조는 `apps/api/`
2. PostgreSQL 서비스 없음 -> DB 의존 테스트 불가
3. 헬스체크만 수행 -> 실질적 테스트 없음
4. lint 단계 없음

### 5.2 새 CI 워크플로우: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, feature/*]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: titleclash
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    env:
      NODE_ENV: test
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/titleclash_test
      JWT_SECRET: ci-test-jwt-secret
      JWT_EXPIRES_IN: 1h
      STORAGE_MODE: local

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js 18
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'
          cache-dependency-path: apps/api/package-lock.json

      - name: Install dependencies
        working-directory: apps/api
        run: npm ci

      - name: Run tests
        working-directory: apps/api
        run: npm test

      - name: Run tests with coverage
        working-directory: apps/api
        run: npm run test:coverage

      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: apps/api/coverage/
          retention-days: 7

  health-check:
    runs-on: ubuntu-latest
    needs: test

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: titleclash
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/titleclash
      JWT_SECRET: ci-test-jwt-secret
      STORAGE_MODE: local
      NODE_ENV: development

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js 18
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        working-directory: apps/api
        run: npm ci

      - name: Start server
        working-directory: apps/api
        run: |
          nohup node server.js > server.log 2>&1 &
          sleep 3

      - name: Health check
        run: curl --fail http://localhost:3000/health
```

### 5.3 CI 환경변수 정리

| 변수 | 값 | 용도 |
|------|-----|------|
| NODE_ENV | test | 스케줄러 비활성화, Rate Limit skip |
| DATABASE_URL | postgres://postgres:postgres@localhost:5432/titleclash_test | 테스트 DB |
| JWT_SECRET | ci-test-jwt-secret | 토큰 서명 |
| JWT_EXPIRES_IN | 1h | 토큰 만료 |
| STORAGE_MODE | local | S3 비활성화 |

### 5.4 .gitignore 추가 사항

```
# 테스트 커버리지
apps/api/coverage/

# 테스트 업로드 파일
apps/api/uploads/test-*
```

---

## 6. 구현 순서

### Phase A: 테스트 인프라 (예상 작업량: 중)

**목표:** Jest + Supertest 설치, 테스트 DB 설정, 헬퍼 함수, server.js 분리

**순서:**
1. `apps/api/package.json`에 devDependencies 추가 (jest, supertest)
2. `apps/api/package.json`에 test 스크립트 추가
3. `apps/api/jest.config.js` 생성
4. `apps/api/server.js` 수정: `NODE_ENV=test`일 때 `listen()` 건너뛰기
5. `apps/api/__tests__/setup.js` 생성: globalSetup (테스트 DB 생성 + 스키마)
6. `apps/api/__tests__/teardown.js` 생성: globalTeardown (테스트 DB 삭제)
7. `apps/api/__tests__/helpers.js` 생성: 테스트 유틸리티 함수
8. 빈 테스트 파일 1개 생성 후 `npm test` 실행 확인

**완료 조건:** `npm test`가 성공적으로 실행되고, 테스트 DB가 생성/삭제됨

### Phase B: 보안 미들웨어 (예상 작업량: 소)

**목표:** Rate Limiting, CORS, Helmet 미들웨어 적용

**순서:**
1. `npm install express-rate-limit cors helmet`
2. `apps/api/middleware/rateLimiter.js` 생성
3. `apps/api/middleware/corsConfig.js` 생성
4. `apps/api/server.js` 수정: helmet, cors, globalLimiter 적용 + 미들웨어 순서 재배치
5. `apps/api/routes/v1/auth.js` 수정: authLimiter 적용
6. `apps/api/routes/v1/index.js` 수정: submissionLimiter, voteLimiter 적용
7. `apps/api/middleware/validate.js` 수정: `integer`, `url`, `nohtml` 규칙 추가 (선택)
8. 수동 동작 확인 (로컬 서버 기동 후 curl/Postman)

**완료 조건:** 보안 미들웨어가 적용되고, 기존 API가 정상 동작하며, Rate Limit 헤더가 응답에 포함됨

### Phase C: API 통합 테스트 + CI 업데이트 (예상 작업량: 대)

**목표:** 6개 리소스에 대한 통합 테스트 작성 + CI 파이프라인 업데이트

**순서:**
1. `apps/api/__tests__/integration/auth.test.js` 작성 (10개 케이스)
2. `apps/api/__tests__/integration/agents.test.js` 작성 (12개 케이스)
3. `apps/api/__tests__/integration/problems.test.js` 작성 (12개 케이스)
4. `apps/api/__tests__/integration/submissions.test.js` 작성 (13개 케이스)
5. `apps/api/__tests__/integration/votes.test.js` 작성 (10개 케이스)
6. `apps/api/__tests__/integration/upload.test.js` 작성 (5개 케이스)
7. 로컬에서 전체 테스트 실행 + 커버리지 확인
8. `.github/workflows/ci.yml` 업데이트
9. `.gitignore` 업데이트 (coverage 디렉토리)
10. PR 생성 후 CI 실행 확인

**완료 조건:** 62개 테스트 케이스 전체 통과, CI에서 PostgreSQL 서비스 컨테이너와 함께 테스트 자동 실행, 커버리지 70% 이상

---

## 7. 파일 변경 요약

### 새로 생성할 파일 (10개)
| 파일 경로 | 설명 |
|-----------|------|
| `apps/api/jest.config.js` | Jest 설정 |
| `apps/api/__tests__/setup.js` | 글로벌 테스트 셋업 (DB 생성) |
| `apps/api/__tests__/teardown.js` | 글로벌 테스트 정리 (DB 삭제) |
| `apps/api/__tests__/helpers.js` | 테스트 헬퍼 함수 |
| `apps/api/__tests__/integration/auth.test.js` | 인증 API 테스트 |
| `apps/api/__tests__/integration/agents.test.js` | 에이전트 API 테스트 |
| `apps/api/__tests__/integration/problems.test.js` | 문제 API 테스트 |
| `apps/api/__tests__/integration/submissions.test.js` | 제출 API 테스트 |
| `apps/api/__tests__/integration/votes.test.js` | 투표 API 테스트 |
| `apps/api/__tests__/integration/upload.test.js` | 업로드 API 테스트 |

### 새로 생성할 미들웨어 (2개)
| 파일 경로 | 설명 |
|-----------|------|
| `apps/api/middleware/rateLimiter.js` | Rate Limiting 미들웨어 |
| `apps/api/middleware/corsConfig.js` | CORS 설정 |

### 수정할 파일 (5개)
| 파일 경로 | 변경 내용 |
|-----------|----------|
| `apps/api/server.js` | helmet, cors, rateLimiter 추가 + NODE_ENV=test 시 listen 건너뛰기 |
| `apps/api/package.json` | devDependencies + scripts 추가 |
| `apps/api/routes/v1/auth.js` | authLimiter 적용 |
| `apps/api/routes/v1/index.js` | submissionLimiter, voteLimiter 적용 |
| `.github/workflows/ci.yml` | PostgreSQL 서비스 + 테스트 실행 + 커버리지 |

### 선택적 수정 (1개)
| 파일 경로 | 변경 내용 |
|-----------|----------|
| `apps/api/middleware/validate.js` | integer, url, nohtml 규칙 추가 |

---

## 8. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 테스트 DB 격리 실패 (데이터 잔존) | 중간 | `beforeEach`에서 `cleanDatabase()` 호출, `--runInBand`으로 순차 실행 |
| server.js listen 분리로 기존 배포 영향 | 높음 | `NODE_ENV !== 'test'` 조건으로 프로덕션/개발 환경에서는 기존 동작 유지 |
| Rate Limiting이 테스트를 방해 | 높음 | `skip: (req) => process.env.NODE_ENV === 'test'`로 테스트 환경에서 건너뜀 |
| CI PostgreSQL 서비스 연결 실패 | 중간 | `pg_isready` 헬스체크로 DB 준비 확인 후 테스트 실행 |
| 헬퍼 함수의 bcrypt 해시 속도 | 낮음 | 테스트 전용 라운드(4) 사용으로 속도 확보 |
| CORS가 기존 프론트엔드 요청 차단 | 높음 | 개발 서버 포트(5173)를 기본 허용 목록에 포함, `CORS_ORIGINS` 환경변수로 추가 가능 |

---

> **PDCA 상태**: Plan -> Design (Sprint 4) ✅ -> Do (다음)
>
> Phase A부터 순차적으로 구현을 시작합니다.
