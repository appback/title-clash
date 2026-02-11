# Sprint 2 검증 보고서 (Check Report)

> 검증일: 2026-02-11
> 검증 대상: DESIGN-sprint2.md vs 실제 구현 코드
> 검증자: CHECK Agent (PDCA Sprint 2)

---

## 검증 요약

- **Match Rate: 93%** (구현된 항목 69개 / 설계 항목 74개)
- 총 설계 항목: 74개
- 구현 완료: 69개
- 갭 발견: 5개 (심각 0개, 중간 2개, 경미 3개)

---

## 상세 검증 결과

### 1. S3/로컬 스토리지 서비스 [PASS]

**파일:** `apps/api/services/storage.js`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| `STORAGE_MODE` 환경변수 분기 (s3/local) | `process.env.STORAGE_MODE \|\| 's3'` (라인 7) | PASS |
| S3Client 초기화 (STORAGE_MODE=s3 일 때만) | 라인 10-13, 조건부 초기화 | PASS |
| PutObjectCommand 사용 | 라인 26, `@aws-sdk/client-s3`에서 import | PASS |
| UUID 기반 파일명 생성 | 라인 23, `` `images/${uuidv4()}${ext}` `` | PASS |
| S3_URL_PREFIX 기반 URL 반환 | 라인 32, `` `${process.env.S3_URL_PREFIX}/${key}` `` | PASS |
| 로컬 모드: uploads/ 디렉터리 자동 생성 | 라인 36-37, `mkdirSync({ recursive: true })` | PASS |
| 로컬 모드: `/uploads/filename` URL 반환 | 라인 42 | PASS |
| `{ url, key }` 반환 형태 | S3: 라인 33, 로컬: 라인 43 | PASS |
| `module.exports = { uploadImage }` | 라인 47 | PASS |

설계 섹션 1.10의 코드와 구현이 정확히 일치한다. 동작 로직, 변수명, 분기 구조 모두 동일.

### 2. 업로드 엔드포인트 [PASS]

**파일:** `apps/api/controllers/v1/upload.js`, `apps/api/routes/v1/upload.js`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| POST /api/v1/upload/image | `routes/v1/upload.js` 라인 9: `router.post('/image', ...)` | PASS |
| jwtAuth + adminAuth 미들웨어 적용 | `routes/v1/upload.js` 라인 9: `jwtAuth, adminAuth` | PASS |
| Multer memoryStorage | `upload.js` 라인 12 | PASS |
| 파일 크기 제한 5MB | `upload.js` 라인 8: `5 * 1024 * 1024` | PASS |
| MIME 필터: jpeg, png, webp, gif | `upload.js` 라인 7: `ALLOWED_MIME` 배열 | PASS |
| ValidationError: 파일 없음 | `upload.js` 라인 38 | PASS |
| ValidationError: 크기 초과 | `upload.js` 라인 32 | PASS |
| ValidationError: MIME 거부 | `upload.js` 라인 16 | PASS |
| 201 응답: url, key, content_type, size | `upload.js` 라인 44-49 | PASS |
| multer single('image') 필드명 | `upload.js` 라인 21 | PASS |

설계 섹션 1.2, 1.3, 1.11과 구현이 정확히 일치한다. 에러 메시지도 설계의 한국어 메시지와 동일.

**라우트 마운트 확인:**
- `routes/v1/index.js` 라인 21: `const uploadRoutes = require('./upload')`
- `routes/v1/index.js` 라인 30: `router.use('/upload', uploadRoutes)`
- PASS.

### 3. 보상 분배 (rewardDistributor) [PASS]

**파일:** `apps/api/services/rewardDistributor.js`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| REWARD_POINTS: 1위 100, 2위 50, 3위 25 | 라인 4-8 | PASS |
| reason: round_winner / runner_up | 라인 5-7 | PASS |
| 중복 분배 방지: rewards 테이블 기존 기록 확인 | 라인 17-24 | PASS |
| 투표 집계: SUM(weight), ORDER BY total_votes DESC, created_at ASC | 라인 27-37 | PASS |
| 제출물 0건 시 빈 배열 반환 | 라인 39-42 | PASS |
| 투표 0건 시 빈 배열 반환 | 라인 44-48 | PASS |
| 트랜잭션 사용 (BEGIN/COMMIT/ROLLBACK) | 라인 52-89 | PASS |
| db.getClient() 사용 | 라인 52 | PASS |
| client.release() in finally | 라인 88 | PASS |
| INSERT INTO rewards 파라미터화 쿼리 | 라인 61-65 | PASS |
| 1위 submission status='winner' 업데이트 | 라인 70-74 | PASS |
| Math.min(submissions, REWARD_POINTS) -- 3개 미만 처리 | 라인 56 | PASS |
| `module.exports = { distributeRewards, REWARD_POINTS }` | 라인 94 | PASS |

