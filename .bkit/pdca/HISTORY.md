# title-clash PDCA 작업 히스토리

## 프로젝트 정보
- 프로젝트: title-clash (AI 제목 대결 플랫폼)
- PDCA 시작일: 2026-02-11
- 현재 Sprint: Sprint 5 (UI/UX 개선)

## PDCA 에이전트 체제
| 에이전트 | 역할 | 상태 |
|---------|------|------|
| Plan (계획) | 상세 설계 및 구현 계획 수립 | ✅ Sprint 5 완료 |
| Do (개발) | 코드 구현 | ✅ Sprint 5 완료 |
| Check (검증) | 설계-구현 갭 분석, 품질 검증 | 🔄 진행중 |
| History (히스토리) | 작업 내역 기록, 변경 로그 관리 | 🔄 진행중 |

## 작업 로그

### 2026-02-11

#### [Plan] PLAN.md 작성 완료
- 문서: .bkit/pdca/PLAN.md
- 내용: 프로젝트 현황 분석, 5 Sprint 로드맵, 기술 스택, 리스크 분석
- 주요 발견:
  - Architecture 문서와 현재 구현 간 스키마 불일치 (problems/submissions vs titles/matches)
  - 에이전트 인증 시스템 미구현
  - 이미지 업로드, 보상 로직, 실시간 기능 미구현
  - 테스트 코드 없음

#### [Plan] Sprint 1 상세 설계 시작
- 범위: 스키마 통합 & 에이전트 인증
- 상태: 진행중
- 에이전트: Plan Agent 실행됨

#### [Do] Phase A+B 완료 - 인프라 & DB 마이그레이션
- 구현 파일 (Phase A):
  - apps/api/utils/errors.js - 에러 클래스 (AppError + 6개 서브클래스)
  - apps/api/utils/pagination.js - 페이지네이션 헬퍼
  - apps/api/utils/token.js - JWT/에이전트 토큰 유틸리티
  - apps/api/middleware/errorHandler.js - 공통 에러 핸들러
  - apps/api/middleware/validate.js - 요청 검증 미들웨어
  - db/migrate.js - 마이그레이션 실행기
- 구현 파일 (Phase B): 7개 SQL 마이그레이션 (002~008)
- 패키지 추가: jsonwebtoken, bcryptjs

#### [Do] Phase C+D+E 완료 - 인증 + API + 통합
- 구현 파일 (Phase C): auth.js 수정, agentAuth.js, adminAuth.js, controllers/v1/auth.js, routes/v1/auth.js
- 구현 파일 (Phase D): 7개 리소스 (agents, problems, submissions, votes, rewards, stats) × (controller + route) = 14파일
- 구현 파일 (Phase E): routes/v1/index.js, server.js 수정, routes/index.js 수정 (deprecation 헤더)
- 총 신규/수정 파일: 32개
- 주요 설계 결정:
  - 에이전트 토큰은 SHA-256 해시로 DB 저장 (원본 1회만 반환)
  - JWT 인증 + 쿠키 기반 익명 투표 병행
  - Problem 상태 전이 엄격 검증 (draft→open→voting→closed→archived)
  - 레거시 API는 deprecation 헤더와 함께 유지

#### [Check] 검증 에이전트 시작
- 설계-구현 갭 분석 진행 중
- 검증 항목: DB 스키마, API 엔드포인트, 인증, 보안, 코드 품질 등 10개 영역

#### [Sprint 1 완료 요약]
- Match Rate: 88% → 94% (Act 후)
- 총 파일: 39개 (신규 35 + 수정 4)
- 코드: 5,300줄 추가
- 커밋: 95feffb

---

#### [Plan] Sprint 2 계획 시작
- 범위: S3 이미지 업로드, 라운드 자동화, 보상 분배, 프론트엔드 v1 연동
- Sprint 1에서 선행 구현된 항목: problems CRUD, submissions CRUD, rewards/stats 조회
- 신규 필요: S3 연동, 스케줄러, 보상 분배 로직, 프론트엔드 리디자인

#### [Do] Sprint 2 Phase A+B 완료 - 이미지 업로드 + 보상 + 스케줄러
- 신규 파일:
  - services/storage.js - S3/로컬 스토리지 추상화
  - services/rewardDistributor.js - 보상 자동 분배 (트랜잭션, 1위 100/2위 50/3위 25)
  - services/scheduler.js - node-cron 라운드 자동화 (draft→open→voting→closed)
  - controllers/v1/upload.js + routes/v1/upload.js - 이미지 업로드 API
  - .env.example, .gitignore
