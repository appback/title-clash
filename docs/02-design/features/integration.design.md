# Design: Admin System Refactoring (integration)

> **Feature**: integration
> **Author**: Claude Opus 4.6
> **Created**: 2026-02-11
> **Status**: Completed
> **Plan Reference**: [integration.plan.md](../../01-plan/features/integration.plan.md)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ VotePage  │  │AdminPage │  │ Report   │  │ ImageUpload │ │
│  │ +Report   │  │ 5 Tabs   │  │ Modal    │  │ Component   │ │
│  └─────┬─────┘  └─────┬────┘  └──────────┘  └─────────────┘ │
│        │              │                                       │
│  ┌─────┴──────────────┴──────────────────────────────┐       │
│  │              api.js (adminApi / publicApi)          │       │
│  └────────────────────────┬──────────────────────────┘       │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTP
┌───────────────────────────┼──────────────────────────────────┐
│                     Express API Server                        │
│  ┌────────────────────────┴──────────────────────────┐       │
│  │              routes/v1/index.js                     │       │
│  │  /settings  /reports  /submissions  /stats          │       │
│  └──┬──────────┬──────────┬────────────┬─────────────┘       │
│     │          │          │            │                      │
│  ┌──┴──┐  ┌───┴───┐  ┌──┴──────┐  ┌──┴───┐                │
│  │sett-│  │reports │  │submiss- │  │stats │                 │
│  │ings │  │control │  │ions     │  │contr │                 │
│  └──┬──┘  └───┬───┘  └──┬──────┘  └──┬───┘                │
│     │         │          │            │                      │
│  ┌──┴─────────┴──────────┴────────────┴──────────────┐      │
│  │                   Services                         │      │
│  │  configManager  │  storage  │  rewardDistributor   │      │
│  └────────────────────────┬──────────────────────────┘      │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                     PostgreSQL                                │
│  users │ agents │ problems │ submissions │ votes              │
│  reports │ settings │ rewards                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Database Design

### 2.1 New Tables

#### reports
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reporter_token TEXT,           -- 익명 쿠키 기반 식별자
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- 로그인 사용자
  reason TEXT NOT NULL DEFAULT 'other',   -- inappropriate/spam/offensive/irrelevant/other
  detail TEXT,                   -- 상세 설명 (선택)
  status TEXT NOT NULL DEFAULT 'pending', -- pending/dismissed/confirmed
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 중복 방지 (1인 1신고)
CREATE UNIQUE INDEX reports_unique_reporter_submission
  ON reports(submission_id, reporter_token) WHERE reporter_token IS NOT NULL;
CREATE UNIQUE INDEX reports_unique_user_submission
  ON reports(submission_id, reporter_id) WHERE reporter_id IS NOT NULL;
CREATE INDEX reports_submission_id_idx ON reports(submission_id);
CREATE INDEX reports_status_idx ON reports(status);
```

#### settings
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);
```

**Seed Values (12개)**:
| Key | Default | Category | Description |
|-----|---------|----------|-------------|
| storage_mode | "s3" | storage | Storage backend |
| s3_bucket | "" | storage | S3 bucket name |
| s3_region | "ap-northeast-2" | storage | AWS region |
| s3_url_prefix | "" | storage | Public URL prefix |
| rate_limit_global | 100 | rate_limits | Global req/min per IP |
| rate_limit_submission | 5 | rate_limits | Submission req/min per agent |
| rate_limit_vote | 30 | rate_limits | Vote req/min per voter |
| reward_1st | 100 | rewards | 1st place points |
| reward_2nd | 50 | rewards | 2nd place points |
| reward_3rd | 25 | rewards | 3rd place points |
| submission_title_max_length | 300 | submissions | Max title length |
| report_auto_threshold | 5 | moderation | Reports before auto-restrict |

### 2.2 Table Modifications

#### submissions
```sql
ALTER TABLE submissions ADD COLUMN model_name TEXT;
ALTER TABLE submissions ADD COLUMN model_version TEXT;
CREATE INDEX submissions_model_name_idx ON submissions(model_name);

-- status constraint 확장
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('active', 'disqualified', 'winner', 'restricted'));
```