설계 섹션 3.4의 코드와 구현이 정확히 일치한다. 트랜잭션 안전성, 중복 방지, 엣지 케이스 모두 올바르게 구현됨.

### 4. 스케줄러 [PASS]

**파일:** `apps/api/services/scheduler.js`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| node-cron 사용 | 라인 2: `require('node-cron')` | PASS |
| 매 1분 실행: `'* * * * *'` | 라인 13 | PASS |
| draft -> open: start_at <= now | 라인 29-40 | PASS |
| open -> voting: submission_deadline 계산 (0.6) | 라인 44-56 | PASS |
| voting -> closed: end_at <= now | 라인 59-67 | PASS |
| start_at/end_at IS NOT NULL 조건 | 라인 33-34, 48-49, 63-64 | PASS |
| closed 후 distributeRewards(p.id) 호출 | 라인 72 | PASS |
| 보상 분배 후 archived 전이 | 라인 75-78 | PASS |
| 보상 실패 시 closed 유지 (catch) | 라인 80-82 | PASS |
| processTransitions 함수 export | 라인 87 | PASS |
| startScheduler 함수 export | 라인 87 | PASS |

설계 섹션 2.5의 코드와 구현이 정확히 일치한다.

### 5. Problems 컨트롤러 수동 트리거 연동 [PASS]

**파일:** `apps/api/controllers/v1/problems.js`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| voting -> closed 전이 시 distributeRewards 호출 | 라인 200-205 | PASS |
| 비동기 호출 (.catch) -- 응답 대기하지 않음 | 라인 202-204 | PASS |
| 조건: `state === 'closed' && problem.state === 'voting'` | 라인 200 | PASS |
| lazy require (함수 내 require) | 라인 201 | PASS |

설계 섹션 3.5와 정확히 일치한다.

### 6. 통계 API 보강 [PASS - 경미 이슈 1건]

**파일:** `apps/api/controllers/v1/stats.js`

#### 6.1 overview (신규) [PASS]

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| total_problems, active_problems, total_submissions | 라인 11-18 | PASS |
| total_votes, total_agents, total_rewards_distributed | 라인 11-18 | PASS |
| 단일 쿼리, 서브쿼리 구조 | 라인 11-19 | PASS |

설계 섹션 4.2.3 응답 스키마와 일치.

#### 6.2 top (강화) [PASS]

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| limit 파라미터 (기본 20, 최대 100) | 라인 34 | PASS |
| win_count, submission_count 추가 | 라인 40-41 | PASS |
| HAVING total_points > 0 | 라인 46 | PASS |

#### 6.3 agentStats (신규) [PASS]

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| agent 존재 여부 확인 -> NotFoundError | 라인 69-76 | PASS |
| summary: total_submissions, total_wins, total_points, participated_problems | 라인 81-87 | PASS |
| win_rate 계산 (소수점 1자리) | 라인 91-93 | PASS |
| recent_results: 최근 10건, closed/archived 문제만 | 라인 96-117 | PASS |
| 응답 구조: { agent, summary, recent_results } | 라인 120-127 | PASS |

설계 섹션 4.2.1의 응답 스키마와 일치.

**경미 이슈:** agentStats의 recent_results 쿼리에서 `rank` 필드가 설계 응답 스키마에 포함되어 있으나 (`"rank": 1`), 구현에서는 rank 필드가 반환되지 않는다. 쿼리에서 rank를 계산하거나 별도 파생하는 로직이 없음 (`stats.js` 라인 96-117). 이는 프론트엔드에서 직접적으로 사용되지 않으므로 경미 수준.

#### 6.4 problemStats (강화) [PASS]

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| 기본 stats: submission_count, vote_count, agent_count, top_submissions | 라인 143-201 | PASS |
| rewards 정보 추가 (보상 내역 조회) | 라인 190-201 | PASS |
| timeline 추가 (start_at, submission_deadline, end_at) | 라인 204-209, 232-236 | PASS |
| submission_deadline 계산: (end - start) * 0.6 | 라인 206-208 | PASS |

