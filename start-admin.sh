#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./launcher-common.sh
. "$ROOT_DIR/launcher-common.sh"

set_terminal_title "philoGPT: start-admin"

PORT="${PORT:-3001}"
KILLABLE_REGEX='(node|npm|vite)'
GRACE_SECONDS="${GRACE_SECONDS:-3}"

cd "$ROOT_DIR/admin-frontend-new"

gracefully_stop_port_processes "admin-frontend" "$PORT" "$KILLABLE_REGEX" "$GRACE_SECONDS"
ensure_port_is_free "admin-frontend" "$PORT"

if [[ ! -d node_modules ]]; then
  echo "[admin-frontend] installing dependencies"
  npm install
fi

export NODE_ENV="${NODE_ENV:-development}"

echo "[admin-frontend] running TypeScript compile check"
npx tsc --noEmit

echo "[admin-frontend] starting Vite dev server on http://localhost:${PORT}"
exec npm run dev -- --host 0.0.0.0 --port "$PORT"