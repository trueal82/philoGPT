#!/usr/bin/env bash
set -euo pipefail

# Kill services used by local development in two phases:
# 1) graceful stop (TERM / docker stop)
# 2) force stop (KILL) for anything still bound

PORTS=(3001 5001 27017)
GRACE_SECONDS="${GRACE_SECONDS:-3}"
KILLABLE_REGEX='(node|mongod|mongo|mongosh|tsx|ts-node|nodemon)'

log() {
  echo "[kill_all] $*"
}

is_running() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

find_pids_for_port() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u
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

  local port="$1"
  local ids id
  ids="$(docker ps --filter "publish=${port}" --format '{{.ID}}' 2>/dev/null || true)"
  [[ -z "$ids" ]] && return 0

  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    log "Stopping docker container $id publishing port $port"
    docker stop "$id" >/dev/null 2>&1 || true
  done <<< "$ids"
}

term_port_processes() {
  local port="$1"
  local pid
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue

    if pid_matches_allowed_process "$pid"; then
      log "TERM pid=$pid on port $port"
      kill -TERM "$pid" 2>/dev/null || true
    else
      local desc
      desc="$(ps -p "$pid" -o args= 2>/dev/null || true)"
      log "Skipping non Node/Mongo process pid=$pid on port $port: ${desc:-unknown}"
    fi
  done < <(find_pids_for_port "$port")
}

kill_port_processes_force() {
  local port="$1"
  local pid
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue

    if pid_matches_allowed_process "$pid" && is_running "$pid"; then
      log "KILL pid=$pid on port $port"
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done < <(find_pids_for_port "$port")
}

main() {
  log "Checking ports: ${PORTS[*]}"

  # Phase 1: graceful stop
  for port in "${PORTS[@]}"; do
    stop_docker_containers_by_port "$port"
    term_port_processes "$port"
  done

  log "Waiting ${GRACE_SECONDS}s for graceful shutdown"
  sleep "$GRACE_SECONDS"

  # Phase 2: force stop leftovers
  for port in "${PORTS[@]}"; do
    kill_port_processes_force "$port"
  done

  log "Final port status"
  for port in "${PORTS[@]}"; do
    local_pids="$(find_pids_for_port "$port" || true)"
    if [[ -n "$local_pids" ]]; then
      log "Port $port still has listener(s): $local_pids"
      lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    else
      log "Port $port is free"
    fi
  done
}

main "$@"