설계 섹션 4.2.2의 응답 스키마와 일치.

#### 6.5 Stats 라우트 등록 [PASS - 경미 이슈 1건]

**파일:** `apps/api/routes/v1/index.js`

설계 섹션 4.4 명시 라우트:
```
router.get('/stats/top', statsController.top)
router.get('/stats/overview', statsController.overview)
router.get('/stats/problems/:id', statsController.problemStats)
router.get('/stats/agents/:agentId', statsController.agentStats)
```

구현 (`routes/v1/index.js` 라인 35-39):
```javascript
router.get('/stats', statsController.overview)              // 추가 (설계에 없음)
router.get('/stats/top', statsController.top)                // PASS
router.get('/stats/overview', statsController.overview)      // PASS
router.get('/stats/problems/:id', statsController.problemStats)  // PASS
router.get('/stats/agents/:agentId', statsController.agentStats) // PASS
```

**경미 이슈:** `GET /stats` 라우트(라인 35)가 설계에 없으나 추가로 등록되어 있다. `overview` 함수가 매핑되어 기능적으로 동일한 `GET /stats/overview`의 축약 경로이다. App.jsx 프론트엔드에서 `api.get('/stats')` (라인 16)로 호출하고 있어 실용적 이유로 추가된 것으로 보인다. 설계 불일치이나 기능상 이점이 있어 경미 수준.

### 7. 프론트엔드 페이지 [PASS - 중간 이슈 1건]

#### 7.1 API 클라이언트 [PASS]

**파일:** `client/src/api.js`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| axios.create 사용 | 라인 3 | PASS |
| baseURL: '/api/v1' | 라인 4 | PASS |
| Content-Type: application/json | 라인 6 | PASS |
| default export | 라인 10 | PASS |

설계 섹션 5.2와 정확히 일치.

#### 7.2 Nav 컴포넌트 [PASS]

**파일:** `client/src/components/Nav.jsx`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| Link, useLocation 사용 | 라인 2 | PASS |
| 5개 링크: /, /rounds, /vote, /results, /leaderboard | 라인 8-13 | PASS |
| nav-brand: TitleClash | 라인 23 | PASS |
| active 클래스 적용 | 라인 15-18, 29 | PASS |
| nav > nav-links 구조 | 라인 21-35 | PASS |

설계 섹션 5.9의 구조와 일치. 구현에서 `isActive()` 함수가 `pathname.startsWith(to)` 방식으로 서브경로도 처리하는 점은 설계보다 개선된 구현.

#### 7.3 main.jsx 라우팅 [PASS]

**파일:** `client/src/main.jsx`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| BrowserRouter + Nav + Routes 구조 | 라인 14-28 | PASS |
| Route / -> App | 라인 18 | PASS |
| Route /rounds -> RoundsPage | 라인 19 | PASS |
| Route /vote -> VotePage | 라인 20 | PASS |
| Route /results -> ResultsPage | 라인 22 | PASS |
| Route /leaderboard -> LeaderboardPage | 라인 24 | PASS |
| Nav이 Routes 외부 배치 | 라인 15-16 | PASS |

추가로 `/vote/:problemId` (라인 21)와 `/results/:problemId` (라인 23) 라우트가 설계에 없으나 구현되어 있다. 이는 상세 페이지 직접 접근을 위한 실용적 추가로 설계 의도와 부합하며, 개선점으로 평가.

#### 7.4 App.jsx (홈 대시보드) [PASS]

**파일:** `client/src/pages/App.jsx`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| GET /api/v1/stats/overview (통계 요약) | 라인 16: `api.get('/stats')` | PASS (축약 경로 사용) |
| GET /api/v1/problems?state=voting&limit=3 (투표 중 라운드) | 라인 17 | PASS |
| GET /api/v1/stats/top?limit=5 (상위 5 에이전트) | 라인 19 | PASS |
| 통계 카드 6개 표시 | 라인 59-84 | PASS |
| 활성 라운드 섹션 | 라인 87-113 | PASS |
| 상위 에이전트 섹션 | 라인 142-160 | PASS |
| React hooks 사용 (useState, useEffect) | 라인 1 | PASS |
| Promise.allSettled 병렬 호출 | 라인 15 | PASS |

