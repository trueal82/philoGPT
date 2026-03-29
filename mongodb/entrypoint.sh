#!/usr/bin/env bash
set -euo pipefail

MONGO_DB="${MONGO_DB:-philogpt}"
MONGO_PORT="${MONGO_PORT:-27017}"
PURGE="${PURGE:-false}"

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

cleanup() {
  if [[ -n "${MONGOD_PID:-}" ]] && kill -0 "$MONGOD_PID" 2>/dev/null; then
    kill -TERM "$MONGOD_PID" 2>/dev/null || true
    wait "$MONGOD_PID" || true
  fi
}

trap cleanup EXIT INT TERM

mongod --bind_ip_all --port "$MONGO_PORT" --dbpath /data/db &
MONGOD_PID=$!

for _ in $(seq 1 60); do
  if mongosh --quiet --host 127.0.0.1 --port "$MONGO_PORT" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! mongosh --quiet --host 127.0.0.1 --port "$MONGO_PORT" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
  echo "[mongo] mongod did not become ready in time" >&2
  exit 1
fi

if [[ "$PURGE" == "true" ]]; then
  joined=""
  for name in "${APP_COLLECTIONS[@]}"; do
    if [[ -n "$joined" ]]; then
      joined+=","
    fi
    joined+="'${name}'"
  done

  echo "[mongo] PURGE=true; dropping app collections from '$MONGO_DB'"
  mongosh --quiet --host 127.0.0.1 --port "$MONGO_PORT" --eval "const dbName='${MONGO_DB}'; const keep=[${joined}]; const d=db.getSiblingDB(dbName); const existing=new Set(d.getCollectionNames()); for (const name of keep) { if (existing.has(name)) { d.getCollection(name).drop(); print('dropped:' + name); } }" | sed 's/^/[mongo] /'
fi

echo "[mongo] checking and seeding '$MONGO_DB' if empty"
(
  cd /workspace/backend
  MONGODB_URI="mongodb://127.0.0.1:${MONGO_PORT}/${MONGO_DB}" FORCE_DEMO_SEED="${PURGE}" npx ts-node /workspace/mongodb/initDefaultData.ts
)

echo "[mongo] startup seed check complete"
wait "$MONGOD_PID"
