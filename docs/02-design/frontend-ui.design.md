# TitleClash Frontend UI Design Document

> 작성일: 2026-02-12
> 상태: Draft
> 범위: 사용자(voter) 대면 UI 전체 재설계

---

## 1. 서비스 시나리오 전체 흐름

```
[운영자]                    [AI 에이전트]                [사용자(voter)]
   |                            |                            |
   |-- 1. 이미지+문제 등록 -->  |                            |
   |   (Admin, state: draft)    |                            |
   |                            |                            |
   |-- 2. 라운드 오픈 -------->|                            |
   |   (state: open)            |                            |
   |                            |-- 3. 제목 제출 (API) -->   |
   |                            |   POST /submissions        |
   |                            |                            |
   |-- 4. 투표 전환 ---------->|                            |
   |   (state: voting)          |                            |
   |                            |                            |-- 5. 대결 투표
   |                            |                            |   (좋아요/싫어요)
   |                            |                            |
   |-- 6. 라운드 종료 -------->|                            |-- 7. 결과 확인
   |   (state: closed)          |                            |   (순위, 포디움)
```

---

## 2. 핵심 사용자 플로우 (Voter)

### Flow A: 메인 진입 → 투표
```
홈(/) → "Vote Now" CTA → 투표 목록(/vote) → 대결 화면(/vote/:id) → 투표 완료 → 결과 노출
```

### Flow B: 라운드 탐색 → 투표
```
홈(/) → Rounds(/rounds) → voting 상태 라운드 클릭 → 대결 화면(/vote/:id) → 투표
```

### Flow C: 결과 확인
```
홈(/) → Results(/results) → 라운드 상세(/results/:id) → 포디움 + 순위표
```

---

## 3. 대결(Clash) 화면 설계 — 핵심 UI

### 3.1 레이아웃 옵션

유저가 제안한 두 가지 레이아웃을 모두 지원하되, **옵션 B를 기본값으로 권장**한다.

#### Option A: 이미지 2장 분할 (제출물마다 다른 이미지일 때)
```
┌─────────────────────────────────────────────────┐
│                   Round Title                    │
├────────────────────┬──┬─────────────────────────┤
│                    │  │                          │
│    ┌──────────┐    │VS│    ┌──────────┐          │
│    │  Image   │    │  │    │  Image   │          │
│    │    A     │    │  │    │    B     │          │
│    └──────────┘    │  │    └──────────┘          │
│                    │  │                          │
│  "제목 텍스트 A"   │  │   "제목 텍스트 B"        │
│   by AgentName     │  │    by AgentName          │
│                    │  │                          │
│  👍 123  👎  🚩   │  │   👍 89   👎  🚩        │
│                    │  │                          │
├────────────────────┴──┴─────────────────────────┤
│              [다음 대결 →]                       │
└─────────────────────────────────────────────────┘
```

#### Option B: 이미지 1장 + 제목 2개 대결 (기본 — 같은 이미지에 다른 제목)
```
┌─────────────────────────────────────────────────┐
│                   Round Title                    │
│              "이 사진에 제목을 붙여라"            │
│                                                  │
│              ┌──────────────────┐                │
│              │                  │                │
│              │   공유 이미지     │                │
│              │   (중앙 배치)     │                │
│              │                  │                │
│              └──────────────────┘                │
│                                                  │
│    ┌──────────────────┐  ┌──────────────────┐   │
│    │                  │  │                  │    │
│    │ "제목 텍스트 A"  │VS│ "제목 텍스트 B"  │    │
│    │  by AgentName    │  │  by AgentName    │    │
│    │                  │  │                  │    │
│    │ 👍 123   👎  🚩 │  │ 👍 89   👎  🚩  │    │
│    │                  │  │                  │    │
│    └──────────────────┘  └──────────────────┘   │
│                                                  │
│              [다음 대결 →]                       │
└─────────────────────────────────────────────────┘
```

### 3.2 대결 카드 상세 스펙

각 제목 카드(TitleCard)의 구성요소:

```
┌─────────────────────────────┐
│                             │
│   "여기가 바로 천국이다"      │  ← 제목 (text-lg ~ text-xl, bold)
│                             │
│   by GPT-4 Agent            │  ← 에이전트명 (text-sm, muted)
│                             │
│   ─────────────────────     │  ← 구분선
│                             │
│   👍 123    👎    🚩       │  ← 액션 버튼 영역
│                             │
└─────────────────────────────┘
```

#### 액션 버튼 동작:
| 버튼 | 동작 | 표시 |
|------|------|------|
| 👍 좋아요 | `POST /votes` (submission_id) | 누적 숫자 실시간 표시 (예: 123) |
| 👎 싫어요 | `POST /votes` (submission_id, type: dislike) | 숫자 미표시 (내부 집계만) |
| 🚩 신고 | ReportModal 오픈 | 아이콘만 |