추가로 최근 결과(closed 라운드) 섹션 (라인 116-140)이 설계 레이아웃에 없으나 추가 구현됨. 대시보드 경험 향상을 위한 개선.

#### 7.5 VotePage.jsx [PASS]

**파일:** `client/src/pages/VotePage.jsx`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| GET /api/v1/problems?state=voting (목록) | 라인 22 | PASS |
| GET /api/v1/problems/:id (상세) | 라인 95 | PASS |
| GET /api/v1/submissions?problem_id=:id | 라인 96 | PASS |
| GET /api/v1/votes/summary/:id | 라인 97 | PASS |
| POST /api/v1/votes { submission_id } | 라인 126 | PASS |
| 투표 후 summary 새로고침 | 라인 130-131 | PASS |
| 이미지 표시 | 라인 172-176 | PASS |
| 제출물 목록 표시 + 투표 버튼 | 라인 198-229 | PASS |
| 투표 수/비율 표시 | 라인 199-200, 210 | PASS |
| v1 API만 사용 (레거시 없음) | 전체 | PASS |

설계 섹션 5.3과 일치. 투표 후 버튼 비활성화(`voted` 상태) 및 에러 핸들링이 잘 구현됨.

#### 7.6 RoundsPage.jsx (구 SubmitPage) [PASS - 중간 이슈 1건]

**파일:** `client/src/pages/RoundsPage.jsx`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| GET /api/v1/problems?state=open (제출 가능 라운드) | 라인 15 | PASS |
| 문제 이미지 표시 | 라인 72-74 | PASS |
| submission_deadline 계산 (0.6 공식) | 라인 43-48 | PASS |
| 제출 마감 시간 표시 | 라인 83 | PASS |
| v1 API만 사용 | 전체 | PASS |

추가로 voting 상태 라운드도 함께 표시 (라인 16). 설계 섹션 5.4에서 voting 상태는 별도 페이지에 있으나, 사용자 편의를 위한 개선으로 볼 수 있음.

**중간 이슈:** 설계 섹션 5.4에서 "문제 선택 시 GET /api/v1/submissions?problem_id=:id로 제출물 목록 표시" 기능이 명시되어 있으나, RoundsPage에서는 문제 목록만 표시하고 개별 문제의 제출물 목록 조회 기능이 구현되지 않았다. open 상태 문제 카드를 클릭해도 상세 페이지로 이동하지 않고 정적 카드만 표시된다 (라인 70: `<div className="card">` -- `card-clickable` 클래스가 아님, 라우트 Link도 없음). 그러나 설계에서 에이전트 토큰 UI를 구현하지 않기로 했고 이 페이지가 정보 제공 목적임을 고려하면 중간 수준.

#### 7.7 ResultsPage.jsx [PASS]

**파일:** `client/src/pages/ResultsPage.jsx`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| GET /api/v1/problems?state=closed (종료 라운드) | 라인 23 | PASS |
| GET /api/v1/problems?state=archived (아카이브 라운드) | 라인 24 | PASS |
| 라운드 선택 시 GET /api/v1/stats/problems/:id | 라인 107 | PASS |
| 상세: submission_count, vote_count, agent_count | 라인 135, 158-171 | PASS |
| 보상(rewards) 표시 | 라인 199-218 | PASS |
| timeline 표시 | 라인 173-197 | PASS |
| top_submissions 목록 | 라인 220-243 | PASS |
| winner 뱃지 표시 | 라인 237 | PASS |

설계 섹션 5.6.1과 일치. end_at 기준 내림차순 정렬 (라인 38-42)도 구현됨.

#### 7.8 LeaderboardPage.jsx [PASS]

**파일:** `client/src/pages/LeaderboardPage.jsx`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| GET /api/v1/stats/top?limit=50 | 라인 15 | PASS |
| 에이전트 선택 시 GET /api/v1/stats/agents/:agentId | 라인 36 | PASS |
| 순위, 이름, 포인트, 승수, 제출수 표시 | 라인 80-86 | PASS |
| 에이전트 상세: summary (submissions, wins, win_rate, rounds) | 라인 96-111 | PASS |
| 에이전트 상세: recent_results | 라인 114-130 | PASS |
| React hooks 사용 | 라인 1 | PASS |
| 토글 방식 상세 펼침 | 라인 26-31 | PASS |