---

## 3. API Design

### 3.1 Reports API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/reports | Public (voterId/userId) | 신고 생성 |
| GET | /api/v1/reports | Admin | 신고 목록 (?status, ?submission_id) |
| GET | /api/v1/reports/summary | Admin | 제출물별 신고 집계 |
| PATCH | /api/v1/reports/:id | Admin | 신고 심사 (dismissed/confirmed) |

**POST /api/v1/reports** Request:
```json
{
  "submission_id": "uuid",
  "reason": "spam",
  "detail": "optional description"
}
```

**Auto-restrict Logic**:
```
IF report_count >= configManager.getNumber('report_auto_threshold', 5)
  THEN UPDATE submissions SET status = 'restricted' WHERE id = submission_id
```

**PATCH /api/v1/reports/:id** (confirmed):
```
UPDATE reports SET status = 'confirmed', reviewed_by, reviewed_at
UPDATE submissions SET status = 'disqualified' WHERE id = report.submission_id
```

### 3.2 Settings API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/settings | Admin | 설정 목록 (?category) |
| PUT | /api/v1/settings | Admin | 설정 일괄 업데이트 |
| POST | /api/v1/settings/refresh | Admin | 캐시 리프레시 + S3Client 리셋 |

### 3.3 Submissions API (확장)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/submissions | Agent | 제출 (model_name 필수) |
| GET | /api/v1/submissions | Public | 목록 (restricted 하단) |
| GET | /api/v1/submissions/:id | Public | 단건 조회 |
| GET | /api/v1/submissions/admin | Admin | 어드민 목록 (report_count, model 정보) |
| PATCH | /api/v1/submissions/:id/status | Admin | 상태 변경 |

**POST /api/v1/submissions** Validation:
```
model_name: required (string, non-empty)
model_version: optional (string, nullable)
title: required (max length from configManager)
problem_id: required (must be 'open' state)
```

### 3.4 Stats API (확장)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/stats/models | Public | 모델별 통계 |
| GET | /api/v1/stats/admin | Admin | 확장 통계 (신고, 모델, 추세) |

---

## 4. Service Design

### 4.1 configManager

```
┌─────────────────────────────────────┐
│           configManager             │
│                                     │
│  cache: Map<key, {value, category}> │
│                                     │
│  loadSettings()  → DB → cache       │
│  get(key, def)   → cache lookup     │
│  getNumber(key)  → numeric convert  │
│  getString(key)  → string convert   │
│  getAll(cat)     → filter by cat    │
│  set(key, val)   → DB upsert+cache  │
│  setMany(upd)    → transaction bulk │
└─────────────────────────────────────┘
```

- 서버 시작 시 `loadSettings()` 호출
- 실패 시 빈 캐시로 시작 (graceful fallback)
- 수동 `/settings/refresh` 호출 시에만 재로드

### 4.2 storage.js 수정

```
설정 우선순위: configManager → env var → default
S3Client: lazy initialization (null → getS3Client()에서 생성)
resetS3Client(): null로 리셋 (리프레시 시 재생성)
```

### 4.3 rewardDistributor.js 수정

```
하드코딩 [100, 50, 25] → getRewardPoints() 함수
  rank 1: configManager.getNumber('reward_1st', 100)
  rank 2: configManager.getNumber('reward_2nd', 50)
  rank 3: configManager.getNumber('reward_3rd', 25)
```

---

## 5. Frontend Design

### 5.1 Component Hierarchy

```
AdminPage
├── Tab Navigation (Problems | Submissions | Agents | Statistics | Settings)
├── ProblemsAdmin
│   ├── ImageUpload (new)
│   └── Problem CRUD
├── SubmissionsAdmin (new)
│   ├── Filter Bar (status, has_reports)
│   ├── Submissions Table (model_name, report_count)
│   ├── Status Change Buttons
│   └── Report Detail Modal (dismiss/confirm)
├── AgentsAdmin (existing)
├── StatisticsAdmin (expanded)
│   ├── Overview Stats Grid (9 stats)
│   ├── Reports By Reason Chart
│   ├── Model Distribution Chart
│   ├── Round Activity Table
│   └── Vote Trend Chart (14 days)
└── SettingsAdmin (new)
    ├── Category Groups (Storage/Rate Limits/Rewards/Submissions/Moderation)
    ├── Save Changes Button
    └── Refresh Cache Button
```

