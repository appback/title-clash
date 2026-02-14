#!/usr/bin/env bash
# ===========================================
# Title-Clash Deploy Script (Run from LOCAL)
# ===========================================
# Usage (from project root):
#   bash scripts/deploy_titleclash.sh
# ===========================================
set -euo pipefail

# --- Config ---
EC2_HOST="43.201.163.136"
EC2_USER="ec2-user"
KEY_FILE="appback.pem"
REMOTE_DIR="/home/${EC2_USER}/title-clash"
SSH_OPT="-i ${KEY_FILE} -o StrictHostKeyChecking=no"
SSH_CMD="ssh ${SSH_OPT} ${EC2_USER}@${EC2_HOST}"

echo "=========================================="
echo " Deploying Title-Clash to AWS"
echo "=========================================="

# --- 1. Sync files via git on remote ---
echo "[1/4] Syncing code to EC2..."
${SSH_CMD} "
  if [ ! -d ${REMOTE_DIR}/.git ]; then
    git clone https://github.com/appback/title-clash.git ${REMOTE_DIR}
  else
    cd ${REMOTE_DIR} && git fetch --all && git reset --hard origin/main
  fi
"

# Copy prod compose (contains secrets, not in git)
echo "  Uploading production files..."
scp ${SSH_OPT} docker/docker-compose.prod.yml ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/docker/
scp ${SSH_OPT} docker/nginx-host.conf ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/docker/

echo "  Files synced."

# --- 2. Build & Start ---
echo "[2/4] Building and starting services..."
${SSH_CMD} "cd ${REMOTE_DIR}/docker && \
  docker compose -f docker-compose.prod.yml up -d --build"

# --- 3. Health check ---
echo "[3/4] Waiting for services..."
sleep 8
for i in $(seq 1 10); do
  if ${SSH_CMD} "curl -fsS http://127.0.0.1:3000/api/v1/health" 2>/dev/null; then
    echo ""
    echo "  API: OK"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "  WARNING: API health check failed"
    ${SSH_CMD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.prod.yml logs --tail=30 api"
  fi
  echo "  Attempt $i/10..."
  sleep 3
done

# --- 4. Status ---
echo "[4/4] Service status:"
${SSH_CMD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.prod.yml ps"

echo ""
echo "=========================================="
echo " Deploy Complete!"
echo "=========================================="
echo " https://titleclash.com"
echo "=========================================="