설계 섹션 5.6.2와 일치.

### 8. server.js 수정 [PASS]

**파일:** `apps/api/server.js`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| startScheduler 임포트 | 라인 12 | PASS |
| app.listen 내에서 startScheduler() 호출 | 라인 41 | PASS |
| NODE_ENV !== 'test' 조건부 실행 | 라인 40 | PASS |
| 로컬 업로드 정적 파일 서빙 | 라인 20-22 | PASS |
| STORAGE_MODE 환경변수 분기 | 라인 20 | PASS |
| express.static path 설정 | 라인 21 | PASS |

설계 섹션 2.6 및 6.3과 정확히 일치.

### 9. Docker/환경변수 업데이트 [PASS]

#### 9.1 docker-compose.yml [PASS]

**파일:** `docker/docker-compose.yml`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| STORAGE_MODE 환경변수 | 라인 11 | PASS |
| AWS_REGION 환경변수 | 라인 12 | PASS |
| AWS_ACCESS_KEY_ID 환경변수 | 라인 13 | PASS |
| AWS_SECRET_ACCESS_KEY 환경변수 | 라인 14 | PASS |
| S3_BUCKET 환경변수 | 라인 15 | PASS |
| S3_URL_PREFIX 환경변수 | 라인 16 | PASS |
| NODE_ENV 환경변수 | 라인 17 | PASS |
| api_uploads 볼륨 마운트 | 라인 23 | PASS |
| api_uploads 볼륨 정의 | 라인 39-40 | PASS |
| postgres:15 이미지 유지 | 라인 26 | PASS |

설계 섹션 6.1과 정확히 일치.

#### 9.2 .env.example [PASS]

**파일:** `.env.example`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| DATABASE_URL | 라인 2 | PASS |
| PORT, NODE_ENV | 라인 5-6 | PASS |
| JWT_SECRET, JWT_EXPIRES_IN | 라인 9-10 | PASS |
| STORAGE_MODE=local | 라인 13 | PASS |
| AWS_REGION | 라인 16 | PASS |
| AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY | 라인 17-18 | PASS |
| S3_BUCKET | 라인 19 | PASS |
| S3_URL_PREFIX | 라인 20 | PASS |

설계 섹션 6.2와 정확히 일치.

#### 9.3 .gitignore [PASS]

**파일:** `.gitignore`

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| `apps/api/uploads/` | 라인 2 | PASS |
| `.env` | 라인 3 | PASS |

설계 섹션 6.4와 일치.

### 10. npm 패키지 의존성 [PASS]

**파일:** `apps/api/package.json`

| 패키지 | 설계 버전 | 실제 버전 | 상태 |
|--------|-----------|----------|------|
| @aws-sdk/client-s3 | ^3.500.0 | ^3.500.0 | PASS |
| multer | ^1.4.5-lts.1 | ^1.4.5-lts.1 | PASS |
| mime-types | ^2.1.35 | ^2.1.35 | PASS |
| node-cron | ^3.0.3 | ^3.0.3 | PASS |

설계 섹션 9와 정확히 일치.

### 11. 코드 품질 [PASS]

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| CommonJS 백엔드 (require/module.exports) | 전체 백엔드 파일 | PASS |
| React hooks 프론트엔드 (useState, useEffect) | App, Vote, Rounds, Results, Leaderboard | PASS |
| 파라미터화 SQL ($1, $2 바인딩) | stats.js, rewardDistributor.js, scheduler.js 전체 | PASS |
| async/await + try/catch 에러 핸들링 | 전체 컨트롤러 | PASS |
| 트랜잭션 사용 (BEGIN/COMMIT/ROLLBACK) | rewardDistributor.js 라인 54-89 | PASS |
| client.release() in finally | rewardDistributor.js 라인 88 | PASS |

### 12. 보안 [PASS]

| 설계 항목 | 구현 상태 | 상태 |
|-----------|-----------|------|
| Admin-only 업로드 (jwtAuth + adminAuth) | routes/v1/upload.js 라인 9 | PASS |
| SQL 인젝션 없음 (전 쿼리 파라미터화) | 전체 신규 파일 | PASS |
| 인증 미들웨어 올바르게 적용 | routes/v1/index.js 전체 | PASS |
| 중복 보상 방지 | rewardDistributor.js 라인 17-24 | PASS |

---

## 발견된 갭 (Issues)

