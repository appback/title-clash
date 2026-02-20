# Plan: AWS Deployment & Custom Domain

> **Feature**: domain-deployment
> **Author**: Claude Opus 4.6
> **Created**: 2026-02-13
> **Status**: Draft
> **PDCA Phase**: Plan

---

## 1. Overview

### 1.1 Background

title-clash 프로젝트는 현재 Docker Compose 기반으로 로컬 개발 환경에서만 운영 중이다. 4개 서비스(PostgreSQL, MinIO, API, Client/Nginx)가 모두 localhost에서 동작하며, 외부 접근이 불가능한 상태이다. 서비스를 실제 사용자에게 제공하기 위해 AWS 인프라에 배포하고 구매한 커스텀 도메인을 연결해야 한다.

### 1.2 Current State

| 항목 | 현재 상태 |
|------|-----------|
| Client | Nginx (Docker, :8088 -> :80) |
| API | Express (Docker, :3000) |
| DB | PostgreSQL 15 (Docker, :5435) |
| Storage | MinIO S3-compatible (Docker, :9000/:9001) |
| Domain | 구매 완료, 미연결 |
| SSL | 없음 (HTTP only) |
| CI/CD | 없음 |

### 1.3 Goals

- AWS EC2에 Docker Compose 기반으로 전체 서비스 배포
- 커스텀 도메인을 서비스에 연결 (HTTPS)
- SSL/TLS 인증서 설정 (Let's Encrypt)
- 프로덕션 환경변수 및 보안 설정
- 기본 모니터링 및 로그 수집 환경 구축

### 1.4 Key Decisions

| 항목 | 결정 | 근거 |
|------|------|------|
| 인프라 | EC2 + Docker Compose | 현재 규모에서 ECS/K8s는 과도함, 기존 설정 재활용 가능 |
| SSL | Let's Encrypt (Certbot) | 무료, 자동 갱신, Nginx와 잘 통합됨 |
| DB | RDS PostgreSQL (권장) 또는 EC2 내 Docker | RDS는 백업/HA 자동화, Docker DB는 비용 절감 |
| Storage | AWS S3 (권장) 또는 EC2 내 MinIO 유지 | S3는 내구성/CDN 연계 우수, MinIO는 마이그레이션 비용 절감 |
| 리버스 프록시 | Nginx (Host에서 직접) | Docker 내부 Nginx + 호스트 Nginx 이중 구조 또는 단일 Nginx |
| DNS | Route 53 또는 외부 DNS | 도메인 등록처의 DNS 사용 가능, Route 53은 AWS 통합 우수 |

---

## 2. Scope

### 2.1 In Scope

- AWS EC2 인스턴스 프로비저닝 및 보안그룹 설정
- Docker Compose 프로덕션 설정 (`docker-compose.prod.yml`)
- Nginx 설정 수정 (도메인, HTTPS, 리버스 프록시)
- Let's Encrypt SSL 인증서 발급 및 자동 갱신
- DNS 레코드 설정 (A 레코드 -> EC2 IP)
- 프로덕션 환경변수 (.env.production)
- 방화벽/보안그룹 설정 (80, 443만 외부 노출)
- 기본 배포 스크립트

### 2.2 Out of Scope

- CI/CD 파이프라인 (GitHub Actions) - 별도 피처로 진행
- CDN (CloudFront) 설정 - 트래픽 증가 시 추가
- 오토스케일링 / 로드밸런서 (ALB) - 현재 규모 불필요
- RDS 마이그레이션 - DB 결정 후 별도 진행
- S3 마이그레이션 - Storage 결정 후 별도 진행
- 모니터링 대시보드 (Grafana/Prometheus) - 추후 확장

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | 커스텀 도메인으로 title-clash 웹앱 접근 가능 | Critical |
| FR-02 | HTTPS 강제 적용 (HTTP -> HTTPS 리다이렉트) | Critical |
| FR-03 | API가 동일 도메인 하위 경로(/api/)로 접근 가능 | High |
| FR-04 | SSL 인증서 자동 갱신 (90일 주기) | High |
| FR-05 | 이미지 업로드/서빙 정상 작동 | High |
| FR-06 | 서버 재시작 시 자동으로 서비스 복구 | Medium |
| FR-07 | 배포 스크립트로 원클릭 업데이트 가능 | Medium |

### 3.2 Non-Functional Requirements

| ID | Requirement | Criteria |
|----|-------------|----------|
| NFR-01 | 응답 시간 | 페이지 로드 < 3초 (초기) |
| NFR-02 | 가용성 | 99% uptime (단일 인스턴스 기준) |
| NFR-03 | 보안 | SSH Key 인증만 허용, 불필요한 포트 차단 |
| NFR-04 | 비용 | t3.small 기준 월 $20 이내 (EC2 + EBS) |
| NFR-05 | 데이터 보호 | DB 볼륨 EBS 스냅샷 주 1회 |

---

## 4. Architecture

### 4.1 Target Architecture

```
[User Browser]
      |
      | HTTPS (443)
      v
[EC2 Instance - Ubuntu]
      |
      +-- Host Nginx (Reverse Proxy + SSL Termination)
      |     |
      |     +-- / -> Docker Client (port 8088)
      |     +-- /api/ -> Docker API (port 3000)
      |
      +-- Docker Compose
            |
            +-- db (PostgreSQL :5435)
            +-- minio (MinIO :9000/:9001)
            +-- api (Express :3000)
            +-- client (Nginx :8088)
```

### 4.2 Network Flow

1. 사용자가 `https://도메인.com` 접속
2. DNS가 EC2 Elastic IP로 해석
3. Host Nginx가 SSL 종료 후 Docker Client(:8088)로 프록시
4. `/api/*` 요청은 Docker API(:3000)로 프록시
5. 이미지 요청은 MinIO(:9000) 또는 API를 통해 서빙

---

## 5. Implementation Phases

| Phase | 내용 | 예상 작업 |
|-------|------|-----------|
| Phase 1 | EC2 인스턴스 생성 및 기본 설정 | 인스턴스 생성, 보안그룹, Elastic IP, SSH 설정 |
| Phase 2 | 서버 환경 구성 | Docker/Docker Compose 설치, Git clone, .env 설정 |
| Phase 3 | Docker Compose 프로덕션 설정 | `docker-compose.prod.yml` 작성, 프로덕션 환경변수 |
| Phase 4 | Nginx + SSL 설정 | Host Nginx 설치, Certbot SSL 발급, 리버스 프록시 설정 |
| Phase 5 | DNS 설정 | 도메인 A 레코드 -> Elastic IP |
| Phase 6 | 프로덕션 최적화 | CORS 도메인 변경, 환경변수 정리, 자동 시작 설정 |
| Phase 7 | 배포 스크립트 | deploy.sh 작성, 서비스 상태 확인 스크립트 |

---

## 6. Key Configuration Files

### 6.1 New Files

| File | Purpose |
|------|---------|
| `docker/docker-compose.prod.yml` | 프로덕션용 Docker Compose (포트 노출 최소화) |
| `docker/.env.production` | 프로덕션 환경변수 |
| `docker/nginx-host.conf` | Host Nginx 설정 (SSL + 리버스 프록시) |
| `scripts/deploy.sh` | 배포 자동화 스크립트 |
| `scripts/setup-server.sh` | 서버 초기 설정 스크립트 |

### 6.2 Modified Files

| File | Changes |
|------|---------|
| `docker/docker-compose.yml` | 프로덕션 오버라이드용 주석/가이드 추가 |
| `client/nginx.conf` | 프로덕션 최적화 (gzip, cache headers) |
| `apps/api` (환경변수) | CORS_ORIGINS에 실제 도메인 추가 |

---

## 7. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| EC2 단일 장애점 | High | Medium | EBS 스냅샷 백업, 빠른 복구 스크립트 |
| SSL 인증서 갱신 실패 | Medium | Low | Certbot 자동 갱신 cron, 만료 알림 설정 |
| Docker 볼륨 데이터 손실 | Critical | Low | EBS 스냅샷, DB 덤프 백업 |
| 보안 취약점 (SSH, 포트 노출) | High | Medium | Key 인증 only, 보안그룹 최소 포트 |
| MinIO 외부 노출 | Medium | Medium | Docker 내부 네트워크만 사용, 포트 바인딩 제거 |

---

## 8. Checklist (배포 전 확인)

- [ ] EC2 인스턴스 생성 및 Elastic IP 할당
- [ ] 보안그룹: 22(SSH), 80(HTTP), 443(HTTPS)만 허용
- [ ] Docker + Docker Compose 설치
- [ ] 프로젝트 소스 코드 배포
- [ ] .env.production 환경변수 설정
- [ ] docker-compose.prod.yml로 서비스 기동
- [ ] Host Nginx 설치 및 리버스 프록시 설정
- [ ] DNS A 레코드 설정 (도메인 -> Elastic IP)
- [ ] Certbot으로 SSL 인증서 발급
- [ ] HTTPS 접속 테스트
- [ ] API 요청 정상 동작 확인
- [ ] 이미지 업로드/서빙 확인
- [ ] 서버 재부팅 시 자동 시작 설정
- [ ] Certbot 자동 갱신 cron 확인

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-13 | Initial plan created |
