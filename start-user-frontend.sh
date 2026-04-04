#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./launcher-common.sh
. "$ROOT_DIR/launcher-common.sh"

set_terminal_title "philoGPT: start-user-frontend"

PORT="${PORT:-3002}"
KILLABLE_REGEX='(node|npm|vite)'
GRACE_SECONDS="${GRACE_SECONDS:-3}"

cd "$ROOT_DIR/user-frontend"

gracefully_stop_port_processes "user-frontend" "$PORT" "$KILLABLE_REGEX" "$GRACE_SECONDS"
ensure_port_is_free "user-frontend" "$PORT"

if [[ ! -d node_modules ]]; then
	echo "[user-frontend] installing dependencies"
	npm install
fi

echo "[user-frontend] running TypeScript compile check"
npm run typecheck

echo "[user-frontend] starting Vite dev server on http://localhost:${PORT}"
exec npm run dev -- --host 0.0.0.0 --port "$PORT"