| # | 심각도 | 영역 | 설명 | 설계 내용 | 구현 상태 |
|---|--------|------|------|-----------|-----------|
| 1 | **중간** | 프론트엔드 | RoundsPage에서 문제 선택 시 제출물 목록 조회 기능 미구현 | 설계 섹션 5.4: "문제 선택 시 GET /api/v1/submissions?problem_id=:id -> 제출된 제목 목록" | RoundsPage는 문제 카드를 정적으로 표시만 하고 클릭 시 상세 보기나 제출물 목록 기능이 없음 (`client/src/pages/RoundsPage.jsx` 라인 70) |
| 2 | **중간** | 프론트엔드 | SubmitPage.jsx가 레거시 API를 여전히 사용 중 | 설계 섹션 5.4/5.7: SubmitPage를 RoundsPage로 전환하거나, 레거시 API 호출 제거 | `client/src/pages/SubmitPage.jsx`가 여전히 `axios.post('/api/titles', { title })` (라인 10)을 사용하며 레거시 UI를 유지. 설계 DoD: "레거시 API 호출이 클라이언트 코드에 없음" 위반 |
| 3 | **경미** | 통계 API | agentStats의 recent_results에 rank 필드 미포함 | 설계 섹션 4.2.1 응답 스키마에 `"rank": 1` 포함 | `stats.js` 라인 96-117에서 rank 계산 또는 반환 로직 없음 |
| 4 | **경미** | 라우트 | GET /stats 라우트 추가 (설계 외) | 설계 섹션 4.4에 GET /stats 없음 | `routes/v1/index.js` 라인 35에 추가. App.jsx에서 사용 중. 기능적으로 문제 없음 |
| 5 | **경미** | 통계 API | stats 전용 라우트 파일 미생성 | 설계 섹션 4.3에서 "routes/v1/index.js에 새 stats 라우트 추가"로 명시 (별도 파일 아님) | index.js에 직접 등록 (설계와 일치) |

---

## 코드 품질 이슈

### 주의 필요 (중간)

1. **레거시 SubmitPage.jsx 잔존** -- `client/src/pages/SubmitPage.jsx`가 여전히 레거시 `/api/titles` API를 호출하고 있다 (라인 10). 이 파일은 main.jsx에서 라우팅되지 않으므로 실행 시 영향은 없으나, 코드베이스에 레거시 API 의존 코드가 남아 있다. 설계의 Sprint 2 DoD "레거시 API 호출이 클라이언트 코드에 없음" 기준으로는 불합격이다. 이 파일은 삭제하거나 RoundsPage.jsx로 대체되었음을 명시해야 한다.

2. **RoundsPage 상세 보기 기능 미구현** -- 설계에서는 open 상태 문제를 선택하면 해당 문제의 상세 정보와 제출물 목록을 볼 수 있도록 설계했으나, 현재 구현은 카드 목록만 표시한다. `<div className="card">` 요소가 클릭 불가능한 정적 카드이다 (`client/src/pages/RoundsPage.jsx` 라인 70). 사용자가 제출물 현황을 실시간 확인할 수 없다.

### 설계 참고 사항 (경미)

3. **agentStats의 rank 미반환** -- `client/src/pages/LeaderboardPage.jsx`에서 `r.rank`를 사용하는 코드가 없으므로 프론트엔드 표시에는 영향이 없으나, API 응답이 설계 스키마와 불일치한다. `stats.js` 라인 96-117의 쿼리에 window 함수(`RANK() OVER ...`)를 추가하면 해결 가능.

4. **App.jsx의 overview 호출 경로** -- `api.get('/stats')` 로 호출하고 있으나 설계에서는 `api.get('/stats/overview')` 를 의도했다. `GET /stats` 라우트가 추가되었기 때문에 동작하지만, 설계와의 일관성을 위해 `/stats/overview`를 사용하는 것이 바람직하다.

---

## 권장 사항

### 즉시 수정 (Sprint 2 ACT 단계)

1. **SubmitPage.jsx 정리 (우선순위 1):**
   - `client/src/pages/SubmitPage.jsx` 파일을 삭제하거나, 내용을 `RoundsPage.jsx`로 리다이렉트하도록 수정.
   - 레거시 `/api/titles` API 호출이 코드베이스에 남아 있으면 안 됨 (Sprint 2 DoD 위반).

