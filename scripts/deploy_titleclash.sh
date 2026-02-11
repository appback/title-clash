#!/usr/bin/env bash
# Deploy script for TitleClash on EC2
# Usage: run as ec2-user on the instance (or adapt paths)
set -euo pipefail
ROOT=/home/ec2-user/title-clash
REPO_DIR=${ROOT}
GIT_REMOTE=git@github.com:appback/title-clash.git
BRANCH=${1:-main}

echo "[deploy] ensure repo exists at $REPO_DIR"
mkdir -p "$REPO_DIR"
cd "$REPO_DIR"
if [ ! -d .git ]; then
  echo "[deploy] cloning repo"
  git clone "$GIT_REMOTE" .
else
  echo "[deploy] fetching latest"
  git fetch --all --prune
  git reset --hard origin/$BRANCH
fi

# Ensure override file exists (does not contain secrets here)
OVERRIDE_FILE=${REPO_DIR}/docker/docker-compose.aws.override.yml
if [ ! -f "$OVERRIDE_FILE" ]; then
  echo "[deploy] missing docker-compose.aws.override.yml; please create with secrets (not in git)"
  exit 1
fi

# Optional: backup current compose state
BACKUP_DIR=/home/ec2-user/title-clash/backups
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"

echo "[deploy] creating backup $BACKUP_FILE"
tar -czf "$BACKUP_FILE" -C "$REPO_DIR" .

# Pull images and (re)create services
cd "$REPO_DIR/docker"

echo "[deploy] pulling images and building"
docker compose -f docker-compose.yml -f docker-compose.aws.override.yml pull || true

echo "[deploy] bringing up services"
docker compose -f docker-compose.yml -f docker-compose.aws.override.yml up -d --build

# Post-deploy healthcheck (adjust port/path if needed)
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:8083/lotto/actuator/health}

echo "[deploy] waiting for health endpoint: $HEALTH_URL"
for i in {1..20}; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[deploy] health OK"
    exit 0
  fi
  sleep 3
done

echo "[deploy] healthcheck failed"
exit 2
