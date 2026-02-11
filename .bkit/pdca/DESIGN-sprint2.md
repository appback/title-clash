# Sprint 2 상세 설계서 - 이미지 업로드, 라운드 자동화, 보상 분배, 프론트엔드 v1 연동

> 작성일: 2026-02-11
> 프로젝트: title-clash
> 스프린트: Sprint 2 (Sprint 2+3 통합)
> 선행 문서: `.bkit/pdca/PLAN.md`, `.bkit/pdca/DESIGN-sprint1.md`, `.bkit/pdca/CHECK-sprint1.md`

---

## 0. Sprint 1 완료 상태 요약

Sprint 1에서 구현 완료된 항목 (재구현 금지):
- v1 API 22개 엔드포인트 (agents, problems, submissions, votes, rewards, stats)
- DB 스키마: users, agents, problems, submissions, votes, rewards 테이블
- 인증 3중 체계: JWT (관리자/소유자), 에이전트 API 토큰 (`tc_agent_`), 익명 쿠키 (`voterId`)
- Problems 상태 전이: draft -> open -> voting -> closed -> archived
- 미들웨어: auth, agentAuth, adminAuth, errorHandler, validate
- 레거시 호환: `/api/titles`, `/api/matches` 경로 유지 (Deprecation 헤더)

Sprint 1 CHECK에서 발견된 미수정 이슈 (Sprint 2에서 해결):
- AppError 생성자 인자 순서 오류 3곳 (problems.js:148, submissions.js:41, votes.js:39) -- **이미 ACT에서 수정 완료**
- rewards/getByAgent 권한 검사 누락 -- **이미 ACT에서 수정 완료**

---

## 1. S3 이미지 업로드 설계

### 1.1 접근 방식 선택

**선택: Multer + S3 서버 경유 업로드 (MVP용)**

| 방식 | 장점 | 단점 |
|------|------|------|
| Presigned URL (클라이언트 직접) | 서버 부하 적음, 대용량 가능 | CORS 설정 복잡, 클라이언트 코드 복잡 |
| **Multer + S3 (서버 경유)** | **구현 간단, 파일 검증 서버에서 가능, CORS 문제 없음** | 서버 메모리 사용, 대용량 파일 시 부담 |

MVP 단계에서는 이미지 크기가 작고 (최대 5MB), 구현 속도가 중요하므로 **Multer + S3 서버 경유 방식**을 선택한다. 추후 트래픽 증가 시 Presigned URL로 전환 가능.

### 1.2 새 엔드포인트

```
POST /api/v1/upload/image
```

| 항목 | 내용 |
|------|------|
| 메서드 | POST (multipart/form-data) |
| 경로 | `/api/v1/upload/image` |
| 권한 | jwtAuth + adminAuth (관리자 전용) |
| 필드명 | `image` (단일 파일) |
| 허용 MIME | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| 최대 크기 | 5MB |
| 응답 | `{ "url": "https://s3-bucket.../images/uuid.ext", "key": "images/uuid.ext" }` |

### 1.3 요청/응답 스키마

```
요청 헤더:
  Content-Type: multipart/form-data
  Authorization: Bearer <jwt-token>   (admin 전용)

요청 본문:
  image: (바이너리 파일)

성공 응답 (201):
{
  "url": "https://title-clash-images.s3.ap-northeast-2.amazonaws.com/images/550e8400-e29b-41d4-a716-446655440000.jpg",
  "key": "images/550e8400-e29b-41d4-a716-446655440000.jpg",
  "content_type": "image/jpeg",
  "size": 245760
}

실패 응답:
- 400: { "error": "VALIDATION_ERROR", "message": "이미지 파일이 필요합니다" }
- 400: { "error": "VALIDATION_ERROR", "message": "허용되지 않는 파일 형식입니다 (jpeg, png, webp, gif만 가능)" }
- 400: { "error": "VALIDATION_ERROR", "message": "파일 크기가 5MB를 초과합니다" }
- 403: { "error": "FORBIDDEN", "message": "관리자 권한이 필요합니다" }
```

### 1.4 사용 흐름

```
[관리자] --POST /api/v1/upload/image--> Multer 파싱
                                            |
                                            v
                                      파일 검증:
                                      1. MIME 타입 확인
                                      2. 파일 크기 확인 (max 5MB)
                                            |
                                            v
                                      S3 업로드:
                                      1. UUID 기반 파일명 생성
                                      2. S3에 업로드 (PutObject)
                                      3. 공개 URL 반환
                                            |
                                            v
[관리자] <--{ url, key }-- 응답

[관리자] --POST /api/v1/problems-->
         { title, image_url: "위에서 받은 url", ... }
```

문제(Problem) 생성 시 `image_url` 필드에 업로드한 URL을 직접 넣는 2단계 방식이다. 파일 업로드와 문제 생성을 분리함으로써 기존 problems 컨트롤러 수정을 최소화한다.

### 1.5 S3 키 네이밍 규칙

```
images/{uuid}.{ext}
```

예시: `images/550e8400-e29b-41d4-a716-446655440000.jpg`

### 1.6 로컬 개발 환경 대응

S3가 설정되지 않은 로컬 환경에서는 **로컬 디스크 폴백**을 지원한다:
- 환경변수 `STORAGE_MODE=local` 이면 `apps/api/uploads/` 디렉터리에 저장
- 기본값 `STORAGE_MODE=s3`
- 로컬 모드 시 URL: `/uploads/{uuid}.{ext}` (Express static 서빙)

### 1.7 파일 구조

```
apps/api/
  controllers/v1/
    upload.js              [신규] 이미지 업로드 컨트롤러
  services/
    storage.js             [신규] S3/로컬 스토리지 추상화 서비스
  routes/v1/
    upload.js              [신규] 업로드 라우트
    index.js               [수정] 업로드 라우트 마운트 추가
  uploads/                 [신규] 로컬 개발용 업로드 디렉터리 (.gitignore 추가)
```

### 1.8 환경변수

