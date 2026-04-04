#!/usr/bin/env bash
set -euo pipefail

# Kill only the API (port 5001) — leaves frontends and MongoDB untouched.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./launcher-common.sh
. "$ROOT_DIR/launcher-common.sh"

set_terminal_title "philoGPT: kill-api"

PORT=5001
GRACE_SECONDS="${GRACE_SECONDS:-3}"
KILLABLE_REGEX='(node|tsx|ts-node|nodemon)'

log() {
  echo "[kill_api] $*"
}

is_running() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

find_pids_for_port() {
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN -t 2>/dev/null | sort -u
}

pid_matches_allowed_process() {
  local pid="$1"
  local comm args
  comm="$(ps -p "$pid" -o comm= 2>/dev/null | tr -d '[:space:]' || true)"
  args="$(ps -p "$pid" -o args= 2>/dev/null || true)"

  if [[ "$comm" =~ $KILLABLE_REGEX ]] || [[ "$args" =~ $KILLABLE_REGEX ]]; then
    return 0
  fi
  return 1
}

stop_docker_containers_by_port() {
  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi

  local ids id
  ids="$(docker ps --filter "publish=${PORT}" --format '{{.ID}}' 2>/dev/null || true)"
  [[ -z "$ids" ]] && return 0

  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    log "Stopping docker container $id publishing port $PORT"
    docker stop "$id" >/dev/null 2>&1 || true
  done <<< "$ids"
}

main() {
  log "Stopping API on port $PORT"

  stop_docker_containers_by_port

  # Phase 1: graceful TERM
  local pid
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    if pid_matches_allowed_process "$pid"; then
      log "TERM pid=$pid"
      kill -TERM "$pid" 2>/dev/null || true
    else
      local desc
      desc="$(ps -p "$pid" -o args= 2>/dev/null || true)"
      log "Skipping non-Node process pid=$pid: ${desc:-unknown}"
    fi
  done < <(find_pids_for_port)

  log "Waiting ${GRACE_SECONDS}s for graceful shutdown"
  sleep "$GRACE_SECONDS"

  # Phase 2: force KILL leftovers
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    if pid_matches_allowed_process "$pid" && is_running "$pid"; then
      log "KILL pid=$pid"
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done < <(find_pids_for_port)

  # Report
  local remaining
  remaining="$(find_pids_for_port || true)"
  if [[ -n "$remaining" ]]; then
    log "Port $PORT still has listener(s): $remaining"
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
  else
    log "Port $PORT is free"
  fi
}

main "$@"
