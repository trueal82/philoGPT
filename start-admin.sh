#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/admin-frontend-new"

if [[ ! -d node_modules ]]; then
  echo "[frontend] installing dependencies"
  npm install
fi

export NODE_ENV="${NODE_ENV:-development}"
export LOG_LEVEL="${LOG_LEVEL:-debug}"
export DEBUG="${DEBUG:-express:*}"

echo "[frontend] starting on http://localhost:3001 (LOG_LEVEL=${LOG_LEVEL}, DEBUG=${DEBUG})"
exec npm start