```env
# S3 설정 (신규)
STORAGE_MODE=s3                                    # 's3' 또는 'local'
AWS_REGION=ap-northeast-2                          # S3 리전
AWS_ACCESS_KEY_ID=AKIA...                          # IAM 액세스 키
AWS_SECRET_ACCESS_KEY=...                          # IAM 시크릿 키
S3_BUCKET=title-clash-images                       # S3 버킷명
S3_URL_PREFIX=https://title-clash-images.s3.ap-northeast-2.amazonaws.com
```

### 1.9 npm 패키지 추가

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.500.0",
    "multer": "^1.4.5-lts.1",
    "mime-types": "^2.1.35"
  }
}
```

### 1.10 서비스 코드 설계: `apps/api/services/storage.js`

```javascript
// storage.js - S3/로컬 스토리지 추상화
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const STORAGE_MODE = process.env.STORAGE_MODE || 's3'
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

let s3Client = null
if (STORAGE_MODE === 's3') {
  s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' })
}

/**
 * 파일을 스토리지에 업로드하고 공개 URL을 반환한다.
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} ext - 파일 확장자 (.jpg, .png 등)
 * @param {string} contentType - MIME 타입
 * @returns {Promise<{ url: string, key: string }>}
 */
async function uploadImage(buffer, ext, contentType) {
  const key = `images/${uuidv4()}${ext}`

  if (STORAGE_MODE === 's3') {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // ACL 대신 버킷 정책으로 공개 읽기 제어
    }))
    const url = `${process.env.S3_URL_PREFIX}/${key}`
    return { url, key }
  } else {
    // 로컬 모드
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }
    const filePath = path.join(UPLOAD_DIR, `${uuidv4()}${ext}`)
    fs.writeFileSync(filePath, buffer)
    const url = `/uploads/${path.basename(filePath)}`
    return { url, key: path.basename(filePath) }
  }
}

module.exports = { uploadImage }
```

### 1.11 컨트롤러 코드 설계: `apps/api/controllers/v1/upload.js`

```javascript
// upload.js - 이미지 업로드 컨트롤러
const multer = require('multer')
const path = require('path')
const { uploadImage } = require('../../services/storage')
const { ValidationError } = require('../../utils/errors')

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Multer 설정: 메모리 스토리지 (S3 전송 전 버퍼에 보관)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new ValidationError('허용되지 않는 파일 형식입니다 (jpeg, png, webp, gif만 가능)'))
      return
    }
    cb(null, true)
  }
}).single('image')

/**
 * POST /api/v1/upload/image
 * 이미지 업로드. Admin only.
 */
async function uploadImageHandler(req, res, next) {
  upload(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          throw new ValidationError('파일 크기가 5MB를 초과합니다')
        }
        throw err
      }

      if (!req.file) {
        throw new ValidationError('이미지 파일이 필요합니다')
      }

      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg'
      const result = await uploadImage(req.file.buffer, ext, req.file.mimetype)

      res.status(201).json({
        url: result.url,
        key: result.key,
        content_type: req.file.mimetype,
        size: req.file.size
      })
    } catch (uploadErr) {
      next(uploadErr)
    }
  })
}

module.exports = { uploadImage: uploadImageHandler }
```

---

## 2. 라운드 자동화 설계

### 2.1 접근 방식 선택

**선택: node-cron 기반 스케줄러**

| 방식 | 장점 | 단점 |
|------|------|------|
| setInterval | 구현 간단 | cron 표현식 불가, 정밀도 낮음 |
| **node-cron** | **cron 표현식 지원, 안정적, 가벼움** | 별도 패키지 필요 |
| Bull/BullMQ | Redis 기반, 분산 처리 | Redis 의존성, 과도한 복잡성 |
| 외부 cron (OS) | 서버 독립적 | 배포 복잡, Node 컨텍스트 없음 |

MVP 단계에서는 단일 인스턴스 운영이므로 **node-cron**이 적합하다. 추후 다중 인스턴스 시 BullMQ로 전환 가능.

### 2.2 자동 상태 전이 규칙

```
                  start_at 도달
    draft  ──────────────────────>  open
                                      |
                                      | submission_deadline 도달
                                      | (start_at + (end_at - start_at) * 0.6)
                                      v
                                    voting
                                      |
                                      | end_at 도달
                                      v
                                    closed  ──> [보상 자동 분배] ──> archived
```

| 현재 상태 | 전이 조건 | 다음 상태 | 후속 작업 |
|-----------|-----------|-----------|-----------|
| draft | `now() >= start_at` | open | 없음 |
| open | `now() >= submission_deadline` | voting | submission_deadline = start_at + (end_at - start_at) * 0.6 |
| voting | `now() >= end_at` | closed | 보상 분배 트리거 |
| closed | 보상 분배 완료 후 자동 | archived | 없음 |

**submission_deadline 계산 규칙:**
- `start_at`과 `end_at` 사이 시간의 60%를 제출 기간으로, 나머지 40%를 투표 기간으로 할당
- 예: start_at = 09:00, end_at = 21:00 (12시간)
  - 제출 마감 = 09:00 + 7.2시간 = 16:12
  - 투표 기간 = 16:12 ~ 21:00 (4.8시간)
- `start_at` 또는 `end_at`이 null이면 자동 전이하지 않음 (관리자 수동 전이만 가능)

### 2.3 스케줄러 실행 주기

```
매 1분마다 실행 (cron: '* * * * *')
```

1분 간격으로:
1. `draft` 상태이고 `start_at <= now()` 인 problems -> `open`으로 전이
2. `open` 상태이고 submission_deadline <= now() 인 problems -> `voting`으로 전이
3. `voting` 상태이고 `end_at <= now()` 인 problems -> `closed`로 전이 + 보상 분배

### 2.4 파일 구조

```
apps/api/
  services/
    scheduler.js           [신규] node-cron 기반 라운드 자동화 스케줄러
    rewardDistributor.js   [신규] 보상 자동 분배 로직
  server.js                [수정] 스케줄러 초기화 추가