- 수정 파일: problems.js (보상 트리거), server.js (스케줄러+정적 파일), routes/v1/index.js, package.json, docker-compose.yml
- 패키지 추가: @aws-sdk/client-s3, multer, mime-types, node-cron

#### [Do] Sprint 2 Phase C+D 완료 - 통계 보강 + 프론트엔드 리디자인
- 통계 API: overview, top (강화), agentStats (신규), problemStats (강화)
- 프론트엔드 전면 리디자인:
  - api.js - 중앙 API 클라이언트
  - Nav.jsx - 네비게이션 바
  - App.jsx - 대시보드 (통계 + 활성 라운드 + 최근 결과)
  - VotePage.jsx - 투표 (문제 목록 + 상세 투표)
  - RoundsPage.jsx - 라운드 목록 (open + voting)
  - ResultsPage.jsx - 결과 (종료 라운드 + 상세)
  - LeaderboardPage.jsx - 에이전트 순위
  - styles.css - 모던 디자인 시스템 (CSS 변수, 반응형)
- 총 신규 파일 10개 + 수정 파일 8개

#### [Check] Sprint 2 검증 시작
- 검증 에이전트 실행됨

#### [Sprint 2 완료 요약]
- Match Rate: 93%
- 총 파일: 28개 (신규 16 + 수정 11 + 삭제 1)
- 코드: 6,388줄 추가
- 커밋: 4e165bc
- Sprint 3 (보상 & 통계)를 Sprint 2에 통합 완료

---

#### [Plan] Sprint 4 계획 시작
- 범위: API 통합 테스트, Rate limiting, CORS, Helmet, CI 파이프라인 강화
- 목표: 코드 품질 및 보안 기반 확보

#### [Do] Sprint 4 Phase A~D 완료 - 테스트 인프라 + 보안 미들웨어 + 통합 테스트 + CI
- **Phase A: 테스트 인프라 구축**
  - jest.config.js - Jest 설정 (NODE_ENV 인라인 설정으로 Windows 호환)
  - tests/setup.js - 테스트 DB 생성 및 마이그레이션
  - tests/teardown.js - 테스트 DB 정리
  - tests/helpers.js - 공통 테스트 유틸리티
- **Phase B: 보안 미들웨어**
  - Rate limiting 4단계: global 100/min, auth 10/min, submissions 5/min, votes 30/min
  - CORS 화이트리스트 설정
  - Helmet 보안 헤더 적용
- **Phase C: 통합 테스트 64개 케이스 (6개 파일)**
  - auth.test.js - 인증 테스트 (10개)
  - agents.test.js - 에이전트 CRUD 테스트 (12개)
  - problems.test.js - 문제 CRUD 테스트 (12개)
  - submissions.test.js - 제출 CRUD 테스트 (12개)
  - votes.test.js - 투표 테스트 (10개)
  - upload.test.js - 이미지 업로드 테스트 (8개)
- **Phase D: CI 워크플로우 재작성**
  - GitHub Actions PostgreSQL 서비스 컨테이너 구성
  - 테스트 + 커버리지 자동 실행
- 총 신규/수정 파일: ~20개
- 주요 설계 결정:
  - Windows 호환성: NODE_ENV를 jest.config.js 내부에서 설정 (인라인 npm 스크립트 대신)
  - 테스트 환경에서 Rate limiter 비활성화
  - 별도 테스트 DB 생성/삭제로 테스트 격리
  - 커버리지 임계값 70% 설정

---

#### [Plan] Sprint 5 시작
- 범위: 디자인 시스템 도입, 투표 페이지 리디자인, 결과 페이지 개선, 관리자 대시보드 기본 구현
- 목표: 사용자 경험 개선 및 관리 인터페이스 확장
- 상태: Plan 에이전트 실행 중
- 예상 산출물:
  - 일관된 컴포넌트 라이브러리 및 스타일 시스템
  - 개선된 투표 UX/UI
  - 향상된 결과 시각화
  - 기본 관리자 대시보드 (라운드 관리, 에이전트 관리, 통계 모니터링)

#### [Do] Sprint 5 Do 단계 완료 - UI/UX 개선 전체 구현
- **Phase A: CSS 디자인 시스템 강화**
  - 다크 테마 (--dark 시리즈 색상 변수)
  - 애니메이션 프레임 6개 (fadeIn, slideDown, spin, pulse, bounce, shimmer)
  - 신규 컴포넌트 CSS 클래스 15개+ (input, modal, toast, hero, podium, bar-chart, countdown, progress, vote-card, filter, tabs, table, hamburger, footer, breadcrumb)
  - 반응형 브레이크포인트 확장 (1024px, 768px, 480px)

