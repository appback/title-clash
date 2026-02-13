# Title-Clash Infrastructure

> **Last Updated**: 2026-02-13
> **Environment**: Production (AWS ap-northeast-2, Seoul)

---

## 1. AWS EC2 Instance

| 항목 | 값 |
|------|-----|
| Instance Name | titleclash |
| Instance ID | i-0465af16ac1a4596 |
| Instance Type | t3.small (2 vCPU, 2GB RAM) |
| Region | ap-northeast-2 (Seoul) |
| Elastic IP | 43.201.163.136 |
| Public DNS | ec2-43-201-163-136.ap-northeast-2.compute.amazonaws.com |
| OS/AMI | Ubuntu (확인 필요) |
| Key Pair | (AWS 콘솔에서 확인) |
| Status | Running |

### Security Group (Inbound Rules)

| Port | Protocol | Source | 용도 |
|------|----------|--------|------|
| 22 | TCP | My IP | SSH 접속 |
| 80 | TCP | 0.0.0.0/0 | HTTP (HTTPS 리다이렉트용) |
| 443 | TCP | 0.0.0.0/0 | HTTPS |

---

## 2. Domain

| 항목 | 값 |
|------|-----|
| Domain | titleclash.com |
| Registrar | 카페24 (Cafe24) |
| DNS Management | 카페24 DNS 관리 |

### DNS Records

| 호스트 | 타입 | 값 | TTL |
|--------|------|-----|-----|
| @ | A | 43.201.163.136 | 300 |
| www | A | 43.201.163.136 | 300 |

---

## 3. SSL/TLS

| 항목 | 값 |
|------|-----|
| Provider | Let's Encrypt |
| Tool | Certbot (nginx plugin) |
| Domains | titleclash.com, www.titleclash.com |
| Auto-Renewal | Certbot cron (자동) |
| Certificate Path | /etc/letsencrypt/live/titleclash.com/ |

---

## 4. Services (Docker Compose)

| Service | Image | Internal Port | External Binding | 용도 |
|---------|-------|---------------|------------------|------|
| db | postgres:15 | 5432 | None (internal only) | 데이터베이스 |
| minio | minio/minio | 9000, 9001 | None (internal only) | 이미지 스토리지 |
| api | custom build | 3000 | 127.0.0.1:3000 | Express API |
| client | custom build | 80 | 127.0.0.1:8088 | Vite SPA (Nginx) |

### Host Nginx (SSL Reverse Proxy)

```
HTTPS :443 ──┬── / ──────── 127.0.0.1:8088 (client)
              ├── /api/ ──── 127.0.0.1:3000 (api)
              └── /storage/ ─ 127.0.0.1:3000 (api/uploads)

HTTP :80 ──── 301 redirect ──── HTTPS
```

---

## 5. File Locations (on EC2)

| 경로 | 용도 |
|------|------|
| /home/$USER/title-clash/ | 프로젝트 루트 |
| /home/$USER/title-clash/docker/.env | 프로덕션 환경변수 (비밀값) |
| /etc/nginx/sites-available/titleclash.com | Host Nginx 설정 |
| /etc/letsencrypt/live/titleclash.com/ | SSL 인증서 |

---

## 6. SSH Access

```bash
ssh -i "키페어파일.pem" ubuntu@43.201.163.136
```

---

## 7. Useful Commands

```bash
# 서비스 상태 확인
cd ~/title-clash/docker
docker compose -f docker-compose.prod.yml ps

# 로그 확인
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f client

# 서비스 재시작
docker compose -f docker-compose.prod.yml restart

# 전체 재배포
bash ~/title-clash/scripts/deploy_titleclash.sh

# SSL 인증서 갱신 테스트
sudo certbot renew --dry-run

# Nginx 설정 테스트 및 리로드
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. Backup Strategy

| 대상 | 방법 | 주기 |
|------|------|------|
| PostgreSQL data | EBS Snapshot | 주 1회 |
| MinIO data | EBS Snapshot | 주 1회 |
| .env secrets | 별도 안전한 곳 보관 | 변경 시 |

---

## 9. Cost Estimate (Monthly)

| 항목 | 예상 비용 |
|------|-----------|
| EC2 t3.small (on-demand) | ~$15 |
| EBS 30GB gp3 | ~$2.4 |
| Elastic IP | $0 (인스턴스 연결 시) |
| Data Transfer (첫 100GB) | ~$0 |
| **Total** | **~$18/month** |

---

## Version History

| Date | Changes |
|------|---------|
| 2026-02-13 | Initial infrastructure document created |
