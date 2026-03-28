#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONGO_CONTAINER="${MONGO_CONTAINER:-philogpt-mongo-dev}"
MONGOD_PID=""
STARTED_DOCKER_CONTAINER=false
SEED_DATA="${SEED_DATA:-true}"
MONGO_DB="${MONGO_DB:-philogpt}"
GRACE_SECONDS="${GRACE_SECONDS:-3}"
PURGE=false

# Only purge collections that belong to this backend schema.
APP_COLLECTIONS=(
  users
  bots
  playgroundsessions
  messages
  systemprompts
  profiles
  chatsessions
  llmconfigs
  languages
  usergroups
  subscriptions
  botlocales
  tools
)

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

usage() {
  echo "Usage: $0 [--purge]"
  echo "  --purge   Drop only app collections in MONGO_DB, then seed demo data"
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

  if $STARTED_DOCKER_CONTAINER && command -v docker >/dev/null 2>&1; then
    echo "[mongo] stopping docker container '$MONGO_CONTAINER'"
    docker stop "$MONGO_CONTAINER" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

wait_for_mongo_local() {
  local i
  for i in $(seq 1 30); do
    if mongosh --quiet --host 127.0.0.1 --port 27017 --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      echo "[mongo] local mongod is ready"
      return 0
    fi
    sleep 1
  done
  echo "[mongo] local mongod did not become ready in time" >&2
  return 1
}

wait_for_mongo_docker() {
  local i
  for i in $(seq 1 30); do
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
  mongosh --quiet --host 127.0.0.1 --port 27017 --eval "const dbName='${MONGO_DB}'; const keep=${js_collections}; const d=db.getSiblingDB(dbName); const existing=new Set(d.getCollectionNames()); for (const name of keep) { if (existing.has(name)) { d.getCollection(name).drop(); print('dropped:' + name); } }" | sed 's/^/[mongo] /'
  print_remaining_non_empty_collections_local
}

purge_schema_docker() {
  local js_collections
  js_collections="$(build_collection_array_js)"
  echo "[mongo] purging app collections in '$MONGO_DB' (docker mongod)"
  docker exec "$MONGO_CONTAINER" mongosh --quiet --eval "const dbName='${MONGO_DB}'; const keep=${js_collections}; const d=db.getSiblingDB(dbName); const existing=new Set(d.getCollectionNames()); for (const name of keep) { if (existing.has(name)) { d.getCollection(name).drop(); print('dropped:' + name); } }" | sed 's/^/[mongo] /'
  print_remaining_non_empty_collections_docker
}

print_remaining_non_empty_collections_local() {
  echo "[mongo] checking for remaining non-empty collections after purge (local mongod)"
  mongosh --quiet --host 127.0.0.1 --port 27017 --eval "const dbName='${MONGO_DB}'; const d=db.getSiblingDB(dbName); const names=d.getCollectionNames().filter(n => !n.startsWith('system.')); const nonEmpty=[]; for (const n of names) { if (d.getCollection(n).findOne() !== null) nonEmpty.push(n); } if (nonEmpty.length===0) { print('none'); } else { print(nonEmpty.join(',')); }" | sed 's/^/[mongo] remaining: /'
}

print_remaining_non_empty_collections_docker() {
  echo "[mongo] checking for remaining non-empty collections after purge (docker mongod)"
  docker exec "$MONGO_CONTAINER" mongosh --quiet --eval "const dbName='${MONGO_DB}'; const d=db.getSiblingDB(dbName); const names=d.getCollectionNames().filter(n => !n.startsWith('system.')); const nonEmpty=[]; for (const n of names) { if (d.getCollection(n).findOne() !== null) nonEmpty.push(n); } if (nonEmpty.length===0) { print('none'); } else { print(nonEmpty.join(',')); }" | sed 's/^/[mongo] remaining: /'
}

mongo_db_has_data_local() {
  local result
  result="$(mongosh --quiet --host 127.0.0.1 --port 27017 --eval "const dbName='${MONGO_DB}'; const d=db.getSiblingDB(dbName); const names=d.getCollectionNames().filter(n => !n.startsWith('system.')); let hasData=false; for (const n of names) { if (d.getCollection(n).findOne() !== null) { hasData=true; break; } } print(hasData ? 'true' : 'false');" 2>/dev/null | tail -n 1 | tr -d '\r')"
  [[ "$result" == "true" ]]
}

mongo_db_has_data_docker() {
  local result
  result="$(docker exec "$MONGO_CONTAINER" mongosh --quiet --eval "const dbName='${MONGO_DB}'; const d=db.getSiblingDB(dbName); const names=d.getCollectionNames().filter(n => !n.startsWith('system.')); let hasData=false; for (const n of names) { if (d.getCollection(n).findOne() !== null) { hasData=true; break; } } print(hasData ? 'true' : 'false');" 2>/dev/null | tail -n 1 | tr -d '\r')"
  [[ "$result" == "true" ]]
}

should_seed_data() {
  local mode="$1"

  if $PURGE; then
    echo "[mongo] purge requested; seed will run"
    return 0
  fi

  if [[ "$SEED_DATA" != "true" ]]; then
    echo "[mongo] skipping seed (SEED_DATA=$SEED_DATA)"
    return 1
  fi

  if [[ "$mode" == "local" ]]; then
    if mongo_db_has_data_local; then
      echo "[mongo] skipping seed: database '$MONGO_DB' already has data"
      return 1
    fi
  else
    if mongo_db_has_data_docker; then
      echo "[mongo] skipping seed: database '$MONGO_DB' already has data"
      return 1
    fi
  fi

  echo "[mongo] database '$MONGO_DB' is empty; seed will run"
  return 0
}

seed_initial_data() {
  local mode="$1"
  local seed_uri="mongodb://localhost:27017/${MONGO_DB}"

  if ! should_seed_data "$mode"; then
    return 0
  fi

  if [[ ! -d "$ROOT_DIR/backend" ]]; then
    echo "[mongo] backend folder not found, skipping seed"
    return 0
  fi

  echo "[mongo] loading initial data from backend/src/scripts/initDefaultData.ts"
  (
    cd "$ROOT_DIR/backend"
    if [[ ! -d node_modules ]]; then
      echo "[mongo] installing backend dependencies for seed"
      npm install
    fi
    local force_seed="false"
    if $PURGE; then
      force_seed="true"
    fi
    MONGODB_URI="$seed_uri" LOG_LEVEL="${LOG_LEVEL:-info}" FORCE_DEMO_SEED="$force_seed" npx ts-node src/scripts/initDefaultData.ts
  )
  echo "[mongo] initial data load complete"
}

if command -v mongod >/dev/null 2>&1; then
  mkdir -p "$ROOT_DIR/.mongo-data"
  echo "[mongo] starting local mongod on localhost:27017"
  mongod --dbpath "$ROOT_DIR/.mongo-data" --bind_ip 127.0.0.1 --port 27017 &
  MONGOD_PID=$!

  wait_for_mongo_local
  if $PURGE; then
    purge_schema_local
  fi
  seed_initial_data local

  echo "[mongo] running (pid=$MONGOD_PID). Press Ctrl+C to stop"
  wait "$MONGOD_PID"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    echo "[mongo] container '${MONGO_CONTAINER}' is already running"
    wait_for_mongo_docker
    if $PURGE; then
      purge_schema_docker
    fi
    seed_initial_data docker
    echo "[mongo] streaming container logs (Ctrl+C to stop streaming only)"
    docker logs -f "$MONGO_CONTAINER"
    exit 0
  fi

  if docker ps -a --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    docker rm "$MONGO_CONTAINER" >/dev/null
  fi

  echo "[mongo] starting docker mongo on localhost:27017"
  docker run -d --rm --name "$MONGO_CONTAINER" -p 27017:27017 mongo:latest >/dev/null
  STARTED_DOCKER_CONTAINER=true

  wait_for_mongo_docker
  if $PURGE; then
    purge_schema_docker
  fi
  seed_initial_data docker

  echo "[mongo] streaming container logs (Ctrl+C to stop)"
  docker logs -f "$MONGO_CONTAINER"
  exit 0
fi

echo "[mongo] error: neither mongod nor docker is available" >&2
exit 1