2. **RoundsPage 상세 보기 기능 추가 (우선순위 2):**
   - open 상태 문제 카드에 클릭 이벤트 추가.
   - 클릭 시 해당 문제의 제출물 목록을 표시하거나, `/vote/:problemId` 와 유사한 상세 페이지로 라우팅.
   - 또는 별도의 `/rounds/:problemId` 라우트를 추가하여 상세 페이지 구현.

### 후속 개선 (Sprint 3 이후)

3. **agentStats에 rank 필드 추가** -- SQL 쿼리에 `RANK() OVER (PARTITION BY s.problem_id ORDER BY vote_count DESC, s.created_at ASC)` 윈도우 함수를 추가하여 각 참여 라운드에서의 순위를 반환.

4. **App.jsx overview 호출 경로 통일** -- `api.get('/stats')` -> `api.get('/stats/overview')` 로 변경. 또는 `GET /stats` 라우트가 의도적이라면 설계 문서에 반영.

---

## 파일별 구현 완성도 요약

### 신규 파일 (설계 8개 vs 구현 9개)

| # | 설계 파일 경로 | 구현 상태 | 비고 |
|---|---------------|-----------|------|
| 1 | `apps/api/services/storage.js` | PASS | 설계와 완전 일치 |
| 2 | `apps/api/services/scheduler.js` | PASS | 설계와 완전 일치 |
| 3 | `apps/api/services/rewardDistributor.js` | PASS | 설계와 완전 일치 |
| 4 | `apps/api/controllers/v1/upload.js` | PASS | 설계와 완전 일치 |
| 5 | `apps/api/routes/v1/upload.js` | PASS | 설계와 완전 일치 |
| 6 | `client/src/api.js` | PASS | 설계와 완전 일치 |
| 7 | `client/src/components/Nav.jsx` | PASS | 설계 기반 + 개선 (startsWith 활성화) |
| 8 | `client/src/pages/ResultsPage.jsx` | PASS | 설계 기반 + 상세 페이지 추가 구현 |
| 9 | `client/src/pages/LeaderboardPage.jsx` | PASS | 설계 기반 + 토글 상세 패널 구현 |

추가로 `client/src/pages/RoundsPage.jsx`가 설계의 "SubmitPage.jsx 전환" 대신 새 파일로 생성됨. 기존 SubmitPage.jsx는 삭제되지 않고 잔존.

### 수정 파일 (설계 10개)

| # | 설계 파일 경로 | 구현 상태 | 비고 |
|---|---------------|-----------|------|
| 1 | `apps/api/package.json` | PASS | 4개 패키지 모두 추가 |
| 2 | `apps/api/server.js` | PASS | 스케줄러 + 정적 서빙 추가 |
| 3 | `apps/api/routes/v1/index.js` | PASS | 업로드 + stats 라우트 마운트 |
| 4 | `apps/api/controllers/v1/problems.js` | PASS | 수동 보상 트리거 추가 |
| 5 | `apps/api/controllers/v1/stats.js` | PASS | overview, agentStats 추가, problemStats 보강 |
| 6 | `client/src/main.jsx` | PASS | 라우팅 구조 완전 재설계 |
| 7 | `client/src/pages/App.jsx` | PASS | 홈 대시보드로 재설계 |
| 8 | `client/src/pages/VotePage.jsx` | PASS | v1 API 연동 완전 재작성 |
| 9 | `client/src/pages/SubmitPage.jsx` | **FAIL** | 레거시 코드 유지, 전환 미완료 |
| 10 | `docker/docker-compose.yml` | PASS | S3 환경변수 + 볼륨 추가 |

### 추가 파일 (설계에 없으나 구현됨)

| # | 파일 경로 | 비고 |
|---|-----------|------|
| 1 | `client/src/styles.css` | 설계에 명시되지 않았으나 모던 UI를 위한 포괄적 CSS 시스템. 1028줄의 상세한 디자인 시스템 포함 (네비게이션, 카드, 리더보드, 리워드, 타임라인, 반응형 등). 설계 섹션 5의 UI 레이아웃 의도에 부합. |

---

## Sprint 2 DoD 체크리스트

### 이미지 업로드
- [x] `POST /api/v1/upload/image` 로 이미지 업로드 가능
- [x] 업로드된 이미지 URL이 브라우저에서 접근 가능 (로컬 static 서빙 구현)
- [x] 로컬 모드 (`STORAGE_MODE=local`) 에서 업로드/접근 정상 동작
- [x] 5MB 초과 파일 거부됨
- [x] 허용되지 않는 MIME 타입 거부됨

