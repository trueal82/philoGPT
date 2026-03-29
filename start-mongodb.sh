#!/usr/bin/env bash
# start-mongodb.sh — Pure MongoDB launcher for local development.
# Prefers local mongod; falls back to Docker if unavailable.
# Seeding is handled by the backend (SEED_ON_EMPTY_DB env var).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONGO_CONTAINER="${MONGO_CONTAINER:-philogpt-mongo-dev}"
MONGO_DB="${MONGO_DB:-philogpt}"
MONGO_VOLUME="${MONGO_VOLUME:-philogpt_mongo_data}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGOD_PID=""
STARTED_CONTAINER=false
GRACE_SECONDS="${GRACE_SECONDS:-3}"
PURGE=false

APP_COLLECTIONS=(
  users bots playgroundsessions messages systemprompts profiles
  chatsessions clientmemories llmconfigs languages usergroups
  subscriptions botlocales tools
)

usage() {
  echo "Usage: $0 [--purge]"
  echo "  --purge   Drop app collections (backend will reseed on next start if SEED_ON_EMPTY_DB=true)"
}

for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[mongo] unknown argument: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

cleanup() {
  if [[ -n "$MONGOD_PID" ]]; then
    echo "[mongo] stopping local mongod"
    kill -TERM "$MONGOD_PID" 2>/dev/null || true
    sleep "$GRACE_SECONDS"
    kill -KILL "$MONGOD_PID" 2>/dev/null || true
  fi
  if $STARTED_CONTAINER; then
    echo "[mongo] stopping container '$MONGO_CONTAINER'"
    docker stop "$MONGO_CONTAINER" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

wait_for_mongo() {
  local host="${1:-127.0.0.1}" port="${2:-$MONGO_PORT}"
  for _ in $(seq 1 60); do
    if mongosh --quiet --host "$host" --port "$port" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      echo "[mongo] mongod is ready on ${host}:${port}"
      return 0
    fi
    sleep 1
  done
  echo "[mongo] mongod did not become ready in time" >&2
  return 1
}

purge_collections() {
  local host="${1:-127.0.0.1}" port="${2:-$MONGO_PORT}"
  local joined=""
  for name in "${APP_COLLECTIONS[@]}"; do
    [[ -n "$joined" ]] && joined+=","
    joined+="'${name}'"
  done
  echo "[mongo] --purge: dropping app collections in '$MONGO_DB'"
  mongosh --quiet --host "$host" --port "$port" --eval \
    "const d=db.getSiblingDB('${MONGO_DB}'); const cols=[${joined}]; const existing=new Set(d.getCollectionNames()); for (const c of cols) { if (existing.has(c)) { d.getCollection(c).drop(); print('dropped: ' + c); } }" \
    | sed 's/^/[mongo] /'
}

start_local_mongod() {
  mkdir -p "$ROOT_DIR/.mongo-data"
  echo "[mongo] starting local mongod on localhost:${MONGO_PORT}"
  mongod --dbpath "$ROOT_DIR/.mongo-data" --bind_ip 127.0.0.1 --port "$MONGO_PORT" &
  MONGOD_PID=$!

  wait_for_mongo 127.0.0.1 "$MONGO_PORT"
  $PURGE && purge_collections 127.0.0.1 "$MONGO_PORT"

  echo "[mongo] local mongod running (pid=$MONGOD_PID). Press Ctrl+C to stop."
  wait "$MONGOD_PID"
}

start_docker_mongo() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[mongo] error: neither local mongod nor docker is available" >&2
    exit 1
  fi

  if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    if $PURGE; then
      echo "[mongo] --purge requested; stopping container '$MONGO_CONTAINER'"
      docker stop "$MONGO_CONTAINER" >/dev/null
    else
      echo "[mongo] container '$MONGO_CONTAINER' is already running"
      docker logs -f "$MONGO_CONTAINER"
      return 0
    fi
  fi

  docker ps -a --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$" && docker rm "$MONGO_CONTAINER" >/dev/null

  echo "[mongo] starting container '$MONGO_CONTAINER' on localhost:${MONGO_PORT}"
  docker run -d --name "$MONGO_CONTAINER" \
    -p "${MONGO_PORT}:27017" \
    -v "$MONGO_VOLUME:/data/db" \
    mongo:latest >/dev/null
  STARTED_CONTAINER=true

  wait_for_mongo 127.0.0.1 "$MONGO_PORT"
  $PURGE && purge_collections 127.0.0.1 "$MONGO_PORT"

  echo "[mongo] streaming container logs (Ctrl+C to stop)"
  docker logs -f "$MONGO_CONTAINER"
}

if command -v mongod >/dev/null 2>&1; then
  start_local_mongod
  exit 0
fi

start_docker_mongo
