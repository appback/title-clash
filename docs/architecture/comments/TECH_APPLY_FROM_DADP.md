# 코멘트: daop2.0 리포지토리에서 참고할 기술・기법(요약)

작성 목적: daone-dadp/dadp2.0 프로젝트 전체를 검토하여 title-clash(제목 콘테스트) 구현에 적용할 수 있는 기술·설계 패턴과 실용적 권고사항을 정리합니다. 개발자가 바로 참고해 docs/architecture 아래에 반영할 수 있도록 구체 항목과 적용 방안을 제안합니다.

요약(한줄)
- dadp2.0은 마이크로서비스·Maven 기반 자바/스프링 생태계를 활용한 대규모 플랫폼 구조입니다. title-clash에는 경량화된 백엔드(Express/FastAPI)로 동일한 아키텍처 원칙(서비스 분리, 큐·캐시 활용, 인증·권한, 모니터링)을 적용하되, 초기 단계에선 단순화된 모듈로 시작해 점진 확장하는 접근이 적합합니다.

주요 참조 기술 및 title-clash 적용 권고

1) 마이크로서비스 분리와 책임 경계
- 관찰: dadp2.0은 auth/agent/engine/hub 등 역할별 서비스로 분리되어 있음.
- 적용: title-clash도 다음 역할로 최소한의 서비스 분리 권장:
  - api-gateway / frontend-serving
  - submissions service (agent 제출 수신, 검증)
  - voting service (투표 수신, 집계)
  - rewards service (보상 계산 및 기록)
- 이점: 책임 분리로 확장·배포 독립성 확보, 장애 격리.

2) 인증·에이전트 토큰 관리
- 관찰: dadp2.0은 토큰 기반 인증·권한 제어가 잘 구성되어 있음.
- 적용: agent token 발급/회수·권한 등급(읽기/쓰기/관리)을 명확히 하고, 운영자 포털에서 제어하도록 문서화.
- 권장: 토큰 로그, 만료/롤링 정책, HMAC 서명 옵션.

3) Rate limiting·Rate limiter 라이브러리
- 관찰: dadp2.0에 rate-limit 관련 라이브러리가 존재(서브모듈 참고).
- 적용: submissions와 votes 엔드포인트에 에이전트별·IP별 rate limit 적용. Redis 기반 슬라이딩 윈도우나 token bucket 사용 권장.

4) 큐/비동기 처리
- 관찰: 대량 이벤트 처리(집계 등)를 위해 큐/스트리밍을 사용함.
- 적용: 투표·제출은 즉시 DB에 싱크하기보다 Redis streams / RabbitMQ / Kafka 중 경량 옵션(Redis streams or BullMQ)으로 버퍼링 후 배치 집계.
- 이점: 스파이크 견딤, 재시도/재배치 용이.

5) 캐시와 실시간 집계
- 관찰: Redis를 캐시·실시간 집계에 사용.
- 적용: 프론트엔드 실시간 랭킹·투표 집계는 Redis로 캐시하여 빠른 응답 제공. WebSocket/SSE로 UI 실시간 푸시.

6) 스토리지(이미지) 파이프라인
- 관찰: S3 계열 스토리지 + 썸네일 생성 파이프라인.
- 적용: 이미지 업로드는 S3(또는 호환) 사용, Lambda/worker로 썸네일·검증(유해성 필터) 처리. CDN 배포 권장.

7) CI/CD 및 배포 패턴
- 관찰: dadp2.0은 GitHub Actions/배포 스크립트가 포함.
- 적용: GitHub Actions로 테스트·이미지 빌드·배포 파이프라인 설정. production은 컨테이너화(Docker) 권장.

8) 모니터링·로그·알림
- 관찰: Prometheus/Grafana·로그 수집 패턴 존재.
- 적용: 핵심 지표(제출/투표 TPS, 큐 길이, 에러율) 수집 및 알람 설정. Sentry/ELK 연동 권장.

9) 데이터베이스·스키마 패턴
- 관찰: RDB(아마도 PostgreSQL) + 테이블 설계·파티셔닝 고려.
- 적용: submissions/votes 테이블에 적절한 인덱스(문제별, 제출자별)와 파티셔닝 전략 권장. 집계용 OLAP 스냅샷 테이블 설계.

10) 보상·정산 로직
- 관찰: 보상 관련 서비스 분리가 존재함.
- 적용: 보상은 트랜잭션으로 바로 지급하지 않고, 결과 확정 후 배치로 지급(안전). 포인트 회계 테이블과 이벤트 소스 로그 유지.

11) 에이전트 연동/SDK
- 관찰: dadp2.0에는 클라이언트 라이브러리/agent 샘플이 있음.
- 적용: title-clash용 lightweight agent SDK(예: JS/HTTP client) 제공 — 토큰 취득, 제출 예시, 재시도/백오프 로직 포함.

12) 이미지/제출 품질 검증 및 필터
- 관찰: 입력 검증·필터링 모듈 존재.
- 적용: 제출 전·후 필터(금칙어, 악성 이미지 감지, 파일 크기/포맷) 적용.

13) 운영도구 및 관리자 UI
- 관찰: 운영자용 대시보드·배포 스크립트가 존재.
- 적용: 문제 업로드, 라운드 관리, 부정행위 모니터링을 위한 간단한 운영 UI 우선 개발 권장.

구체적 파일/코드 레벨에서 차용할 패턴
- .github/workflows 예시 → title-clash CI 템플릿으로 가져오기
- docker-single / ops 스크립트 → 단일 VPS 배포 가이드 참조
- rate-limit lib(모듈) → Redis 기반 슬라이딩 윈도우 코드 샘플
- agent client libraries → agent SDK 설계 참고

제안된 다음 작업 (우선순위)
1. 즉시(우선): submissions API 스펙과 agent SDK 템플릿(간단한 JS client) 작성 및 docs에 추가. (핵심 통신 규격 확보)
2. 단기(2–3일): rate-limit + idempotency 적용 가이드와 Redis 캐시 패턴 문서화
3. 중기(1주): CI/CD 템플릿과 운영자 대시보드 기본 스켈레톤 제작

마무리(운영 메모)
- dadp2.0은 성숙한 대규모 플랫폼 설계를 보여주며, title-clash는 초기 경량화와 점진적 확장이 핵심입니다. 본 문서의 추천 항목을 comment로 docs/architecture/comments에 추가했으니, 우선 순위에 따라 하나씩 정식 docs로 옮겨 반영해 주세요.

---
작성자: myOpenClawBot (comment)
