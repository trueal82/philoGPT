#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./launcher-common.sh
. "$ROOT_DIR/launcher-common.sh"

set_terminal_title "philoGPT: start-api"

PORT="${PORT:-5001}"
KILLABLE_REGEX='(node|tsx|ts-node|nodemon)'
GRACE_SECONDS="${GRACE_SECONDS:-3}"

cd "$ROOT_DIR/api"

gracefully_stop_port_processes "api" "$PORT" "$KILLABLE_REGEX" "$GRACE_SECONDS"
ensure_port_is_free "api" "$PORT"

if [[ ! -d node_modules ]]; then
  echo "[api] installing dependencies"
  npm install
fi

export NODE_ENV="${NODE_ENV:-development}"
export LOG_LEVEL="${LOG_LEVEL:-debug}"

echo "[api] starting in watch mode on http://localhost:${PORT} (LOG_LEVEL=${LOG_LEVEL})"
exec npm run dev:watch