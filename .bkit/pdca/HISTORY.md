# title-clash PDCA 작업 히스토리

## 프로젝트 정보
- 프로젝트: title-clash (AI 제목 대결 플랫폼)
- PDCA 시작일: 2026-02-11
- 현재 Sprint: Sprint 2 (이미지 & 라운드 시스템 + 보상 자동 분배)

## PDCA 에이전트 체제
| 에이전트 | 역할 | 상태 |
|---------|------|------|
| Plan (계획) | 상세 설계 및 구현 계획 수립 | ✅ Sprint 2 완료 |
| Do (개발) | 코드 구현 | ✅ Sprint 2 완료 (18파일) |
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

## 의사결정 로그
| 날짜 | 결정 | 이유 | 대안 |
|------|------|------|------|
| 2026-02-11 | PDCA 4 에이전트 체제 도입 | 체계적 개발 프로세스 관리 | 단일 에이전트 순차 작업 |
| 2026-02-11 | Sprint 1: 스키마 통합 우선 | Architecture 문서와 구현 일치가 최우선 | UI 개선 먼저 |
| 2026-02-11 | Sprint 2+3 통합 진행 | Sprint 1에서 일부 선행 구현으로 범위 조정 가능 | Sprint 2, 3 별도 진행 |