### 라운드 자동화
- [x] `start_at` 도달 시 draft -> open 자동 전이
- [x] submission_deadline 도달 시 open -> voting 자동 전이
- [x] `end_at` 도달 시 voting -> closed 자동 전이
- [x] `start_at`/`end_at`이 null인 problem은 자동 전이하지 않음
- [x] 스케줄러가 서버 시작 시 자동 실행됨

### 보상 자동 분배
- [x] voting -> closed 전이 시 상위 3위에 보상 자동 기록
- [x] 1위 submission에 `winner` 상태 부여
- [x] 중복 보상 분배 방지
- [x] 투표 0건인 경우 보상 분배하지 않음
- [x] 관리자 수동 전이 시에도 보상 분배 동작

### 통계 API 보강
- [x] `GET /api/v1/stats/overview` 가 전체 통계 반환
- [x] `GET /api/v1/stats/agents/:agentId` 가 에이전트 이력 반환
- [x] `GET /api/v1/stats/problems/:id` 가 보상 정보 포함

### 프론트엔드 v1 연동
- [x] VotePage가 v1 API를 사용하여 투표 가능
- [x] App 홈이 활성 라운드와 상위 에이전트 표시
- [x] SubmitPage가 진행 중인 라운드 목록 표시 (RoundsPage로 대체)
- [x] ResultsPage가 종료된 라운드 결과 표시
- [x] LeaderboardPage가 에이전트 순위 표시
- [x] 네비게이션 바가 모든 페이지에서 동작
- [ ] **레거시 API 호출이 클라이언트 코드에 없음** -- SubmitPage.jsx에 `/api/titles` 잔존

### Docker/환경
- [x] docker-compose.yml에 S3 환경변수 포함
- [x] .env.example 파일 존재
- [x] 로컬 개발 환경에서 S3 없이 전체 흐름 동작 (STORAGE_MODE=local)

**DoD 달성률: 29/30 (97%)**

---

## 결론

Sprint 2의 구현은 설계 문서의 핵심 요구사항을 매우 충실히 반영하고 있다. 백엔드의 4대 핵심 기능 -- **이미지 업로드**, **보상 분배**, **스케줄러**, **통계 API 보강** -- 이 모두 설계와 정확히 일치하는 수준으로 구현되었다. 특히 보상 분배 로직의 트랜잭션 안전성, 중복 방지, 엣지 케이스 처리가 설계대로 빈틈없이 구현된 점은 높이 평가할 수 있다.

프론트엔드도 5개 페이지가 모두 React hooks 기반으로 재작성되었고, 중앙화된 API 클라이언트를 사용하며, v1 API와 올바르게 연동되어 있다. 1028줄에 달하는 포괄적인 CSS 디자인 시스템은 설계에 명시되지 않았으나 모던 UI를 구현하기 위한 필수적 추가 작업이었으며, 반응형 레이아웃까지 잘 구현되어 있다.

**2건의 중간 이슈**가 발견되었다:

1. `SubmitPage.jsx`가 레거시 `/api/titles` API를 호출하는 코드로 남아 있어 Sprint 2 DoD의 "레거시 API 호출 제거" 기준을 위반한다. 이 파일은 라우팅에서 제외되어 런타임에는 영향이 없으나 코드 정리가 필요하다.
2. `RoundsPage.jsx`에서 open 상태 문제의 상세 보기 (제출물 목록 조회) 기능이 설계에 명시되어 있으나 미구현되었다.

이 2건은 **ACT 단계에서 수정**이 권장되며, 수정 후 Sprint 2의 모든 DoD를 충족할 수 있다.

심각(SEVERE) 수준의 버그는 발견되지 않았으며, 보안 검증(SQL 인젝션, 인증 미들웨어 적용, 권한 검증)도 모두 통과하였다.

**전체 매치율 93%**, 중간 이슈 수정 후 예상 매치율 **98%**.

---

> **PDCA 상태**: Plan -> Design -> Do -> **Check (Sprint 2)** -> Act
>
> ACT 단계에서 중간 이슈 2건(SubmitPage 레거시 코드 정리, RoundsPage 상세 보기 추가)을 수정하고 재검증하세요.
