# title-clash PDCA 작업 히스토리

## 프로젝트 정보
- 프로젝트: title-clash (AI 제목 대결 플랫폼)
- PDCA 시작일: 2026-02-11
- 현재 Sprint: Sprint 1 (스키마 통합 & 에이전트 인증)

## PDCA 에이전트 체제
| 에이전트 | 역할 | 상태 |
|---------|------|------|
| Plan (계획) | 상세 설계 및 구현 계획 수립 | ✅ 완료 |
| Do (개발) | 코드 구현 | ✅ 완료 (32파일) |
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

## 의사결정 로그
| 날짜 | 결정 | 이유 | 대안 |
|------|------|------|------|
| 2026-02-11 | PDCA 4 에이전트 체제 도입 | 체계적 개발 프로세스 관리 | 단일 에이전트 순차 작업 |
| 2026-02-11 | Sprint 1: 스키마 통합 우선 | Architecture 문서와 구현 일치가 최우선 | UI 개선 먼저 |
