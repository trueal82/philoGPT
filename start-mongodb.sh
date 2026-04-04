#!/usr/bin/env bash
# start-mongodb.sh — Pure MongoDB launcher for local development.
# Prefers local mongod; falls back to Docker if unavailable.
# Seeding is handled by the API service (SEED_ON_EMPTY_DB env var).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./launcher-common.sh
. "$ROOT_DIR/launcher-common.sh"

set_terminal_title "philoGPT: start-mongodb"

MONGO_CONTAINER="${MONGO_CONTAINER:-philogpt-mongo-dev}"
MONGO_DB="${MONGO_DB:-philogpt}"
MONGO_VOLUME="${MONGO_VOLUME:-philogpt_mongo_data}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGOD_PID=""
STARTED_CONTAINER=false
GRACE_SECONDS="${GRACE_SECONDS:-3}"
KILLABLE_REGEX='(mongod|mongo|mongosh)'
PURGE=false

APP_COLLECTIONS=()

load_app_collections() {
  local source_file="$ROOT_DIR/api/src/scripts/appCollections.ts"

  if [[ -f "$source_file" ]]; then
    mapfile -t APP_COLLECTIONS < <(
      awk "
        /export const APP_COLLECTIONS = \[/ { in_block = 1; next }
        /\] as const;/ { in_block = 0 }
        in_block {
          while (match(\$0, /'[^']+'/)) {
            print substr(\$0, RSTART + 1, RLENGTH - 2)
            \$0 = substr(\$0, RSTART + RLENGTH)
          }
        }
      " "$source_file"
    )
  fi

  if [[ "${#APP_COLLECTIONS[@]}" -gt 0 ]]; then
    echo "[mongo] loaded ${#APP_COLLECTIONS[@]} app collections from api/src/scripts/appCollections.ts"
    return 0
  fi

  # Fallback if the canonical source file format changes or is unavailable.
  APP_COLLECTIONS=(
    users bots playgroundsessions messages systemprompts profiles
    chatsessions clientmemories llmconfigs languages usergroups
    subscriptions botlocales tools toolcalllogs smtpconfigs counselingplans
  )
  echo "[mongo] warning: using fallback app collection list" >&2
}

usage() {
  echo "Usage: $0 [--purge]"
  echo "  --purge   Drop app collections (API will reseed on next start if SEED_ON_EMPTY_DB=true)"
}

for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[mongo] unknown argument: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

load_app_collections

stop_docker_containers_by_port_gracefully "mongo" "$MONGO_PORT"
gracefully_stop_port_processes "mongo" "$MONGO_PORT" "$KILLABLE_REGEX" "$GRACE_SECONDS"
ensure_port_is_free "mongo" "$MONGO_PORT"

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
