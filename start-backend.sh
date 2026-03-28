#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/backend"

if [[ ! -d node_modules ]]; then
  echo "[backend] installing dependencies"
  npm install
fi

export NODE_ENV="${NODE_ENV:-development}"
export LOG_LEVEL="${LOG_LEVEL:-debug}"

echo "[backend] starting in watch mode on http://localhost:5001 (LOG_LEVEL=${LOG_LEVEL})"
exec npm run dev:watch