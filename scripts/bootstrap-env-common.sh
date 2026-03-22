#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

ENV_FILE_PLACEHOLDER=${ENV_FILE_PLACEHOLDER:-yourname.env}
ENV_FILE=${ENV_FILE:-$ENV_FILE_PLACEHOLDER}

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

resolve_env_setting() {
  key="$1"
  default_value="$2"
  current_value=$(eval "printf '%s' \"\${$key-}\"")

  if [ -n "$current_value" ]; then
    printf '%s\n' "$current_value"
    return
  fi

  file_value=$(read_env_var "$key")
  if [ -n "$file_value" ]; then
    printf '%s\n' "$file_value"
    return
  fi

  printf '%s\n' "$default_value"
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
