#!/usr/bin/env bash
# ===========================================
# Title-Clash Deploy Script
# ===========================================
# Usage: bash scripts/deploy_titleclash.sh [branch]
# Run from EC2 instance
# ===========================================
set -euo pipefail

ROOT=/home/$USER/title-clash
REPO_DIR=${ROOT}
GIT_REMOTE=git@github.com:appback/title-clash.git
BRANCH=${1:-main}
COMPOSE_FILE=docker-compose.prod.yml

echo "=========================================="
echo " Deploying Title-Clash ($BRANCH)"
echo "=========================================="

# --- 1. Ensure repo ---
echo "[1/5] Ensuring repo at $REPO_DIR..."
mkdir -p "$REPO_DIR"
cd "$REPO_DIR"

if [ ! -d .git ]; then
  echo "  Cloning repo..."
  git clone "$GIT_REMOTE" .
else
  echo "  Pulling latest changes..."
  git fetch --all --prune
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
fi

# --- 2. Check .env ---
echo "[2/5] Checking environment file..."
ENV_FILE="$REPO_DIR/docker/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "  ERROR: docker/.env not found!"
  echo "  Run: cp docker/.env.production docker/.env && nano docker/.env"
  exit 1
fi

# --- 3. Build & Deploy ---
echo "[3/5] Building and deploying services..."
cd "$REPO_DIR/docker"
docker compose -f "$COMPOSE_FILE" --env-file .env pull || true
docker compose -f "$COMPOSE_FILE" --env-file .env up -d --build

# --- 4. Wait for health ---
echo "[4/5] Waiting for services to be healthy..."
sleep 5

RETRIES=15
for i in $(seq 1 $RETRIES); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
    echo "  API health: OK"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "  WARNING: API health check failed after ${RETRIES} attempts"
    echo "  Check logs: docker compose -f $COMPOSE_FILE logs api"
  fi
  echo "  Attempt $i/$RETRIES - waiting..."
  sleep 3
done

# --- 5. Status ---
echo "[5/5] Service status:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "=========================================="
echo " Deploy Complete!"
echo "=========================================="
echo " Site: https://titleclash.com"
echo " Logs: cd docker && docker compose -f $COMPOSE_FILE logs -f"
echo "=========================================="
