#!/usr/bin/env bash
# run-security-tests.sh — One-command security test runner.
#
# Uses mongodb-memory-server (in-process), so no external MongoDB is needed.
# Simply runs the API security test suite and reports results.
#
# Usage:
#   ./run-security-tests.sh          # run security tests
#   ./run-security-tests.sh --all    # run all tests (including legacy)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./launcher-common.sh
. "$ROOT_DIR/launcher-common.sh"

set_terminal_title "philoGPT: run-security-tests"

cd "$ROOT_DIR/api"

echo "==> Installing dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

if [[ "${1:-}" == "--all" ]]; then
  echo "==> Running ALL tests..."
  npx jest --verbose
else
  echo "==> Running security tests..."
  npx jest --testPathPatterns=security --verbose
fi

echo ""
echo "==> Security tests complete."