- **Phase B: React 컴포넌트 신규 구현 (10개)**
  - Loading.jsx - 로딩 스피너
  - EmptyState.jsx - 빈 상태 안내
  - Modal.jsx - 모달 컴포넌트
  - Toast context + useToast hook - 알림 시스템
  - Countdown.jsx - 카운트다운 타이머
  - BarChart.jsx - 막대 그래프 (투표 결과 시각화)
  - Podium.jsx - 우승자 표시 (1,2,3위)
  - Breadcrumb.jsx - 네비게이션 경로
  - Footer.jsx - 푸터 컴포넌트
  - ThemeToggle.jsx - 다크/라이트 테마 토글

- **Phase C: 페이지 전면 리디자인**
  - Nav.jsx 개선: 햄버거 메뉴 + 테마 토글 + 활성 경로 하이라이트
  - App.jsx (대시보드): 히어로 섹션 추가
  - VotePage.jsx: Select-then-confirm 투표 플로우 (문제 선택 → 옵션 선택 → 투표 확인)
  - RoundsPage.jsx: 카운트다운 타이머 표시
  - ResultsPage.jsx: Podium + BarChart로 결과 시각화
  - LeaderboardPage.jsx: 검색 + 순위별 색상 구분

- **Phase D: 관리자 페이지 구현**
  - AdminPage.jsx: 탭 UI (Problems CRUD, Agents list, Overview stats)

- **Phase E: 통합 및 최적화**
  - ToastProvider로 전역 알림 시스템 감싸기
  - Footer 전역 배치
  - admin 라우트 추가
  - 테마 초기화 로직 (localStorage에서 사용자 선호도 복원)
  - 이미지 lazy loading

- 신규 파일: 11개 (컴포넌트 10 + 스타일 1)
- 수정 파일: 7개 (App, Nav, VotePage, RoundsPage, ResultsPage, LeaderboardPage, main.jsx)
- npm 패키지 추가 사항: 없음 (기존 React + CSS 스타일시트)
- 백엔드 변경: 없음 (프론트엔드 전용 작업)

---

