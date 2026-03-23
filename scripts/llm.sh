#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

ENV_FILE_PLACEHOLDER=${ENV_FILE_PLACEHOLDER:-yourname.env}
ENV_FILE=${ENV_FILE:-$ENV_FILE_PLACEHOLDER}

UV=${UV:-uv}
VENV_DIR=${VENV_DIR:-.venv}
VENV_PYTHON=${VENV_PYTHON:-$VENV_DIR/bin/python}
VLLM_HOST=${VLLM_HOST:-0.0.0.0}
VLLM_PORT=${VLLM_PORT:-8000}
VLLM_MLX_MODEL=${VLLM_MLX_MODEL:-mlx-community/Qwen3-1.7B-4bit}
VLLM_API_BASE=${VLLM_API_BASE:-http://127.0.0.1:$VLLM_PORT}
VLLM_RUNTIME_DIR=${VLLM_RUNTIME_DIR:-var/llm}
VLLM_PID_FILE=${VLLM_PID_FILE:-$VLLM_RUNTIME_DIR/vllm-mlx.pid}
VLLM_LOG_FILE=${VLLM_LOG_FILE:-$VLLM_RUNTIME_DIR/vllm-mlx.log}

read_env_var() {
  key="$1"
  if [ -f "$ENV_FILE" ]; then
    sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1
  fi
}

resolve_llm_api_key() {
  if [ -n "${LLM_API_KEY:-}" ]; then
    printf '%s\n' "$LLM_API_KEY"
    return
  fi

  if [ "$ENV_FILE" != "$ENV_FILE_PLACEHOLDER" ] && [ -f "$ENV_FILE" ]; then
    read_env_var "LLM_API_KEY"
  fi
}

read_pid() {
  if [ -f "$VLLM_PID_FILE" ]; then
    cat "$VLLM_PID_FILE"
  fi
}

pid_is_running() {
  pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

ensure_runtime_dir() {
  mkdir -p "$VLLM_RUNTIME_DIR"
}

build_serve_args() {
  api_key="$1"
  set -- "$UV" run --python "$VENV_PYTHON" vllm-mlx serve \
    --host "$VLLM_HOST" \
    --port "$VLLM_PORT"

  if [ -n "$api_key" ]; then
    set -- "$@" --api-key "$api_key"
  fi

  set -- "$@" "$VLLM_MLX_MODEL"
  printf '%s\n' "$@"
}

curl_with_auth() {
  api_key="$1"
  shift

  if [ -n "$api_key" ]; then
    curl -fsS -H "Authorization: Bearer $api_key" "$@"
  else
    curl -fsS "$@"
  fi
}

command="${1:-}"
if [ -z "$command" ]; then
  echo "Usage: ./scripts/llm.sh {serve|serve-bg|smoke|status|stop|logs}" >&2
  exit 1
fi
shift || true

resolved_llm_api_key=$(resolve_llm_api_key)

case "$command" in
  serve)
    exec $UV run --python "$VENV_PYTHON" vllm-mlx serve \
      --host "$VLLM_HOST" \
      --port "$VLLM_PORT" \
      ${resolved_llm_api_key:+--api-key "$resolved_llm_api_key"} \
      "$VLLM_MLX_MODEL"
    ;;
  serve-bg)
    ensure_runtime_dir
    llm_pid=$(read_pid)
    if pid_is_running "$llm_pid"; then
      echo "vllm-mlx is already running (PID $llm_pid)"
      exit 1
    fi

    if [ -n "$llm_pid" ]; then
      printf 'Removing stale PID file %s\n' "$VLLM_PID_FILE"
      rm -f "$VLLM_PID_FILE"
    fi

    nohup $UV run --python "$VENV_PYTHON" vllm-mlx serve \
      --host "$VLLM_HOST" \
      --port "$VLLM_PORT" \
      ${resolved_llm_api_key:+--api-key "$resolved_llm_api_key"} \
      "$VLLM_MLX_MODEL" \
      >>"$VLLM_LOG_FILE" 2>&1 &
    echo $! >"$VLLM_PID_FILE"
    printf 'Started vllm-mlx in background (PID %s)\n' "$(cat "$VLLM_PID_FILE")"
    printf 'Model: %s\n' "$VLLM_MLX_MODEL"
    printf 'Log:   %s\n' "$VLLM_LOG_FILE"
    ;;
  smoke)
    curl_with_auth "$resolved_llm_api_key" "$VLLM_API_BASE/v1/models"
    ;;
  status)
    llm_pid=$(read_pid)
    if [ -n "$llm_pid" ]; then
      if pid_is_running "$llm_pid"; then
        printf 'PID:    %s (running)\n' "$llm_pid"
      else
        printf 'PID:    %s (stale)\n' "$llm_pid"
      fi
    else
      printf 'PID:    not found\n'
    fi
    printf 'Health: %s/health\n' "$VLLM_API_BASE"
    curl_with_auth "$resolved_llm_api_key" "$VLLM_API_BASE/health" && echo || {
      echo "Server is not reachable."
      exit 1
    }
    ;;
  stop)
    llm_pid=$(read_pid)
    if [ -z "$llm_pid" ]; then
      echo "vllm-mlx is not running."
      exit 0
    fi

    if pid_is_running "$llm_pid"; then
      kill "$llm_pid"
      printf 'Stopped vllm-mlx (PID %s)\n' "$llm_pid"
    else
      printf 'Removing stale PID file %s\n' "$VLLM_PID_FILE"
    fi
    rm -f "$VLLM_PID_FILE"
    ;;
  logs)
    ensure_runtime_dir
    touch "$VLLM_LOG_FILE"
    exec tail -f "$VLLM_LOG_FILE"
    ;;
  *)
    printf 'Unknown command: %s\n' "$command" >&2
    exit 1
    ;;
esac
