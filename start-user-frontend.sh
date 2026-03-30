#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/user-frontend"

if [[ ! -d node_modules ]]; then
	echo "[user-frontend] installing dependencies"
	npm install
fi

echo "[user-frontend] running TypeScript compile check"
npm run typecheck

echo "[user-frontend] starting Vite dev server on http://localhost:3002"
exec npm run dev -- --host 0.0.0.0 --port 3002
