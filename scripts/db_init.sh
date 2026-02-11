#!/usr/bin/env bash
# Apply initial SQL to PostgreSQL in container or direct connection
set -euo pipefail
SQL_FILE="$(dirname "$0")/../db/migrations/init.sql"
if [ ! -f "$SQL_FILE" ]; then
  echo "init.sql not found: $SQL_FILE"
  exit 1
fi

PG_URL=${DATABASE_URL:-${TITLECLASH_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/titleclash}}

echo "Applying migrations to $PG_URL"
export PGPASSWORD=$(python3 -c "import os,sys;print('')") || true
psql "$PG_URL" -f "$SQL_FILE"

echo "done"
