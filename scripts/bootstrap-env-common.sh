#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

ENV_FILE_PLACEHOLDER=${ENV_FILE_PLACEHOLDER:-yourname.env}
ENV_FILE=${ENV_FILE:-$ENV_FILE_PLACEHOLDER}
MCP_RUNTIME_ENV=${MCP_RUNTIME_ENV:-deploy/mcp.env}

if [ "$ENV_FILE" = "$ENV_FILE_PLACEHOLDER" ]; then
  echo "Set ENV_FILE, for example: cp .env.example yourname.env && ENV_FILE=yourname.env $0" >&2
  exit 1
fi

ensure_env_file() {
  mkdir -p "$(dirname "$ENV_FILE")"
  touch "$ENV_FILE"
}

read_env_var() {
  key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1
}

require_env_setting() {
  key="$1"
  current_value=$(eval "printf '%s' \"\${$key-}\"")

  if [ -n "$current_value" ]; then
    printf '%s\n' "$current_value"
    return
  fi

  value=$(read_env_var "$key")

  if [ -z "$value" ]; then
    echo "Missing $key in $ENV_FILE." >&2
    exit 1
  fi

  printf '%s\n' "$value"
}

compose_var() {
  key="$1"
  fallback="${2-}"
  current_value=$(eval "printf '%s' \"\${$key-}\"")

  if [ -n "$current_value" ]; then
    printf '%s\n' "$current_value"
    return
  fi

  value=$(read_env_var "$key")
  if [ -n "$value" ]; then
    printf '%s\n' "$value"
    return
  fi

  if [ -f ".env.example" ]; then
    value=$(sed -n "s/^${key}=//p" .env.example | tail -n 1)
    if [ -n "$value" ]; then
      printf '%s\n' "$value"
      return
    fi
  fi

  printf '%s\n' "$fallback"
}

compose_cmd() {
  ENV_FILE="$ENV_FILE" \
    MCP_RUNTIME_ENV="$MCP_RUNTIME_ENV" \
    ./scripts/compose-env.sh \
    docker compose --env-file "$ENV_FILE" "$@"
}

update_env_var() {
  key="$1"
  value="$2"
  tmp_file=$(mktemp)

  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "$ENV_FILE" > "$tmp_file"

  mv "$tmp_file" "$ENV_FILE"
}
