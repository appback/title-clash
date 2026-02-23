#!/usr/bin/env bash
# ===========================================
# Title Clash Production Hot-Patch
# ===========================================
# Patches specific files into running Docker containers on EC2.
# For full image rebuild + deploy, use deploy_titleclash.sh instead.
#
# Usage:
#   bash scripts/prod_patch.sh api controllers/v1/auth.js routes/v1/auth.js
#   bash scripts/prod_patch.sh client
#   bash scripts/prod_patch.sh migrate db/migrations/021_hub_auth.sql
#   bash scripts/prod_patch.sh all controllers/v1/auth.js routes/v1/auth.js
#
# Modes:
#   api <files...>     Patch API files + restart container
#   client             Build client + deploy dist
#   migrate <files..>  Run SQL migration(s) on prod DB
#   all <files...>     migrate + api patch + client build (full hot-patch)
# ===========================================
set -euo pipefail

cd "$(dirname "$0")/.."

# --- Config ---
EC2_HOST="43.201.163.136"
EC2_USER="ec2-user"
# Copy pem to /tmp if on /mnt/c (WSL can't chmod on Windows mounts)
_RAW_KEY="${KEY_FILE:-/tmp/appback.pem}"
if [[ "${_RAW_KEY}" == /mnt/c/* ]]; then
  cp "${_RAW_KEY}" /tmp/_appback_deploy.pem
  chmod 600 /tmp/_appback_deploy.pem
  KEY_FILE="/tmp/_appback_deploy.pem"
else
  KEY_FILE="${_RAW_KEY}"
fi
SSH="ssh -i ${KEY_FILE} -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST}"
SCP="scp -i ${KEY_FILE} -o StrictHostKeyChecking=no"

MODE="${1:-}"
shift || true

if [ -z "${MODE}" ]; then
  echo "Usage: bash scripts/prod_patch.sh <api|client|migrate|all> [files...]"
  exit 1
fi

# --- Functions ---

patch_api() {
  local files=("$@")
  if [ ${#files[@]} -eq 0 ]; then
    echo "ERROR: api mode requires file paths (relative to apps/api/)"
    exit 1
  fi

  echo "[API] Patching ${#files[@]} file(s)..."
  cd apps/api
  tar czf /tmp/tc-api-patch.tar.gz "${files[@]}"
  cd ../..

  ${SCP} /tmp/tc-api-patch.tar.gz ${EC2_USER}@${EC2_HOST}:/tmp/
  ${SSH} "docker cp /tmp/tc-api-patch.tar.gz titleclash-api-1:/tmp/ && \
    docker exec titleclash-api-1 sh -c 'cd /app && tar xzf /tmp/tc-api-patch.tar.gz && rm /tmp/tc-api-patch.tar.gz' && \
    docker restart titleclash-api-1 && \
    rm /tmp/tc-api-patch.tar.gz"
  rm -f /tmp/tc-api-patch.tar.gz

  echo "[API] Patch applied + container restarted"
}

patch_client() {
  echo "[CLIENT] Building..."
  cd client
  node node_modules/vite/bin/vite.js build
  cd dist
  tar czf /tmp/tc-client-dist.tar.gz .
  cd ../..

  ${SCP} /tmp/tc-client-dist.tar.gz ${EC2_USER}@${EC2_HOST}:/tmp/
  ${SSH} "docker cp /tmp/tc-client-dist.tar.gz titleclash-client-1:/tmp/ && \
    docker exec titleclash-client-1 sh -c 'cd /usr/share/nginx/html && rm -rf assets && tar xzf /tmp/tc-client-dist.tar.gz && rm /tmp/tc-client-dist.tar.gz' && \
    rm /tmp/tc-client-dist.tar.gz"
  rm -f /tmp/tc-client-dist.tar.gz

  echo "[CLIENT] Deploy complete"
}

run_migrate() {
  local files=("$@")
  if [ ${#files[@]} -eq 0 ]; then
    echo "ERROR: migrate mode requires SQL file paths (relative to project root)"
    exit 1
  fi

  for sql in "${files[@]}"; do
    echo "[MIGRATE] Running ${sql}..."
    ${SSH} "docker exec -i titleclash-db-1 psql -U postgres -d titleclash" < "${sql}"
    echo "[MIGRATE] ${sql} done"
  done
}

# --- Execute ---

case "${MODE}" in
  api)
    patch_api "$@"
    ;;
  client)
    patch_client
    ;;
  migrate)
    run_migrate "$@"
    ;;
  all)
    # Find new migrations (pass SQL files after 'all', or skip)
    SQL_FILES=()
    API_FILES=()
    for f in "$@"; do
      if [[ "${f}" == *.sql ]]; then
        SQL_FILES+=("${f}")
      else
        API_FILES+=("${f}")
      fi
    done

    if [ ${#SQL_FILES[@]} -gt 0 ]; then
      run_migrate "${SQL_FILES[@]}"
    fi
    if [ ${#API_FILES[@]} -gt 0 ]; then
      patch_api "${API_FILES[@]}"
    fi
    patch_client
    ;;
  *)
    echo "Unknown mode: ${MODE}"
    echo "Usage: bash scripts/prod_patch.sh <api|client|migrate|all> [files...]"
    exit 1
    ;;
esac

echo ""
echo "=== [PROD] Patch Complete ==="
echo "  https://titleclash.com"