## 변경 이력 (Changelog)
| 날짜 | 유형 | 설명 | 관련 파일 |
|------|------|------|-----------|
| 2026-02-11 | 문서 | PLAN.md 초기 작성 | .bkit/pdca/PLAN.md |
| 2026-02-11 | 문서 | HISTORY.md 초기화 | .bkit/pdca/HISTORY.md |
| 2026-02-11 | 문서 | DESIGN-sprint1.md 작성 시작 | .bkit/pdca/DESIGN-sprint1.md |
| 2026-02-11 | 인프라 | 에러 클래스 (AppError + 6개 서브클래스) | apps/api/utils/errors.js |
| 2026-02-11 | 인프라 | 페이지네이션 헬퍼 | apps/api/utils/pagination.js |
| 2026-02-11 | 인프라 | JWT/에이전트 토큰 유틸리티 | apps/api/utils/token.js |
| 2026-02-11 | 인프라 | 공통 에러 핸들러 미들웨어 | apps/api/middleware/errorHandler.js |
| 2026-02-11 | 인프라 | 요청 검증 미들웨어 | apps/api/middleware/validate.js |
| 2026-02-11 | 인프라 | 마이그레이션 실행기 | db/migrate.js |
| 2026-02-11 | DB | SQL 마이그레이션 002~008 (7개) | db/migrations/002~008_*.sql |
| 2026-02-11 | 패키지 | jsonwebtoken, bcryptjs 추가 | package.json |
| 2026-02-11 | 인증 | auth.js 수정 (JWT 인증) | apps/api/middleware/auth.js |
| 2026-02-11 | 인증 | 에이전트 인증 미들웨어 | apps/api/middleware/agentAuth.js |
| 2026-02-11 | 인증 | 관리자 인증 미들웨어 | apps/api/middleware/adminAuth.js |
| 2026-02-11 | 인증 | 인증 컨트롤러 | apps/api/controllers/v1/auth.js |
| 2026-02-11 | 인증 | 인증 라우트 | apps/api/routes/v1/auth.js |
| 2026-02-11 | API | agents 컨트롤러 + 라우트 | apps/api/controllers/v1/agents.js, apps/api/routes/v1/agents.js |
| 2026-02-11 | API | problems 컨트롤러 + 라우트 | apps/api/controllers/v1/problems.js, apps/api/routes/v1/problems.js |
| 2026-02-11 | API | submissions 컨트롤러 + 라우트 | apps/api/controllers/v1/submissions.js, apps/api/routes/v1/submissions.js |
| 2026-02-11 | API | votes 컨트롤러 + 라우트 | apps/api/controllers/v1/votes.js, apps/api/routes/v1/votes.js |
| 2026-02-11 | API | rewards 컨트롤러 + 라우트 | apps/api/controllers/v1/rewards.js, apps/api/routes/v1/rewards.js |
| 2026-02-11 | API | stats 컨트롤러 + 라우트 | apps/api/controllers/v1/stats.js, apps/api/routes/v1/stats.js |
| 2026-02-11 | 통합 | v1 라우트 인덱스 | apps/api/routes/v1/index.js |
| 2026-02-11 | 통합 | server.js 수정 (v1 마운트) | apps/api/server.js |
| 2026-02-11 | 통합 | 레거시 라우트 deprecation 헤더 | apps/api/routes/index.js |
| 2026-02-11 | 커밋 | Sprint 1 전체 커밋 (95feffb) | 39 files |
| 2026-02-11 | 문서 | Sprint 2 PDCA 시작 | DESIGN-sprint2.md |
| 2026-02-11 | 서비스 | S3/로컬 스토리지 추상화 | services/storage.js |
| 2026-02-11 | 서비스 | 보상 자동 분배 (트랜잭션) | services/rewardDistributor.js |
| 2026-02-11 | 서비스 | node-cron 라운드 자동화 스케줄러 | services/scheduler.js |
| 2026-02-11 | API | 이미지 업로드 컨트롤러 + 라우트 | controllers/v1/upload.js, routes/v1/upload.js |
| 2026-02-11 | 설정 | 환경변수 예시 파일 | .env.example |
| 2026-02-11 | 설정 | Git 무시 파일 | .gitignore |
| 2026-02-11 | 패키지 | @aws-sdk/client-s3, multer, mime-types, node-cron 추가 | package.json |
| 2026-02-11 | 수정 | 보상 트리거 추가 | problems.js |
| 2026-02-11 | 수정 | 스케줄러+정적 파일 서빙 | server.js |
| 2026-02-11 | 수정 | 업로드 라우트 연결 | routes/v1/index.js |
| 2026-02-11 | 수정 | 도커 설정 업데이트 | docker-compose.yml |
| 2026-02-11 | API | 통계 API 강화 (overview, top, agentStats, problemStats) | controllers/v1/stats.js |
| 2026-02-11 | 프론트 | 중앙 API 클라이언트 | api.js |
| 2026-02-11 | 프론트 | 네비게이션 바 | Nav.jsx |
| 2026-02-11 | 프론트 | 대시보드 (통계+활성라운드+최근결과) | App.jsx |
| 2026-02-11 | 프론트 | 투표 페이지 | VotePage.jsx |
| 2026-02-11 | 프론트 | 라운드 목록 페이지 | RoundsPage.jsx |
| 2026-02-11 | 프론트 | 결과 페이지 | ResultsPage.jsx |
| 2026-02-11 | 프론트 | 에이전트 순위 페이지 | LeaderboardPage.jsx |
| 2026-02-11 | 프론트 | 모던 디자인 시스템 (CSS 변수, 반응형) | styles.css |
| 2026-02-11 | 커밋 | Sprint 2 전체 커밋 (4e165bc) | 28 files |
| 2026-02-11 | 문서 | Sprint 4 PDCA 시작 | DESIGN-sprint4.md |
| 2026-02-11 | 테스트 | Jest + Supertest 테스트 인프라 구축 | jest.config.js, tests/setup.js, tests/teardown.js, tests/helpers.js |
| 2026-02-11 | 보안 | Rate limiting 미들웨어 (4단계) | apps/api/middleware/rateLimiter.js |
| 2026-02-11 | 보안 | CORS 화이트리스트 설정 | apps/api/middleware/cors.js |
| 2026-02-11 | 보안 | Helmet 보안 헤더 적용 | apps/api/server.js |
| 2026-02-11 | 테스트 | auth 통합 테스트 (10개) | tests/integration/auth.test.js |
| 2026-02-11 | 테스트 | agents 통합 테스트 (12개) | tests/integration/agents.test.js |
| 2026-02-11 | 테스트 | problems 통합 테스트 (12개) | tests/integration/problems.test.js |
| 2026-02-11 | 테스트 | submissions 통합 테스트 (12개) | tests/integration/submissions.test.js |
| 2026-02-11 | 테스트 | votes 통합 테스트 (10개) | tests/integration/votes.test.js |
| 2026-02-11 | 테스트 | upload 통합 테스트 (8개) | tests/integration/upload.test.js |
| 2026-02-11 | CI | GitHub Actions 워크플로우 재작성 (PostgreSQL 서비스 컨테이너) | .github/workflows/ci.yml |
| 2026-02-11 | 문서 | Sprint 5 PDCA 시작 | DESIGN-sprint5.md |
| 2026-02-11 | 스타일 | CSS 디자인 시스템 강화 (다크 테마, 애니메이션, 컴포넌트 클래스) | styles.css |
| 2026-02-11 | 컴포넌트 | Loading 스피너 | src/components/Loading.jsx |
| 2026-02-11 | 컴포넌트 | EmptyState 표시 | src/components/EmptyState.jsx |
| 2026-02-11 | 컴포넌트 | Modal 컴포넌트 | src/components/Modal.jsx |
| 2026-02-11 | 컴포넌트 | Toast 알림 시스템 (context + hook) | src/components/Toast.jsx, src/hooks/useToast.js |
| 2026-02-11 | 컴포넌트 | Countdown 타이머 | src/components/Countdown.jsx |
| 2026-02-11 | 컴포넌트 | BarChart 그래프 | src/components/BarChart.jsx |
| 2026-02-11 | 컴포넌트 | Podium 우승자 표시 | src/components/Podium.jsx |
| 2026-02-11 | 컴포넌트 | Breadcrumb 경로 네비게이션 | src/components/Breadcrumb.jsx |
| 2026-02-11 | 컴포넌트 | Footer 컴포넌트 | src/components/Footer.jsx |
| 2026-02-11 | 컴포넌트 | ThemeToggle 다크/라이트 테마 | src/components/ThemeToggle.jsx |
| 2026-02-11 | 수정 | Nav.jsx 개선 (햄버거, 테마 토글, 활성 경로) | src/components/Nav.jsx |
| 2026-02-11 | 수정 | App.jsx 대시보드 (히어로 섹션) | src/App.jsx |
| 2026-02-11 | 수정 | VotePage.jsx 리디자인 (Select-then-confirm 플로우) | src/pages/VotePage.jsx |
| 2026-02-11 | 수정 | RoundsPage.jsx (Countdown 추가) | src/pages/RoundsPage.jsx |
| 2026-02-11 | 수정 | ResultsPage.jsx (Podium + BarChart) | src/pages/ResultsPage.jsx |
| 2026-02-11 | 수정 | LeaderboardPage.jsx (검색 + 색상) | src/pages/LeaderboardPage.jsx |
| 2026-02-11 | 페이지 | AdminPage 관리자 대시보드 | src/pages/AdminPage.jsx |
| 2026-02-11 | 수정 | main.jsx ToastProvider 통합 + 테마 초기화 | src/main.jsx |

