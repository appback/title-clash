#!/usr/bin/env bash
# ===========================================
# Title-Clash Deploy Script (Run from LOCAL)
# ===========================================
# Builds Docker images locally, transfers to EC2.
# No source code on EC2 — images + compose only.
#
# Usage (from project root):
#   bash scripts/deploy_titleclash.sh
# ===========================================
set -euo pipefail

# --- Config ---
EC2_HOST="43.201.163.136"
EC2_USER="ec2-user"
KEY_FILE="appback.pem"
REMOTE_DIR="/home/${EC2_USER}/titleclash"
SSH_OPT="-i ${KEY_FILE} -o StrictHostKeyChecking=no"
SSH_CMD="ssh ${SSH_OPT} ${EC2_USER}@${EC2_HOST}"
SCP_CMD="scp ${SSH_OPT}"
IMAGE_TAR="/tmp/titleclash-images.tar"

echo "=========================================="
echo " Deploying Title-Clash to AWS"
echo "=========================================="

# --- 1. Build images locally ---
echo "[1/5] Building Docker images locally..."
docker build -t titleclash-api:latest apps/api/
docker build -t titleclash-client:latest client/
echo "  Images built."

# --- 2. Save & transfer images ---
echo "[2/5] Saving and transferring images..."
docker save titleclash-api:latest titleclash-client:latest -o "${IMAGE_TAR}"
${SCP_CMD} "${IMAGE_TAR}" ${EC2_USER}@${EC2_HOST}:/tmp/
rm -f "${IMAGE_TAR}"
echo "  Images transferred."

# --- 3. Upload compose + config, load images on EC2 ---
echo "[3/5] Setting up EC2..."
${SSH_CMD} "mkdir -p ${REMOTE_DIR}/docker ${REMOTE_DIR}/db/migrations"
${SCP_CMD} docker/docker-compose.prod.yml ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/docker/
${SCP_CMD} docker/nginx-host.conf ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/docker/
${SCP_CMD} db/migrations/*.sql ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/db/migrations/
${SSH_CMD} "docker load -i /tmp/titleclash-images.tar && rm -f /tmp/titleclash-images.tar"
echo "  EC2 ready."

# --- 4. Start services ---
echo "[4/5] Starting services..."
${SSH_CMD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.prod.yml up -d"

# Health check
DEPLOY_TS=$(${SSH_CMD} "date -u +%Y-%m-%dT%H:%M:%SZ")
echo "  Waiting for API..."
sleep 5
for i in $(seq 1 15); do
  HEALTH=$(${SSH_CMD} "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health" 2>/dev/null)
  if [ "${HEALTH}" = "200" ]; then
    echo "  API: OK (attempt $i)"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "  WARNING: API health check failed (HTTP ${HEALTH})"
    ${SSH_CMD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.prod.yml logs --since=${DEPLOY_TS} api"
  else
    echo "  Attempt $i/15 (HTTP ${HEALTH})..."
    sleep 2
  fi
done

# --- 5. Status ---
echo "[5/5] Service status:"
${SSH_CMD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.prod.yml ps"

echo ""
echo "=========================================="
echo " Deploy Complete!"
echo "=========================================="
echo " https://titleclash.com"
echo "=========================================="
