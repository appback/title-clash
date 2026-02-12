# Plan: Admin System Refactoring (integration)

> **Feature**: integration
> **Author**: Claude Opus 4.6
> **Created**: 2026-02-11
> **Status**: Completed
> **PDCA Phase**: Plan -> Design -> Do -> Check (100%)

---

## 1. Overview

### 1.1 Background

현재 어드민 페이지는 최소한의 문제 관리 + 읽기 전용 통계만 존재하며, 제출물 관리/신고 시스템/서비스 설정/AI 모델 추적이 전혀 없음. 운영에 필요한 핵심 기능을 모두 구현한다.

### 1.2 Goals

- 신고(Report) 시스템으로 부적절한 제출물 관리
- 동적 서비스 설정(Settings)으로 런타임 설정 변경
- AI 모델 추적(model_name/model_version)
- 어드민 대시보드 확장 (5탭 구조)
- 통합 테스트 커버리지 확보

### 1.3 Key Decisions

| 항목 | 결정 | 근거 |
|------|------|------|
| 신고 누적 시 처리 | 투표 유지, 노출만 제한 (restricted) | 투표 무효화는 과도한 조치 |
| AI 모델 정보 | `model_name` 필수, `model_version` 선택 | 모델 식별 필요, 버전은 선택적 |
| 설정 적용 방식 | 저장 후 수동 리프레시 버튼 | 자동 적용 시 예기치 않은 부작용 방지 |
| 어드민 탭 구조 | 5탭 (Problems/Submissions/Agents/Statistics/Settings) | 기능별 분리로 UX 개선 |

---

## 2. Scope

### 2.1 In Scope

- DB Migration: reports/settings 테이블, model 컬럼
- Backend: configManager, reports/settings 컨트롤러, submissions 확장, stats 확장
- Frontend: ReportModal, ImageUpload, VotePage 수정, AdminPage 5탭 재작성
- Tests: reports/settings/submissions 통합 테스트

### 2.2 Out of Scope

- 이메일/알림 시스템
- 신고자 대시보드 (신고 후 추적)
- 실시간 설정 동기화 (WebSocket)
- 신고 사유별 자동 처리 규칙

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | 익명/인증 사용자가 제출물을 신고할 수 있다 | High |
| FR-02 | 신고 누적(threshold) 시 자동으로 restricted 처리 | High |
| FR-03 | 어드민이 신고를 심사(dismiss/confirm)할 수 있다 | High |
| FR-04 | confirmed 시 해당 제출물을 disqualified 처리 | High |
| FR-05 | 어드민이 서비스 설정을 조회/수정할 수 있다 | High |
| FR-06 | 설정 캐시를 수동 리프레시할 수 있다 | Medium |
| FR-07 | 제출 시 model_name 필수, model_version 선택 | High |
| FR-08 | 어드민이 제출물 상태를 변경할 수 있다 | High |
| FR-09 | 모델별/신고별 통계를 조회할 수 있다 | Medium |
| FR-10 | 투표 페이지에서 신고 버튼으로 신고할 수 있다 | High |

### 3.2 Non-Functional Requirements

| ID | Requirement | Criteria |
|----|-------------|----------|
| NFR-01 | 설정 조회 성능 | 인메모리 캐시, DB 조회 없음 |
| NFR-02 | 중복 신고 방지 | DB 레벨 unique index |
| NFR-03 | 트랜잭션 안전성 | 신고/심사 시 transaction 사용 |
| NFR-04 | 테스트 커버리지 | 92개 테스트 전체 통과 |

---

## 4. Implementation Phases

| Phase | 내용 | 파일 수 |
|-------|------|---------|
| Phase 1 | DB Migration (reports, settings, model 컬럼) | 1 |
| Phase 2 | Backend Services (configManager, storage, rewardDistributor) | 4 |
| Phase 3 | Controllers & Routes (settings, reports, submissions, stats) | 8 |
| Phase 4 | Frontend Components (ReportModal, ImageUpload, api.js) | 3 |
| Phase 5 | Frontend Pages (VotePage, AdminPage, styles) | 3 |
| Phase 6 | Tests (reports, settings, submissions) | 3 |
| **Total** | | **22 files** |

---

## 5. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| 설정 변경으로 서비스 장애 | High | 수동 리프레시, loadSettings 실패 시 fallback |
| 악의적 신고 남용 | Medium | 중복 방지 인덱스, 어드민 심사 필수 |
| model_name 필수화로 기존 에이전트 호환성 | Medium | 400 에러로 명확한 안내 |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-11 | Initial plan created |
| 1.1 | 2026-02-12 | Post-implementation documentation |