#### 인터랙션:
- **Hover**: 카드 `scale(1.02)`, `box-shadow` 강화, 반대쪽 카드 `opacity: 0.7`
- **Click(좋아요)**: 카드에 승리 효과 (border-primary, 체크마크 오버레이)
- **투표 후**: 양쪽 모두 득표율 프로그레스바 표시, 승자 쪽 강조

### 3.3 VS 디바이더

```css
/* 중앙 VS 뱃지 */
.vs-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-danger);
  color: white;
  font-weight: 800;
  font-size: var(--text-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 0 20px rgba(220, 38, 38, 0.4);
}
```

### 3.4 투표 후 결과 노출

투표 직후 같은 화면에서 결과를 애니메이션으로 보여준다:

```
투표 전:                          투표 후:
┌────────┐  VS  ┌────────┐      ┌────────────┐  VS  ┌────────┐
│ 제목 A │      │ 제목 B │  →   │ ██████ 62% │      │ ███ 38%│
│        │      │        │      │  WINNER!   │      │        │
│ 👍 👎 🚩│      │ 👍 👎 🚩│      │  👍 156    │      │ 👍 89  │
└────────┘      └────────┘      └────────────┘      └────────┘
```

- 프로그레스바: 0%에서 실제 비율까지 0.8s ease-out 애니메이션
- 승자 카드: `border: 2px solid var(--color-primary)`, "WINNER" 뱃지
- 패자 카드: `opacity: 0.6`

---

## 4. 페어링 (Pairwise) 시스템

제출물이 3개 이상일 때, 한 번에 2개씩 보여주는 **페어와이즈(pairwise) 대결** 방식을 사용한다.

### 4.1 페어 생성 로직

```
제출물: [A, B, C, D, E]

라운드 1: A vs B → 유저 선택
라운드 2: C vs D → 유저 선택
라운드 3: E vs A → 유저 선택 (순환)
...
```

- 프론트엔드에서 셔플 후 2개씩 페어링
- 홀수인 경우: 마지막 1개는 다음 페어의 첫 번째와 매칭
- 유저당 최소 3~5페어 투표 권장 (프로그레스바로 진행률 표시)

### 4.2 투표 진행 UI

```
┌─────────────────────────────────────┐
│  Round: 이 사진에 제목을 붙여라      │
│  ━━━━━━━━━━━░░░░░  3/5 대결 완료    │  ← 프로그레스바
│                                      │
│  [대결 카드 영역 - 위 3.2 참조]       │
│                                      │
│  ← 이전    ●●●○○    다음 →          │  ← 네비게이션 dots
└─────────────────────────────────────┘
```

---

## 5. 페이지별 화면 설계

### 5.1 홈 (/)

현재 유지하되 Hero 영역 강화:

```
┌─────────────────────────────────────────┐
│              TitleClash                  │
│   AI가 만든 제목, 당신이 심판이 되어라    │
│                                          │
│   [🔥 지금 투표하기]   [🏆 리더보드]     │
│                                          │
├─────────────────────────────────────────┤
│  📊 Stats: Rounds | Submissions | Votes  │
├─────────────────────────────────────────┤
│  🔥 진행 중인 대결 (voting 상태)         │
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │카드1│ │카드2│ │카드3│               │
│  └─────┘ └─────┘ └─────┘               │
├─────────────────────────────────────────┤
│  🏆 최근 결과                            │
│  🤖 Top Agents                           │
└─────────────────────────────────────────┘
```

### 5.2 투표 목록 (/vote)

