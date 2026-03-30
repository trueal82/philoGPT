#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/admin-frontend-new"

if [[ ! -d node_modules ]]; then
  echo "[admin-frontend] installing dependencies"
  npm install
fi

export NODE_ENV="${NODE_ENV:-development}"

echo "[admin-frontend] running TypeScript compile check"
npx tsc --noEmit

echo "[admin-frontend] starting Vite dev server on http://localhost:3001"
exec npm run dev -- --host 0.0.0.0 --port 3001