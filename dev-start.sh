#!/usr/bin/env bash
# Tawasul Academy — Development environment starter
#
# Starts ONLY PostgreSQL (via Docker) for local development.
# The Nuxt app is NOT started here — run it on the host with: npm run dev
#
# Safety:
#   - Never deletes the database or any Docker volume
#   - Never runs `docker compose down -v` or `docker system prune`
#   - Does not modify or overwrite .env / any environment variables
set -euo pipefail

DB_HOST="${TAWASUL_DB_HOST:-localhost}"
DB_PORT="${TAWASUL_DB_PORT:-5433}"
DB_USER="${TAWASUL_DB_USER:-tawasul}"
DB_NAME="${TAWASUL_DB_NAME:-tawasul_db}"

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker and try again." >&2
  exit 1
fi

echo "Starting development database (postgres only)..."
npm run dev:db

echo "Waiting for PostgreSQL..."
attempts=0
until docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 30 ]; then
    echo "Error: PostgreSQL did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

echo "PostgreSQL is ready."
echo ""
echo "Development environment:"
echo "  Database:    $DB_HOST:$DB_PORT"
echo "  Application: npm run dev"
echo "  Stop DB:     npm run dev:db:stop"
echo ""
echo "Note: the Nuxt app runs on the host so it never touches .nuxt as root."