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
VLLM_MLX_MODEL=${VLLM_MLX_MODEL:-Qwen/Qwen3-14B-MLX-4bit}
VLLM_API_BASE=${VLLM_API_BASE:-http://127.0.0.1:$VLLM_PORT}
VLLM_RUNTIME_DIR=${VLLM_RUNTIME_DIR:-var/llm}
VLLM_PID_FILE=${VLLM_PID_FILE:-$VLLM_RUNTIME_DIR/vllm-mlx.pid}
VLLM_LOG_FILE=${VLLM_LOG_FILE:-$VLLM_RUNTIME_DIR/vllm-mlx.log}
VLLM_STATUS_URL=${VLLM_STATUS_URL:-$VLLM_API_BASE/v1/status}

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

run_server() {
  api_key="$1"
  set -- "$UV" run --python "$VENV_PYTHON" vllm-mlx serve \
    --host "$VLLM_HOST" \
    --port "$VLLM_PORT"

  if [ -n "$api_key" ]; then
    set -- "$@" --api-key "$api_key"
  fi

  set -- "$@" "$VLLM_MLX_MODEL"
  exec "$@"
}

curl_with_auth() {
  api_key="$1"
  shift

  set -- curl -fsS "$@"
  if [ -n "$api_key" ]; then
    set -- curl -fsS -H "Authorization: Bearer $api_key" "$@"
  fi

  "$@"
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
    run_server "$resolved_llm_api_key"
    ;;
  serve-bg)
    ensure_runtime_dir
    llm_pid=$(read_pid)
    if pid_is_running "$llm_pid"; then
      echo "vllm-mlx is already running with PID $llm_pid"
      exit 1
    fi

    if [ -n "$llm_pid" ]; then
      echo "Removing stale PID file $VLLM_PID_FILE"
      rm -f "$VLLM_PID_FILE"
    fi

    set -- "$UV" run --python "$VENV_PYTHON" vllm-mlx serve \
      --host "$VLLM_HOST" \
      --port "$VLLM_PORT"
    if [ -n "$resolved_llm_api_key" ]; then
      set -- "$@" --api-key "$resolved_llm_api_key"
    fi
    set -- "$@" "$VLLM_MLX_MODEL"
    nohup "$@" >>"$VLLM_LOG_FILE" 2>&1 &
    echo $! >"$VLLM_PID_FILE"
    echo "Started vllm-mlx in background."
    echo "PID: $(cat "$VLLM_PID_FILE")"
    echo "Log: $VLLM_LOG_FILE"
    ;;
  smoke)
    curl_with_auth "$resolved_llm_api_key" "$VLLM_API_BASE/v1/models"
    ;;
  status)
    llm_pid=$(read_pid)
    if [ -n "$llm_pid" ]; then
      if pid_is_running "$llm_pid"; then
        echo "PID: $llm_pid (running)"
      else
        echo "PID: $llm_pid (stale)"
      fi
    else
      echo "PID: not found"
    fi
    echo "Status URL: $VLLM_STATUS_URL"
    if curl_with_auth "$resolved_llm_api_key" "$VLLM_STATUS_URL"; then
      exit 0
    fi
    echo "Server is not reachable."
    exit 1
    ;;
  stop)
    llm_pid=$(read_pid)
    if [ -z "$llm_pid" ]; then
      echo "vllm-mlx is not running."
      exit 0
    fi

    if pid_is_running "$llm_pid"; then
      kill "$llm_pid"
      echo "Stopped vllm-mlx PID $llm_pid"
    else
      echo "Removing stale PID file $VLLM_PID_FILE"
    fi
    rm -f "$VLLM_PID_FILE"
    ;;
  logs)
    ensure_runtime_dir
    touch "$VLLM_LOG_FILE"
    exec tail -f "$VLLM_LOG_FILE"
    ;;
  *)
    echo "Unknown command: $command" >&2
    exit 1
    ;;
esac