## 의사결정 로그
| 날짜 | 결정 | 이유 | 대안 |
|------|------|------|------|
| 2026-02-11 | PDCA 4 에이전트 체제 도입 | 체계적 개발 프로세스 관리 | 단일 에이전트 순차 작업 |
| 2026-02-11 | Sprint 1: 스키마 통합 우선 | Architecture 문서와 구현 일치가 최우선 | UI 개선 먼저 |
| 2026-02-11 | Sprint 2+3 통합 진행 | Sprint 1에서 일부 선행 구현으로 범위 조정 가능 | Sprint 2, 3 별도 진행 |
| 2026-02-11 | Sprint 4에서 Jest + Supertest 도입 | Node.js Express 표준 테스트 스택 | Vitest (프론트엔드 전용) |
| 2026-02-11 | NODE_ENV를 jest.config.js에서 설정 | Windows 환경에서 인라인 env 설정 비호환 | cross-env 패키지 사용 |
| 2026-02-11 | 테스트 환경에서 Rate limiter 비활성화 | 테스트 속도 및 안정성 확보 | 테스트별 rate limit 리셋 |
| 2026-02-11 | 별도 테스트 DB로 격리 | 개발 DB 오염 방지, CI 병렬 실행 가능 | 트랜잭션 롤백 방식 |
| 2026-02-11 | 커버리지 임계값 70% 설정 | 초기 기준선으로 적절, 점진적 상향 예정 | 80% (초기 달성 어려움) |
