#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/apps/projects/tawasul"
cd "$APP_DIR"

LOCK_FILE="/var/lock/deploy-build.lock"
exec 9>"$LOCK_FILE"
flock 9

git pull --ff-only origin main

nice -n 10 ionice -c2 -n7 docker compose -f docker-compose.prod.yml build app

docker compose -f docker-compose.prod.yml run --rm migrate

docker compose -f docker-compose.prod.yml up -d --force-recreate app
docker compose -f docker-compose.prod.yml up -d livekit

healthy=0
for _ in $(seq 1 150); do
  status="$(docker inspect -f '{{.State.Health.Status}}' tawasul_app 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    healthy=1
    break
  fi
  sleep 1
done

docker image prune -f

if [ "$healthy" -ne 1 ]; then
  docker logs --tail 40 tawasul_app || true
  exit 1
fi