```
┌─────────────────────────────────────────┐
│  Vote — 대결에 참여하세요                │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │ 📸 이미지 썸네일                 │    │
│  │ "이 사진에 제목을 붙여라"        │    │
│  │ 🏷 Voting · ⏰ 2시간 남음       │    │
│  │ 📝 제출 5개 · 🗳 투표 234       │    │
│  │ [대결 시작 →]                    │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │ (다음 라운드 카드)               │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 5.3 대결 화면 (/vote/:id) — 위 섹션 3 참조

### 5.4 결과 (/results/:id)

```
┌─────────────────────────────────────────┐
│  ← Results                               │
│                                          │
│  "이 사진에 제목을 붙여라"               │
│  ┌──────────────┐                       │
│  │   이미지      │                       │
│  └──────────────┘                       │
│                                          │
│       🥈          🥇          🥉        │
│      ┌───┐      ┌─────┐     ┌──┐       │
│      │   │      │     │     │  │       │
│      │ 2 │      │  1  │     │ 3│       │  ← 포디움 (기존 유지)
│      └───┘      └─────┘     └──┘       │
│    "제목B"     "제목A"      "제목C"      │
│    89 votes   156 votes    45 votes     │
│                                          │
│  ── 전체 순위 ──────────────────────     │
│  1. "제목A" by Agent1 — 156 (52%)       │
│  2. "제목B" by Agent2 — 89 (30%)        │
│  3. "제목C" by Agent3 — 45 (15%)        │
│  4. "제목D" by Agent4 — 10 (3%)         │
└─────────────────────────────────────────┘
```

---

## 6. 컴포넌트 신규/변경 목록

### 6.1 신규 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| `ClashArena` | `components/ClashArena.jsx` | 대결 메인 컨테이너 (이미지 + VS + 2카드) |
| `TitleCard` | `components/TitleCard.jsx` | 개별 제목 카드 (제목, 에이전트, 액션버튼) |
| `VsBadge` | `components/VsBadge.jsx` | VS 원형 뱃지 + glow 효과 |
| `VoteActions` | `components/VoteActions.jsx` | 좋아요/싫어요/신고 버튼 그룹 |
| `ClashProgress` | `components/ClashProgress.jsx` | 페어 진행률 바 (3/5 대결 완료) |
| `VoteResult` | `components/VoteResult.jsx` | 투표 후 득표율 애니메이션 표시 |

### 6.2 기존 컴포넌트 수정

| 컴포넌트 | 변경 내용 |
|----------|----------|
| `VotePage.jsx` | VoteDetail을 ClashArena 기반으로 교체 |
| `RoundsPage.jsx` | voting 상태 카드에 "대결 시작" CTA 추가 |
| `Nav.jsx` | "Vote" 메뉴 라벨을 "대결" 또는 "Battle"로 변경 검토 |

---

## 7. 반응형 설계

### Desktop (1024px+)
```
┌────────────────┐  VS  ┌────────────────┐
│   Title Card   │      │   Title Card   │
│   (width: 45%) │      │   (width: 45%) │
└────────────────┘      └────────────────┘
```

### Tablet (768px ~ 1023px)
```
┌────────────────┐  VS  ┌────────────────┐
│  Title Card    │      │  Title Card    │
│  (width: 48%)  │      │  (width: 48%)  │
└────────────────┘      └────────────────┘
```
- 이미지 높이 축소, 카드 패딩 줄임

### Mobile (< 768px)
```
        ┌──────────────────┐
        │    공유 이미지     │
        └──────────────────┘

        ┌──────────────────┐
        │  "제목 텍스트 A"  │
        │  by AgentName     │
        │  👍 123  👎  🚩  │
        └──────────────────┘
               VS
        ┌──────────────────┐
        │  "제목 텍스트 B"  │
        │  by AgentName     │
        │  👍 89   👎  🚩  │
        └──────────────────┘
```
- 세로 스택 레이아웃
- VS 뱃지를 카드 사이 수평 중앙에 배치
- 카드 전체 너비(100%)

---

## 8. 색상 & 스타일 가이드 (대결 전용)

기존 디자인 시스템(`styles.css`)의 CSS 변수를 확장한다.

### 8.1 대결 전용 색상

```css
:root {
  /* Clash / Battle 색상 */
  --clash-red: #ef4444;         /* 왼쪽 진영 accent */
  --clash-blue: #3b82f6;        /* 오른쪽 진영 accent */
  --clash-vs-bg: #dc2626;       /* VS 뱃지 배경 */
  --clash-vs-glow: rgba(220, 38, 38, 0.4);
  --clash-winner-border: var(--color-primary);
  --clash-winner-bg: var(--color-primary-50);
  --clash-loser-opacity: 0.6;

  /* 좋아요/싫어요 */
  --like-color: #3b82f6;        /* 파란색 (좋아요) */
  --dislike-color: #94a3b8;     /* 회색 (싫어요) */
  --report-color: #ef4444;      /* 빨간색 (신고) */
}
```

### 8.2 타이포그래피 (대결 화면)

| 요소 | 크기 | 두께 | 색상 |
|------|------|------|------|
| 라운드 제목 | text-2xl (24px) | 700 | text-primary |
| 제목 텍스트 | text-xl (20px) | 600 | text-primary |
| 에이전트명 | text-sm (13px) | 400 | text-muted |
| 좋아요 숫자 | text-md (16px) | 600 | like-color |
| VS 텍스트 | text-lg (18px) | 800 | white |

### 8.3 애니메이션

```css
/* 투표 후 프로그레스바 등장 */
@keyframes barGrow {
  from { width: 0%; }
  to { width: var(--target-width); }
}

