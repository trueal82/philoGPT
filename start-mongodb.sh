#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONGO_CONTAINER="${MONGO_CONTAINER:-philogpt-mongo-dev}"
MONGO_IMAGE="${MONGO_IMAGE:-philogpt-mongo:dev}"
MONGO_DB="${MONGO_DB:-philogpt}"
MONGO_VOLUME="${MONGO_VOLUME:-philogpt_mongo_data}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGOD_PID=""
PURGE=false
STARTED_CONTAINER=false
GRACE_SECONDS="${GRACE_SECONDS:-3}"

APP_COLLECTIONS=(
  users
  bots
  playgroundsessions
  messages
  systemprompts
  profiles
  chatsessions
  clientmemories
  llmconfigs
  languages
  usergroups
  subscriptions
  botlocales
  tools
)

usage() {
  echo "Usage: $0 [--purge]"
  echo "  --purge   Purge app collections and reseed on startup"
}

for arg in "$@"; do
  case "$arg" in
    --purge)
      PURGE=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[mongo] unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
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

build_collection_array_js() {
  local joined=""
  local name
  for name in "${APP_COLLECTIONS[@]}"; do
    if [[ -n "$joined" ]]; then
      joined+=","
    fi
    joined+="'${name}'"
  done
  printf '[%s]' "$joined"
}

wait_for_mongo_local() {
  for _ in $(seq 1 60); do
    if mongosh --quiet --host 127.0.0.1 --port "$MONGO_PORT" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      echo "[mongo] local mongod is ready"
      return 0
    fi
    sleep 1
  done
  echo "[mongo] local mongod did not become ready in time" >&2
  return 1
}

wait_for_mongo_docker() {
  for _ in $(seq 1 60); do
    if docker exec "$MONGO_CONTAINER" mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      echo "[mongo] docker mongo is ready"
      return 0
    fi
    sleep 1
  done
  echo "[mongo] docker mongo did not become ready in time" >&2
  return 1
}

purge_schema_local() {
  local js_collections
  js_collections="$(build_collection_array_js)"
  echo "[mongo] purging app collections in '$MONGO_DB' (local mongod)"
  mongosh --quiet --host 127.0.0.1 --port "$MONGO_PORT" --eval "const dbName='${MONGO_DB}'; const keep=${js_collections}; const d=db.getSiblingDB(dbName); const existing=new Set(d.getCollectionNames()); for (const name of keep) { if (existing.has(name)) { d.getCollection(name).drop(); print('dropped:' + name); } }" | sed 's/^/[mongo] /'
}

seed_initial_data_local() {
  echo "[mongo] checking and seeding '$MONGO_DB' if empty (local mongod)"
  (
    cd "$ROOT_DIR/backend"
    if [[ ! -d node_modules ]]; then
      echo "[mongo] installing backend dependencies for seed"
      npm install
    fi
    MONGODB_URI="mongodb://127.0.0.1:${MONGO_PORT}/${MONGO_DB}" FORCE_DEMO_SEED="$PURGE" npx ts-node ../mongodb/initDefaultData.ts
  )
}

start_local_mongod() {
  mkdir -p "$ROOT_DIR/.mongo-data"
  echo "[mongo] starting local mongod on localhost:${MONGO_PORT}"
  mongod --dbpath "$ROOT_DIR/.mongo-data" --bind_ip 127.0.0.1 --port "$MONGO_PORT" &
  MONGOD_PID=$!

  wait_for_mongo_local
  if $PURGE; then
    purge_schema_local
  fi
  seed_initial_data_local

  echo "[mongo] local mongod running (pid=$MONGOD_PID). Press Ctrl+C to stop"
  wait "$MONGOD_PID"
}

start_docker_mongo() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[mongo] error: neither local mongod nor docker is available" >&2
    exit 1
  fi

  if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    if $PURGE; then
      echo "[mongo] --purge requested; recreating running container '$MONGO_CONTAINER'"
      docker stop "$MONGO_CONTAINER" >/dev/null
    else
      echo "[mongo] container '$MONGO_CONTAINER' is already running"
      echo "[mongo] streaming container logs (Ctrl+C to stop streaming only)"
      docker logs -f "$MONGO_CONTAINER"
      return 0
    fi
  fi

  if docker ps -a --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    docker rm "$MONGO_CONTAINER" >/dev/null
  fi

  echo "[mongo] building mongo image from $ROOT_DIR/mongodb"
  docker build -t "$MONGO_IMAGE" -f "$ROOT_DIR/mongodb/Dockerfile" "$ROOT_DIR"

  echo "[mongo] starting container '$MONGO_CONTAINER' on localhost:${MONGO_PORT}"
  docker run -d --name "$MONGO_CONTAINER" \
    -p "${MONGO_PORT}:27017" \
    -e MONGO_DB="$MONGO_DB" \
    -e PURGE="$PURGE" \
    -v "$MONGO_VOLUME:/data/db" \
    "$MONGO_IMAGE" >/dev/null
  STARTED_CONTAINER=true

  wait_for_mongo_docker
  echo "[mongo] streaming container logs (Ctrl+C to stop and stop container)"
  docker logs -f "$MONGO_CONTAINER"
}

if command -v mongod >/dev/null 2>&1; then
  start_local_mongod
  exit 0
fi

start_docker_mongo