```

### 2.5 스케줄러 코드 설계: `apps/api/services/scheduler.js`

```javascript
// scheduler.js - 라운드 자동 상태 전이 스케줄러
const cron = require('node-cron')
const db = require('../db')
const { distributeRewards } = require('./rewardDistributor')

/**
 * 스케줄러를 시작한다.
 * 매 1분마다 상태 전이 대상 problems를 확인하고 자동 전이한다.
 */
function startScheduler() {
  console.log('[Scheduler] Starting round automation scheduler (every 1 minute)')

  cron.schedule('* * * * *', async () => {
    try {
      await processTransitions()
    } catch (err) {
      console.error('[Scheduler] Error in round transition:', err)
    }
  })
}

/**
 * 상태 전이 처리 메인 로직
 */
async function processTransitions() {
  const now = new Date().toISOString()

  // 1단계: draft -> open (start_at 도달)
  const draftToOpen = await db.query(
    `UPDATE problems
     SET state = 'open', updated_at = now()
     WHERE state = 'draft'
       AND start_at IS NOT NULL
       AND start_at <= $1
     RETURNING id, title`,
    [now]
  )
  for (const p of draftToOpen.rows) {
    console.log(`[Scheduler] Problem '${p.title}' (${p.id}): draft -> open`)
  }

  // 2단계: open -> voting (submission_deadline 도달)
  // submission_deadline = start_at + (end_at - start_at) * 0.6
  const openToVoting = await db.query(
    `UPDATE problems
     SET state = 'voting', updated_at = now()
     WHERE state = 'open'
       AND start_at IS NOT NULL
       AND end_at IS NOT NULL
       AND (start_at + (end_at - start_at) * 0.6) <= $1
     RETURNING id, title`,
    [now]
  )
  for (const p of openToVoting.rows) {
    console.log(`[Scheduler] Problem '${p.title}' (${p.id}): open -> voting`)
  }

  // 3단계: voting -> closed (end_at 도달) + 보상 분배
  const votingToClosed = await db.query(
    `UPDATE problems
     SET state = 'closed', updated_at = now()
     WHERE state = 'voting'
       AND end_at IS NOT NULL
       AND end_at <= $1
     RETURNING id, title`,
    [now]
  )
  for (const p of votingToClosed.rows) {
    console.log(`[Scheduler] Problem '${p.title}' (${p.id}): voting -> closed`)
    // 보상 자동 분배 트리거
    try {
      await distributeRewards(p.id)
      console.log(`[Scheduler] Rewards distributed for problem ${p.id}`)
      // 보상 분배 완료 후 archived로 전이
      await db.query(
        `UPDATE problems SET state = 'archived', updated_at = now() WHERE id = $1`,
        [p.id]
      )
      console.log(`[Scheduler] Problem '${p.title}' (${p.id}): closed -> archived`)
    } catch (rewardErr) {
      console.error(`[Scheduler] Failed to distribute rewards for problem ${p.id}:`, rewardErr)
      // 보상 실패 시 closed 상태 유지 (수동 개입 필요)
    }
  }
}

module.exports = { startScheduler, processTransitions }
```

### 2.6 server.js 수정 사항

```javascript
// server.js에 추가할 코드 (app.listen 부근)
const { startScheduler } = require('./services/scheduler')

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log('TitleClash API listening on', port)
  // 스케줄러 시작 (프로덕션/개발 환경에서만, 테스트에서는 제외)
  if (process.env.NODE_ENV !== 'test') {
    startScheduler()
  }
})
```

### 2.7 npm 패키지 추가

```json
{
  "dependencies": {
    "node-cron": "^3.0.3"
  }
}
```

### 2.8 수동 전이와의 공존

스케줄러의 자동 전이와 관리자의 수동 전이(`PATCH /api/v1/problems/:id`)는 공존한다:
- `start_at`/`end_at`이 설정된 problems: 스케줄러가 자동 전이
- `start_at`/`end_at`이 null인 problems: 관리자만 수동 전이 가능
- 관리자가 이미 자동 전이된 문제의 상태를 수동으로 변경하는 것도 가능 (기존 `VALID_TRANSITIONS` 규칙 내에서)
- 스케줄러는 `UPDATE ... WHERE state = 'X'` 조건으로 이미 전이된 건은 자동 스킵

---

## 3. 보상 자동 분배 설계

### 3.1 트리거

보상 분배는 다음 상황에서 실행된다:
1. **자동**: 스케줄러가 problem을 `voting -> closed`로 전이할 때 자동 호출
2. **수동**: 관리자가 problem 상태를 `closed`로 변경할 때 (problems 컨트롤러 update에서 호출)

### 3.2 보상 분배 로직

```
[closed 상태 problem]
        |
        v
  투표 집계:
    SELECT submission_id, SUM(weight) as total_votes
    FROM votes v
    JOIN submissions s ON s.id = v.submission_id
    WHERE s.problem_id = :problemId
    GROUP BY submission_id
    ORDER BY total_votes DESC
        |
        v
  순위 결정 (상위 3위):
    1위: 100 포인트 (reason: 'round_winner')
    2위:  50 포인트 (reason: 'runner_up')
    3위:  25 포인트 (reason: 'runner_up')
        |
        v
  보상 기록:
    INSERT INTO rewards (agent_id, problem_id, points, reason)
    VALUES ($1, $2, $3, $4)
        |
        v
  1위 submission 상태 변경:
    UPDATE submissions SET status = 'winner'
    WHERE id = :firstPlaceSubmissionId
```

### 3.3 보상 포인트 정책

| 순위 | 포인트 | reason 값 | submission status |
|------|--------|-----------|-------------------|
| 1위 | 100 | `round_winner` | `winner` |
| 2위 | 50 | `runner_up` | `active` (변경 없음) |
| 3위 | 25 | `runner_up` | `active` (변경 없음) |

**엣지 케이스:**
- 투표가 0건인 경우: 보상 분배하지 않음 (로그만 남김)
- 제출물이 3개 미만인 경우: 존재하는 제출물에 대해서만 분배 (1개면 1위만, 2개면 1~2위만)
- 동점인 경우: `created_at`이 빠른 제출물이 높은 순위
- 이미 보상이 분배된 problem: 중복 분배 방지 (rewards 테이블에 해당 problem_id가 이미 있으면 스킵)

### 3.4 코드 설계: `apps/api/services/rewardDistributor.js`

```javascript
// rewardDistributor.js - 라운드 종료 시 보상 자동 분배
const db = require('../db')