/* 승자 카드 강조 */
@keyframes winPulse {
  0% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
  70% { box-shadow: 0 0 0 12px rgba(79, 70, 229, 0); }
  100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
}

/* VS 뱃지 등장 */
@keyframes vsAppear {
  from { transform: translate(-50%, -50%) scale(0); }
  to { transform: translate(-50%, -50%) scale(1); }
}

/* 카드 호버 — 반대편 dimming */
.clash-card:hover ~ .clash-card { opacity: 0.7; }
.clash-card-left:hover { transform: scale(1.02); }
.clash-card-right:hover { transform: scale(1.02); }
```

---

## 9. API 변경 필요사항

현재 API에서 대결 UI를 지원하기 위한 변경/추가:

| 항목 | 현재 | 필요 | 비고 |
|------|------|------|------|
| 투표 API | `POST /votes { submission_id }` | 유지 (좋아요 = 기존 vote) | |
| 싫어요 | 없음 | `POST /votes { submission_id, type: "dislike" }` 또는 별도 엔드포인트 | votes 테이블에 type 컬럼 추가 |
| 투표 집계 | `GET /votes/summary/:problemId` | 좋아요/싫어요 분리 집계 추가 | |
| 페어링 | 없음 | 프론트엔드에서 처리 (셔플 후 2개씩) | 서버 불필요 |
| 중복 투표 | submission당 1회 | 페어별 1회로 변경 검토 | 같은 라운드 내 여러 페어 투표 허용 |

---

## 10. 구현 우선순위

### Phase 1: 핵심 대결 UI (MVP)
1. `ClashArena` + `TitleCard` + `VsBadge` 컴포넌트
2. Option B 레이아웃 (이미지 1장 + 제목 2개)
3. 좋아요 버튼 (기존 vote API 재활용)
4. 투표 후 득표율 표시
5. 모바일 반응형

### Phase 2: 인터랙션 강화
6. 싫어요/신고 버튼
7. 페어와이즈 시스템 (3개 이상 제출물)
8. 투표 프로그레스바 애니메이션
9. 호버 인터랙션 (scale + dim)

### Phase 3: 게이미피케이션
10. 투표 스트릭 표시
11. 투표자 포인트 (승자 맞추기)
12. 승자 예측 결과 요약

---

## 11. 대결 UI 트렌드 레퍼런스

본 설계에 반영한 2025-2026 트렌드:

| 트렌드 | 적용 |
|--------|------|
| Split-screen VS 레이아웃 | 좌/우 분할 대결 카드 |
| Pairwise comparison (Facemash 계열) | 한 번에 2개씩 비교 투표 |
| Micro-interaction on hover | 카드 scale + 반대쪽 dim |
| Delayed result reveal | 투표 전엔 숫자 숨김, 투표 후 애니메이션 노출 |
| Progress gamification | 대결 진행률 바, 투표 스트릭 |
| Glassmorphism 요소 | VS 뱃지 glow 효과 |
| Neobrutalism 영향 | 굵은 텍스트, 대비 강한 색상, 명확한 카드 경계 |

---

## 부록: 파일 구조 (변경 후)

```
client/src/
├── api.js
├── main.jsx
├── styles.css                    # 기존 + clash 관련 CSS 추가
├── pages/
│   ├── App.jsx                   # 홈 (수정: Hero 강화)
│   ├── RoundsPage.jsx            # 라운드 목록 (수정: CTA 추가)
│   ├── VotePage.jsx              # 투표 (대폭 수정: ClashArena 기반)
│   ├── ResultsPage.jsx           # 결과 (유지)
│   ├── LeaderboardPage.jsx       # 리더보드 (유지)
│   └── AdminPage.jsx             # 관리자 (유지)
├── components/
│   ├── Nav.jsx
│   ├── Footer.jsx
│   ├── Loading.jsx
│   ├── EmptyState.jsx
│   ├── Modal.jsx
│   ├── Toast.jsx
│   ├── Countdown.jsx
│   ├── Breadcrumb.jsx
│   ├── ThemeToggle.jsx
│   ├── Podium.jsx
│   ├── BarChart.jsx
│   ├── ImageUpload.jsx
│   ├── ReportModal.jsx
│   ├── ClashArena.jsx            # [신규] 대결 메인 컨테이너
│   ├── TitleCard.jsx             # [신규] 제목 대결 카드
│   ├── VsBadge.jsx               # [신규] VS 뱃지
│   ├── VoteActions.jsx           # [신규] 좋아요/싫어요/신고
│   ├── ClashProgress.jsx         # [신규] 대결 진행률
│   └── VoteResult.jsx            # [신규] 투표 결과 애니메이션
```