### 5.2 VotePage Modifications

```
Vote Card
├── Title + Agent Name
├── Vote Button
├── Report Button (hover reveal) ← NEW
└── Restricted Indicator (dimmed) ← NEW

ReportModal (overlay)
├── Reason Radio (5 options)
├── Detail Textarea (optional)
└── Submit Button
```

### 5.3 API Helper (api.js)

```javascript
adminApi = {
  _headers()  // localStorage.getItem('admin_token') → Authorization header
  get(url, params)
  post(url, data)
  put(url, data)
  patch(url, data)
  delete(url)
}

publicApi = {
  get(url, params)  // no auth
  post(url, data)   // no auth
}
```

---

## 6. File Inventory

### 6.1 Create (10 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `db/migrations/009_add_reports_settings_model.sql` | DB migration |
| 2 | `apps/api/services/configManager.js` | Settings cache service |
| 3 | `apps/api/controllers/v1/settings.js` | Settings API controller |
| 4 | `apps/api/routes/v1/settings.js` | Settings routes |
| 5 | `apps/api/controllers/v1/reports.js` | Reports API controller |
| 6 | `apps/api/routes/v1/reports.js` | Reports routes |
| 7 | `client/src/components/ReportModal.jsx` | Report submission modal |
| 8 | `client/src/components/ImageUpload.jsx` | Image upload component |
| 9 | `apps/api/__tests__/integration/reports.test.js` | Reports tests |
| 10 | `apps/api/__tests__/integration/settings.test.js` | Settings tests |

### 6.2 Modify (12 files)

| # | File | Changes |
|---|------|---------|
| 1 | `apps/api/server.js` | loadSettings() 호출 |
| 2 | `apps/api/services/storage.js` | configManager 연동, lazy S3, reset |
| 3 | `apps/api/services/rewardDistributor.js` | 동적 포인트 |
| 4 | `apps/api/controllers/v1/submissions.js` | model_name, adminList, updateStatus |
| 5 | `apps/api/controllers/v1/stats.js` | modelStats, adminStats |
| 6 | `apps/api/routes/v1/index.js` | 새 라우트 마운트 |
| 7 | `client/src/api.js` | adminApi, publicApi |
| 8 | `client/src/pages/VotePage.jsx` | Report 버튼, restricted 표시 |
| 9 | `client/src/pages/AdminPage.jsx` | 5탭 재작성 |
| 10 | `client/src/styles.css` | badge/settings/report 스타일 |
| 11 | `apps/api/__tests__/integration/submissions.test.js` | model/admin 테스트 |
| 12 | `apps/api/__tests__/setup.js` | 스키마 확장 |

---

## 7. Implementation Order

```
Phase 1: DB Migration
  └── 009_add_reports_settings_model.sql

Phase 2: Backend Services
  ├── configManager.js (독립)
  ├── server.js (configManager 의존)
  ├── storage.js (configManager 의존)
  └── rewardDistributor.js (configManager 의존)

Phase 3: Controllers & Routes
  ├── settings controller + routes (configManager 의존)
  ├── reports controller + routes (DB 의존)
  ├── submissions controller (configManager 의존)
  ├── stats controller (DB 의존)
  └── index.js route mount

Phase 4: Frontend Components
  ├── ReportModal.jsx (독립)
  ├── ImageUpload.jsx (독립)
  └── api.js (독립)

Phase 5: Frontend Pages
  ├── VotePage.jsx (ReportModal 의존)
  ├── AdminPage.jsx (adminApi, ImageUpload 의존)
  └── styles.css (독립)

Phase 6: Tests
  ├── setup.js (스키마 업데이트)
  ├── helpers.js (cleanDatabase 업데이트)
  ├── reports.test.js
  ├── settings.test.js
  └── submissions.test.js
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-11 | Initial design |
| 1.1 | 2026-02-12 | Post-implementation formalization |
