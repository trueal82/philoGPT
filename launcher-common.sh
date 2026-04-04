#!/usr/bin/env bash

set_terminal_title() {
  [[ -t 1 ]] || return 0

  case "${TERM:-}" in
    xterm*|rxvt*|screen*|tmux*|vt100*|vt220*|ansi*|alacritty*|wezterm*|kitty*|iterm*)
      printf '\033]0;%s\007' "$1"
      ;;
  esac
}

is_running() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

find_pids_for_port() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u
}

pid_matches_regex() {
  local pid="$1"
  local process_regex="$2"
  local comm args

  comm="$(ps -p "$pid" -o comm= 2>/dev/null | tr -d '[:space:]' || true)"
  args="$(ps -p "$pid" -o args= 2>/dev/null || true)"

  [[ "$comm" =~ $process_regex ]] || [[ "$args" =~ $process_regex ]]
}

wait_for_matching_port_processes_to_exit() {
  local port="$1"
  local process_regex="$2"
  local grace_seconds="${3:-3}"
  local second pid

  for ((second = 0; second < grace_seconds; second++)); do
    local still_running=false

    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      if pid_matches_regex "$pid" "$process_regex" && is_running "$pid"; then
        still_running=true
        break
      fi
    done < <(find_pids_for_port "$port")

    if [[ "$still_running" == false ]]; then
      return 0
    fi

    sleep 1
  done

  local final_pid
  while IFS= read -r final_pid; do
    [[ -z "$final_pid" ]] && continue
    if pid_matches_regex "$final_pid" "$process_regex" && is_running "$final_pid"; then
      return 1
    fi
  done < <(find_pids_for_port "$port")

  return 0
}

gracefully_stop_port_processes() {
  local label="$1"
  local port="$2"
  local process_regex="$3"
  local grace_seconds="${4:-3}"
  local pid
  local matched=false

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue

    if pid_matches_regex "$pid" "$process_regex"; then
      echo "[${label}] stopping existing pid=${pid} on port ${port}"
      kill -TERM "$pid" 2>/dev/null || true
      matched=true
    else
      local desc
      desc="$(ps -p "$pid" -o args= 2>/dev/null || true)"
      echo "[${label}] leaving unrelated listener on port ${port}: ${desc:-unknown}"
    fi
  done < <(find_pids_for_port "$port")

  if [[ "$matched" == true ]]; then
    echo "[${label}] waiting ${grace_seconds}s for graceful shutdown"
    if ! wait_for_matching_port_processes_to_exit "$port" "$process_regex" "$grace_seconds"; then
      echo "[${label}] existing matching process is still listening on port ${port}" >&2
      lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
      return 1
    fi
  fi

  return 0
}

stop_docker_containers_by_port_gracefully() {
  local label="$1"
  local port="$2"

  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi

  local ids id
  ids="$(docker ps --filter "publish=${port}" --format '{{.ID}}' 2>/dev/null || true)"
  [[ -z "$ids" ]] && return 0

  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    echo "[${label}] stopping docker container ${id} publishing port ${port}"
    docker stop "$id" >/dev/null 2>&1 || true
  done <<< "$ids"
}

ensure_port_is_free() {
  local label="$1"
  local port="$2"
  local remaining

  remaining="$(find_pids_for_port "$port" || true)"
  if [[ -n "$remaining" ]]; then
    echo "[${label}] port ${port} is still busy" >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    return 1
  fi

  return 0
}