const REWARD_POINTS = [
  { rank: 1, points: 100, reason: 'round_winner' },
  { rank: 2, points: 50, reason: 'runner_up' },
  { rank: 3, points: 25, reason: 'runner_up' }
]

/**
 * 특정 problem에 대해 보상을 분배한다.
 * @param {string} problemId - 대상 problem UUID
 * @returns {Promise<Array>} 분배된 보상 목록
 */
async function distributeRewards(problemId) {
  // 1. 중복 분배 방지: 이미 보상이 지급된 problem인지 확인
  const existingRewards = await db.query(
    'SELECT id FROM rewards WHERE problem_id = $1 LIMIT 1',
    [problemId]
  )
  if (existingRewards.rows.length > 0) {
    console.log(`[RewardDistributor] Rewards already distributed for problem ${problemId}. Skipping.`)
    return []
  }

  // 2. 투표 집계: submission별 총 투표 수 (weight 합산)
  const voteResult = await db.query(
    `SELECT s.id AS submission_id, s.agent_id, s.title,
            COALESCE(SUM(v.weight), 0)::int AS total_votes
     FROM submissions s
     LEFT JOIN votes v ON v.submission_id = s.id
     WHERE s.problem_id = $1
       AND s.status = 'active'
     GROUP BY s.id, s.agent_id, s.title
     ORDER BY total_votes DESC, s.created_at ASC`,
    [problemId]
  )

  if (voteResult.rows.length === 0) {
    console.log(`[RewardDistributor] No submissions for problem ${problemId}. No rewards to distribute.`)
    return []
  }

  const totalVotes = voteResult.rows.reduce((sum, r) => sum + r.total_votes, 0)
  if (totalVotes === 0) {
    console.log(`[RewardDistributor] No votes cast for problem ${problemId}. No rewards to distribute.`)
    return []
  }

  // 3. 상위 N위에 보상 분배
  const distributed = []
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    for (let i = 0; i < Math.min(voteResult.rows.length, REWARD_POINTS.length); i++) {
      const submission = voteResult.rows[i]
      const reward = REWARD_POINTS[i]

      // rewards 테이블에 기록
      const rewardResult = await client.query(
        `INSERT INTO rewards (agent_id, problem_id, points, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING id, agent_id, problem_id, points, reason, issued_at`,
        [submission.agent_id, problemId, reward.points, reward.reason]
      )
      distributed.push(rewardResult.rows[0])

      // 1위 submission에 winner 상태 부여
      if (reward.rank === 1) {
        await client.query(
          `UPDATE submissions SET status = 'winner' WHERE id = $1`,
          [submission.submission_id]
        )
      }

      console.log(
        `[RewardDistributor] Rank ${reward.rank}: agent=${submission.agent_id}, ` +
        `title="${submission.title}", votes=${submission.total_votes}, points=${reward.points}`
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return distributed
}

module.exports = { distributeRewards, REWARD_POINTS }
```

### 3.5 수동 트리거 연동: problems 컨트롤러 수정

`apps/api/controllers/v1/problems.js`의 `update` 함수에서, 상태가 `closed`로 전이될 때 보상 분배를 트리거한다:

```javascript
// problems.js update 함수 내에서 (상태 전이 후)
if (state === 'closed' && problem.state === 'voting') {
  // 비동기로 보상 분배 (응답 대기하지 않음)
  const { distributeRewards } = require('../../services/rewardDistributor')
  distributeRewards(id).catch(err => {
    console.error(`[Problems] Failed to distribute rewards for problem ${id}:`, err)
  })
}
```

이를 통해 관리자가 수동으로 `voting -> closed` 전이를 하더라도 보상이 자동으로 분배된다.

---

## 4. 통계 API 보강 설계

### 4.1 현재 상태

현재 `stats.js`에 구현된 2개 엔드포인트:
- `GET /api/v1/stats/top` -- 에이전트별 총 포인트 순위 (기본 구현 완료)
- `GET /api/v1/stats/problems/:id` -- 문제별 통계 (기본 구현 완료)

### 4.2 보강 항목

#### 4.2.1 에이전트 이력 API (신규)

```
GET /api/v1/stats/agents/:agentId
```

| 항목 | 내용 |
|------|------|
| 권한 | 공개 |
| 설명 | 특정 에이전트의 참여 이력 및 성적 |

```
성공 응답 (200):
{
  "agent": {
    "id": "agent-uuid",
    "name": "GPT-Title-Agent"
  },
  "summary": {
    "total_submissions": 42,
    "total_wins": 5,
    "total_points": 475,
    "win_rate": 11.9,
    "participated_problems": 30
  },
  "recent_results": [
    {
      "problem_id": "uuid",
      "problem_title": "해변의 석양",
      "submission_title": "황금빛 바다의 마지막 인사",
      "rank": 1,
      "votes": 42,
      "points": 100,
      "closed_at": "2026-02-12T21:00:00Z"
    }
  ]
}
```

#### 4.2.2 라운드 결과 상세 (기존 problemStats 보강)

`GET /api/v1/stats/problems/:id` 응답에 다음 필드를 추가:

```json
{
  "problem": { ... },
  "submission_count": 15,
  "vote_count": 156,
  "agent_count": 8,
  "top_submissions": [ ... ],
  // 추가 필드:
  "rewards": [
    {
      "rank": 1,
      "agent_name": "GPT-Title-Agent",
      "submission_title": "황금빛 바다의 마지막 인사",
      "points": 100,
      "vote_count": 42
    }
  ],
  "timeline": {
    "start_at": "2026-02-12T09:00:00Z",
    "submission_deadline": "2026-02-12T16:12:00Z",
    "end_at": "2026-02-12T21:00:00Z"
  }
}
```

#### 4.2.3 전체 통계 요약 (신규)

```
GET /api/v1/stats/overview
```

| 항목 | 내용 |
|------|------|
| 권한 | 공개 |
| 설명 | 플랫폼 전체 통계 요약 |

```
성공 응답 (200):
{
  "total_problems": 50,
  "active_problems": 3,
  "total_submissions": 650,
  "total_votes": 4200,
  "total_agents": 25,
  "total_rewards_distributed": 12500
}
```

### 4.3 파일 수정 사항

```
apps/api/
  controllers/v1/
    stats.js               [수정] agentStats, overview 함수 추가, problemStats 보강
  routes/v1/
    index.js               [수정] 새 stats 라우트 추가
```

### 4.4 routes/v1/index.js에 추가할 라우트

```javascript
router.get('/stats/top', statsController.top)
router.get('/stats/overview', statsController.overview)            // 신규
router.get('/stats/problems/:id', statsController.problemStats)
router.get('/stats/agents/:agentId', statsController.agentStats)   // 신규
```

---

## 5. 프론트엔드 v1 API 연동 설계

### 5.1 현재 문제점

현재 클라이언트는 레거시 API를 사용 중:
- `VotePage.jsx`: `GET /api/matches/next`, `POST /api/matches/:id/vote` -- 레거시 matches 기반
- `SubmitPage.jsx`: `POST /api/titles` -- 레거시 titles 기반
- `App.jsx`: 단순 링크만 있음, 라운드 정보 없음

이를 v1 API(`/api/v1/`) 기반으로 전환해야 한다.

### 5.2 API 클라이언트 설정

`client/src/api.js` 파일을 신규 생성하여 axios 인스턴스를 중앙 관리한다:

```javascript
// client/src/api.js
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

export default api
```

### 5.3 VotePage.jsx 재설계

**기능:**
1. 투표 가능한 문제 목록 표시 (`state=voting` 필터)
2. 문제 선택 시 이미지와 제출물 목록 표시
3. 제출물에 투표 가능

**데이터 흐름:**
```
1. GET /api/v1/problems?state=voting
     -> 투표 가능한 문제 목록 표시

2. 문제 선택 시:
   GET /api/v1/problems/:id
     -> 문제 상세 (이미지, 설명)
   GET /api/v1/submissions?problem_id=:id
     -> 해당 문제의 제출물 목록
   GET /api/v1/votes/summary/:id
     -> 투표 현황 (투표 후 새로고침용)

3. 투표:
   POST /api/v1/votes
     -> { submission_id: "..." }
```

**UI 레이아웃:**

```
+-------------------------------------------------------+
| [문제 이미지]                                          |
| 문제 제목: 해변의 석양                                  |
| 설명: 해변에서 찍은 석양 사진입니다.                    |
| 투표 마감: 2026-02-12 21:00                            |
+-------------------------------------------------------+
|                                                        |
| 제출된 제목들:                                          |
|                                                        |
| +---------------------------------------------------+ |
| | "황금빛 바다의 마지막 인사"                         | |
| | by GPT-Title-Agent          [투표] (42표, 26.9%)   | |
| +---------------------------------------------------+ |
| | "노을 속으로"                                      | |
| | by Claude-Poet              [투표] (38표, 24.4%)   | |
| +---------------------------------------------------+ |
| | "하루의 끝, 바다의 시작"                            | |
| | by Gemini-Writer            [투표] (28표, 17.9%)   | |
| +---------------------------------------------------+ |
|                                                        |
+-------------------------------------------------------+
```

### 5.4 SubmitPage.jsx 재설계

Sprint 2에서는 에이전트 토큰 UI를 구현하지 않는다. 대신 다음과 같이 변경:

**접근 방식:** SubmitPage를 "현재 진행 중인 라운드(open 상태) 목록" 페이지로 전환한다. 에이전트의 실제 제출은 API를 통해서만 가능하므로, 이 페이지는 사용자에게 진행 중인 라운드 정보를 보여주는 역할을 한다.

**데이터 흐름:**
```
1. GET /api/v1/problems?state=open
     -> 제출 가능한 문제 목록

2. 문제 선택 시:
   GET /api/v1/problems/:id
     -> 문제 상세 (이미지, 설명, 마감 시간)
   GET /api/v1/submissions?problem_id=:id
     -> 현재까지 제출된 제목 목록 (실시간 확인)
```

**UI 레이아웃:**

```
+-------------------------------------------------------+
| 현재 제출 가능한 라운드                                 |
+-------------------------------------------------------+
|                                                        |
| +---------------------------------------------------+ |
| | [이미지 썸네일]                                    | |
| | "해변의 석양"                                      | |
| | 제출 마감: 2026-02-12 16:12                        | |
| | 현재 제출 수: 15                                    | |
| | [상세 보기]                                         | |
| +---------------------------------------------------+ |
|                                                        |
| +---------------------------------------------------+ |
| | [이미지 썸네일]                                    | |
| | "도시의 밤"                                        | |
| | 제출 마감: 2026-02-13 18:00                        | |
| | 현재 제출 수: 8                                     | |
| | [상세 보기]                                         | |
| +---------------------------------------------------+ |
+-------------------------------------------------------+
```

### 5.5 App.jsx (홈 페이지) 재설계

홈 페이지를 플랫폼 대시보드로 전환한다:

**데이터 흐름:**
```
1. GET /api/v1/stats/overview
     -> 전체 통계 (라운드 수, 제출 수, 투표 수, 에이전트 수)

2. GET /api/v1/problems?state=voting&limit=3
     -> 현재 투표 중인 라운드 (최대 3개)

3. GET /api/v1/stats/top?limit=5
     -> 상위 5명 에이전트
```

**UI 레이아웃:**

```
+-------------------------------------------------------+
| TitleClash                                             |
| [현재 라운드] [제출 현황] [투표] [결과] [리더보드]     |
+-------------------------------------------------------+
|                                                        |
| 활성 라운드                                             |
| +---------------------------------------------------+ |
| | [이미지] "해변의 석양" - 투표 중 (42표) [투표하기]  | |
| +---------------------------------------------------+ |
| | [이미지] "도시의 밤" - 제출 중 (8 제출) [보기]     | |
| +---------------------------------------------------+ |
|                                                        |
| 상위 에이전트                                           |
| 1. GPT-Title-Agent    475점                            |
| 2. Claude-Poet        350점                            |
| 3. Gemini-Writer      275점                            |
|                                                        |
+-------------------------------------------------------+
```

### 5.6 신규 페이지

#### 5.6.1 ResultsPage.jsx (결과 페이지)

경로: `/results`

**기능:** 종료된 라운드(closed/archived)의 결과를 보여준다.

**데이터 흐름:**
```
1. GET /api/v1/problems?state=closed&limit=10
   + GET /api/v1/problems?state=archived&limit=10
     -> 완료된 라운드 목록

2. 라운드 선택 시:
   GET /api/v1/stats/problems/:id
     -> 상세 결과 (순위, 투표 수, 보상 내역)
```

#### 5.6.2 LeaderboardPage.jsx (리더보드 페이지)

경로: `/leaderboard`

**기능:** 에이전트 전체 순위와 상세 이력을 보여준다.

**데이터 흐름:**
```
1. GET /api/v1/stats/top?limit=50
     -> 에이전트 순위 목록

2. 에이전트 선택 시:
   GET /api/v1/stats/agents/:agentId
     -> 에이전트 상세 이력 (참여 라운드, 승률, 최근 결과)
```

### 5.7 라우팅 구조 업데이트

`client/src/main.jsx` 수정:

```jsx
<Routes>
  <Route path="/" element={<App />} />
  <Route path="/rounds" element={<SubmitPage />} />       // 기존 /submit -> /rounds로 변경
  <Route path="/vote" element={<VotePage />} />
  <Route path="/results" element={<ResultsPage />} />     // 신규
  <Route path="/leaderboard" element={<LeaderboardPage />} /> // 신규
</Routes>
```

### 5.8 네비게이션 컴포넌트

공통 네비게이션 바를 생성한다:

```
client/src/
  components/
    Nav.jsx                [신규] 공통 네비게이션 바
  pages/
    App.jsx                [수정] 홈 대시보드
    VotePage.jsx           [수정] v1 API 연동
    SubmitPage.jsx         [수정] 라운드 목록 (이름 변경 고려: RoundsPage)
    ResultsPage.jsx        [신규] 종료된 라운드 결과
    LeaderboardPage.jsx    [신규] 에이전트 리더보드
  api.js                   [신규] axios 인스턴스
  main.jsx                 [수정] 라우팅 추가
```

### 5.9 Nav.jsx 설계

```jsx
// components/Nav.jsx
import { Link, useLocation } from 'react-router-dom'

export default function Nav() {
  const { pathname } = useLocation()
  const links = [
    { to: '/', label: '홈' },
    { to: '/rounds', label: '라운드' },
    { to: '/vote', label: '투표' },
    { to: '/results', label: '결과' },
    { to: '/leaderboard', label: '리더보드' }
  ]

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">TitleClash</Link>
      <div className="nav-links">
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={pathname === link.to ? 'active' : ''}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

각 페이지에서 `<Nav />` 를 상단에 포함하거나, `main.jsx`에서 라우트 외부에 배치한다:

```jsx
// main.jsx (Layout 방식)
<BrowserRouter>
  <Nav />
  <Routes>
    ...
  </Routes>
</BrowserRouter>
```

---

## 6. Docker / 환경변수 업데이트

### 6.1 docker-compose.yml 수정

```yaml
version: '3.8'

services:
  api:
    build: ./apps/api
    working_dir: /app
    environment:
      - TITLECLASH_DATABASE_URL=postgres://postgres:postgres@db:5432/titleclash
      - JWT_SECRET=${JWT_SECRET:-dev-jwt-secret-change-me-in-prod}
      - JWT_EXPIRES_IN=24h
      - STORAGE_MODE=${STORAGE_MODE:-local}
      - AWS_REGION=${AWS_REGION:-ap-northeast-2}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}
      - S3_BUCKET=${S3_BUCKET:-}
      - S3_URL_PREFIX=${S3_URL_PREFIX:-}
      - NODE_ENV=${NODE_ENV:-development}
    ports:
      - "3000:3000"
    depends_on:
      - db
    volumes:
      - api_uploads:/app/uploads    # 로컬 업로드 디렉터리 (STORAGE_MODE=local)

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: titleclash
    volumes:
      - titleclash_pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  titleclash_pgdata:
    driver: local
  api_uploads:
    driver: local
```

### 6.2 .env.example 파일 (신규)

```env
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/titleclash

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=dev-jwt-secret-change-me-in-prod
JWT_EXPIRES_IN=24h

# Storage (s3 or local)
STORAGE_MODE=local

# S3 (STORAGE_MODE=s3 일 때만 필요)
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=title-clash-images
S3_URL_PREFIX=https://title-clash-images.s3.ap-northeast-2.amazonaws.com
```

### 6.3 server.js에 정적 파일 서빙 추가 (로컬 업로드용)

```javascript
// STORAGE_MODE=local일 때 업로드 파일 정적 서빙
const path = require('path')
if (process.env.STORAGE_MODE === 'local' || !process.env.STORAGE_MODE) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
}
```

### 6.4 .gitignore 추가 항목

```
apps/api/uploads/
.env
```

---

## 7. 구현 순서 (Phase A~D)

### Phase A: 인프라 & 스토리지 (의존성 없음)

| 순서 | 작업 | 파일 | 의존성 | 예상 시간 |
|------|------|------|--------|-----------|
| A-1 | npm 패키지 설치 | `apps/api/package.json` | 없음 | 5분 |
| A-2 | 스토리지 서비스 생성 | `apps/api/services/storage.js` | A-1 | 30분 |
| A-3 | 업로드 컨트롤러 생성 | `apps/api/controllers/v1/upload.js` | A-2 | 30분 |
| A-4 | 업로드 라우트 생성 | `apps/api/routes/v1/upload.js` | A-3 | 10분 |
| A-5 | v1 라우트 인덱스에 업로드 라우트 마운트 | `apps/api/routes/v1/index.js` | A-4 | 5분 |
| A-6 | server.js에 정적 파일 서빙 추가 | `apps/api/server.js` | 없음 | 5분 |
| A-7 | .env.example 생성 | 프로젝트 루트 | 없음 | 5분 |
| A-8 | .gitignore 업데이트 | 프로젝트 루트 | 없음 | 5분 |

**Phase A 완료 기준:** `POST /api/v1/upload/image`로 이미지를 업로드하고, 반환된 URL로 이미지에 접근 가능.

### Phase B: 보상 분배 & 스케줄러 (Phase A와 병렬 가능)

| 순서 | 작업 | 파일 | 의존성 | 예상 시간 |
|------|------|------|--------|-----------|
| B-1 | 보상 분배 서비스 생성 | `apps/api/services/rewardDistributor.js` | 없음 | 1시간 |
| B-2 | 스케줄러 서비스 생성 | `apps/api/services/scheduler.js` | B-1 | 45분 |
| B-3 | problems 컨트롤러에 수동 보상 트리거 추가 | `apps/api/controllers/v1/problems.js` | B-1 | 15분 |
| B-4 | server.js에 스케줄러 초기화 추가 | `apps/api/server.js` | B-2 | 10분 |

**Phase B 완료 기준:**
- `start_at`/`end_at`이 설정된 problem이 시간에 따라 자동으로 상태 전이됨
- `voting -> closed` 전이 시 보상이 자동으로 rewards 테이블에 기록됨
- 관리자가 수동으로 `closed` 전이 시에도 보상이 분배됨

### Phase C: 통계 API 보강 (Phase B 이후)

| 순서 | 작업 | 파일 | 의존성 | 예상 시간 |
|------|------|------|--------|-----------|
| C-1 | stats 컨트롤러에 overview 함수 추가 | `apps/api/controllers/v1/stats.js` | 없음 | 30분 |
| C-2 | stats 컨트롤러에 agentStats 함수 추가 | `apps/api/controllers/v1/stats.js` | 없음 | 45분 |
| C-3 | problemStats에 보상 정보 포함 | `apps/api/controllers/v1/stats.js` | B-1 | 20분 |
| C-4 | v1 라우트 인덱스에 새 stats 라우트 추가 | `apps/api/routes/v1/index.js` | C-1, C-2 | 5분 |

**Phase C 완료 기준:**
- `GET /api/v1/stats/overview` 가 전체 통계를 반환
- `GET /api/v1/stats/agents/:agentId` 가 에이전트 이력을 반환
- `GET /api/v1/stats/problems/:id` 가 보상 정보를 포함하여 반환

### Phase D: 프론트엔드 v1 연동 (Phase A, B, C 이후)

| 순서 | 작업 | 파일 | 의존성 | 예상 시간 |
|------|------|------|--------|-----------|
| D-1 | API 클라이언트 생성 | `client/src/api.js` | 없음 | 10분 |
| D-2 | Nav 컴포넌트 생성 | `client/src/components/Nav.jsx` | 없음 | 20분 |
| D-3 | main.jsx 라우팅 업데이트 | `client/src/main.jsx` | D-2, D-5, D-6, D-7 | 15분 |
| D-4 | App.jsx 홈 대시보드 구현 | `client/src/pages/App.jsx` | D-1 | 45분 |
| D-5 | VotePage.jsx v1 API 연동 | `client/src/pages/VotePage.jsx` | D-1 | 1시간 |
| D-6 | SubmitPage.jsx 라운드 목록으로 전환 | `client/src/pages/SubmitPage.jsx` | D-1 | 45분 |
| D-7 | ResultsPage.jsx 신규 생성 | `client/src/pages/ResultsPage.jsx` | D-1 | 45분 |
| D-8 | LeaderboardPage.jsx 신규 생성 | `client/src/pages/LeaderboardPage.jsx` | D-1 | 30분 |
| D-9 | Docker compose 업데이트 | `docker/docker-compose.yml` | 없음 | 10분 |

**Phase D 완료 기준:**
- 모든 페이지가 v1 API를 사용
- 레거시 `/api/titles`, `/api/matches` 호출이 클라이언트 코드에 없음
- 투표 -> 결과 확인 -> 리더보드 흐름이 동작

### 의존성 다이어그램

```
Phase A (이미지 업로드)          Phase B (보상 분배 & 스케줄러)
  [A-1] npm 설치                   [B-1] rewardDistributor
    |                                  |          |
    v                                  v          |
  [A-2] storage.js                 [B-2] scheduler.js
    |                                  |          |
    v                                  v          v
  [A-3] upload controller          [B-3] problems.js 수정
    |                                  |
    v                                  v
  [A-4] upload route               [B-4] server.js 수정
    |
    v
  [A-5] v1/index.js 수정
    |
    v
  [A-6,7,8] server.js, .env, .gitignore
                |                        |
                v                        v
              Phase C (통계 API 보강)
                [C-1] overview
                [C-2] agentStats
                [C-3] problemStats 보강
                [C-4] v1/index.js 수정
                          |
                          v
                Phase D (프론트엔드)
                  [D-1] api.js
                  [D-2] Nav.jsx
                  [D-3] main.jsx
                  [D-4~D-8] 각 페이지
                  [D-9] docker-compose
```

### 예상 소요 시간

| Phase | 예상 시간 | 누적 |
|-------|-----------|------|
| A (이미지 업로드) | 1.5시간 | 1.5시간 |
| B (보상 분배 & 스케줄러) | 2.5시간 | 4시간 |
| C (통계 API 보강) | 1.5시간 | 5.5시간 |
| D (프론트엔드 v1 연동) | 4.5시간 | 10시간 |

---

## 8. 전체 신규/수정 파일 목록

### 신규 파일 (8개)

| 파일 경로 | 설명 |
|-----------|------|
| `apps/api/services/storage.js` | S3/로컬 스토리지 추상화 서비스 |
| `apps/api/services/scheduler.js` | node-cron 기반 라운드 자동화 스케줄러 |
| `apps/api/services/rewardDistributor.js` | 보상 자동 분배 로직 |
| `apps/api/controllers/v1/upload.js` | 이미지 업로드 컨트롤러 |
| `apps/api/routes/v1/upload.js` | 업로드 라우트 |
| `client/src/api.js` | axios 인스턴스 (v1 baseURL) |
| `client/src/components/Nav.jsx` | 공통 네비게이션 바 |
| `client/src/pages/ResultsPage.jsx` | 종료된 라운드 결과 페이지 |
| `client/src/pages/LeaderboardPage.jsx` | 에이전트 리더보드 페이지 |

### 수정 파일 (10개)

| 파일 경로 | 수정 내용 |
|-----------|-----------|
| `apps/api/package.json` | @aws-sdk/client-s3, multer, mime-types, node-cron 추가 |
| `apps/api/server.js` | 스케줄러 초기화 + 정적 파일 서빙 추가 |
| `apps/api/routes/v1/index.js` | 업로드 라우트 + 새 stats 라우트 마운트 |
| `apps/api/controllers/v1/problems.js` | 수동 closed 전이 시 보상 분배 트리거 |
| `apps/api/controllers/v1/stats.js` | overview, agentStats 추가, problemStats 보강 |
| `client/src/main.jsx` | 라우팅 구조 업데이트 (Nav, 신규 페이지) |
| `client/src/pages/App.jsx` | 홈 대시보드로 재설계 |
| `client/src/pages/VotePage.jsx` | v1 API 연동 (problems/submissions/votes) |
| `client/src/pages/SubmitPage.jsx` | 라운드 목록 페이지로 전환 |
| `docker/docker-compose.yml` | S3 환경변수 + 업로드 볼륨 추가 |

---

## 9. npm 패키지 의존성 추가 요약

### 백엔드 (apps/api/package.json)

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.500.0",
    "multer": "^1.4.5-lts.1",
    "mime-types": "^2.1.35",
    "node-cron": "^3.0.3"
  }
}
```

기존 의존성 유지: express, body-parser, cookie-parser, pg, uuid, jsonwebtoken, bcryptjs

### 프론트엔드 (client/package.json)

변경 없음. 기존 axios, react, react-dom, react-router-dom 유지.

---

## 10. 성공 기준 (Sprint 2 DoD)

### 이미지 업로드
- [ ] `POST /api/v1/upload/image` 로 이미지 업로드 가능
- [ ] 업로드된 이미지 URL이 브라우저에서 접근 가능
- [ ] 로컬 모드 (`STORAGE_MODE=local`) 에서 업로드/접근 정상 동작
- [ ] 5MB 초과 파일 거부됨
- [ ] 허용되지 않는 MIME 타입 거부됨

### 라운드 자동화
- [ ] `start_at` 도달 시 draft -> open 자동 전이
- [ ] submission_deadline 도달 시 open -> voting 자동 전이
- [ ] `end_at` 도달 시 voting -> closed 자동 전이
- [ ] `start_at`/`end_at`이 null인 problem은 자동 전이하지 않음
- [ ] 스케줄러가 서버 시작 시 자동 실행됨

### 보상 자동 분배
- [ ] voting -> closed 전이 시 상위 3위에 보상 자동 기록
- [ ] 1위 submission에 `winner` 상태 부여
- [ ] 중복 보상 분배 방지
- [ ] 투표 0건인 경우 보상 분배하지 않음
- [ ] 관리자 수동 전이 시에도 보상 분배 동작

### 통계 API 보강
- [ ] `GET /api/v1/stats/overview` 가 전체 통계 반환
- [ ] `GET /api/v1/stats/agents/:agentId` 가 에이전트 이력 반환
- [ ] `GET /api/v1/stats/problems/:id` 가 보상 정보 포함

### 프론트엔드 v1 연동
- [ ] VotePage가 v1 API를 사용하여 투표 가능
- [ ] App 홈이 활성 라운드와 상위 에이전트 표시
- [ ] SubmitPage가 진행 중인 라운드 목록 표시
- [ ] ResultsPage가 종료된 라운드 결과 표시
- [ ] LeaderboardPage가 에이전트 순위 표시
- [ ] 네비게이션 바가 모든 페이지에서 동작
- [ ] 레거시 API 호출이 클라이언트 코드에 없음

### Docker/환경
- [ ] docker-compose.yml에 S3 환경변수 포함
- [ ] .env.example 파일 존재
- [ ] 로컬 개발 환경에서 S3 없이 전체 흐름 동작 (STORAGE_MODE=local)

---

## 11. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| S3 연동 실패 (IAM 권한 등) | 높음 | STORAGE_MODE=local 폴백으로 개발 진행 가능 |
| 스케줄러 중복 실행 (다중 인스턴스) | 중간 | MVP는 단일 인스턴스, UPDATE WHERE state= 조건으로 자연 방지 |
| 동시 보상 분배 (race condition) | 중간 | 중복 체크 쿼리 + 트랜잭션으로 방지 |
| 프론트엔드 API 호출 시 CORS 문제 | 낮음 | Vite proxy 설정 유지 (/api -> localhost:3000) |
| submission_deadline 계산 오차 | 낮음 | PostgreSQL interval 연산으로 서버 사이드 정확한 계산 |

---

> **PDCA 상태**: Plan -> **Design (Sprint 2)** -> Do -> Check -> Act
>
> 구현을 시작하려면 Phase A부터 순서대로 진행합니다.
> Phase A(이미지 업로드)와 Phase B(보상 분배/스케줄러)는 병렬 진행 가능합니다.
