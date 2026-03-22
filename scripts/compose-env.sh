#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

ENV_FILE_PLACEHOLDER=${ENV_FILE_PLACEHOLDER:-yourname.env}
ENV_FILE=${ENV_FILE:-$ENV_FILE_PLACEHOLDER}
MCP_RUNTIME_ENV=${MCP_RUNTIME_ENV:-deploy/mcp.env}

read_env_var() {
  key="$1"
  if [ -f "$ENV_FILE" ]; then
    sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1
  fi
}

read_template_var() {
  key="$1"
  if [ -f ".env.example" ]; then
    sed -n "s/^${key}=//p" ".env.example" | tail -n 1
  fi
}

lookup_var() {
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

  value=$(read_template_var "$key")
  if [ -n "$value" ]; then
    printf '%s\n' "$value"
    return
  fi

  printf '%s\n' "$fallback"
}

KRYO_VERSION=$(lookup_var "KRYO_VERSION" "$(./scripts/git-version.sh)")
KRYO_IMAGE_TAG=$(lookup_var "KRYO_IMAGE_TAG" "$KRYO_VERSION")
ONCE_CAMPFIRE_VERSION=$(lookup_var "ONCE_CAMPFIRE_VERSION")
CAMPFIRE_IMAGE_TAG=$(lookup_var "CAMPFIRE_IMAGE_TAG")
BOOTSTRAP_GITEA_ROOT_URL=$(lookup_var "BOOTSTRAP_GITEA_ROOT_URL")

export ENV_FILE
export MCP_RUNTIME_ENV
export KRYO_VERSION
export KRYO_IMAGE_TAG
export ONCE_CAMPFIRE_VERSION
export CAMPFIRE_IMAGE_TAG
export BOOTSTRAP_GITEA_ROOT_URL

exec "$@"
