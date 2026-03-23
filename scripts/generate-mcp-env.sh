#!/bin/sh
set -eu

. "$(dirname "$0")/bootstrap-env-common.sh"

ensure_env_file

OUTPUT_FILE=${MCP_RUNTIME_ENV:-deploy/mcp.env}
mkdir -p "$(dirname "$OUTPUT_FILE")"

lookup_value() {
  key="$1"
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
}

write_key() {
  key="$1"
  value=$(lookup_value "$key")

  if [ -n "$value" ]; then
    printf '%s=%s\n' "$key" "$value" >> "$OUTPUT_FILE"
  fi
}

: > "$OUTPUT_FILE"

for key in \
  KRYO_VERSION \
  FIZZY_URL \
  FIZZY_API_TOKEN \
  FIZZY_ACCOUNT_ID \
  FIZZY_BOARD_ID \
  FIZZY_BOARD_SELECTION \
  CAMPFIRE_URL \
  CAMPFIRE_BOT_KEY \
  CAMPFIRE_ROOM_ID \
  CAMPFIRE_ROOM_SELECTION \
  CAMPFIRE_SESSION_COOKIE \
  CAMPFIRE_TRANSCRIPT_LIMIT \
  CAMPFIRE_RECENT_MESSAGES_LIMIT \
  GIT_FORGE_PROVIDER \
  GIT_FORGE_API_URL \
  GIT_FORGE_TOKEN \
  GIT_FORGE_REPO \
  GIT_FORGE_ALLOW_REPO_OVERRIDE \
  GIT_FORGE_DEFAULT_BRANCH \
  GIT_FORGE_MERGE_METHOD \
  GIT_FORGE_SUPPORTS_CHECK_RUNS \
  WORKFLOW_TODO_COLUMN \
  WORKFLOW_IN_PROGRESS_COLUMN \
  WORKFLOW_REVIEW_COLUMN \
  WORKFLOW_BLOCKED_COLUMN \
  WORKFLOW_DONE_LABEL \
  WORKFLOW_NOT_NOW_LABEL \
  WORKFLOW_TRIAGE_LABEL \
  CARD_DESCRIPTION_PREVIEW_LIMIT \
  BOARD_STATUS_VISIBLE_CARDS_LIMIT \
  TROUBLESHOOT_ERROR_LIMIT \
  MCP_TRANSPORT \
  MCP_HTTP_SESSION_MODE \
  MCP_HOST \
  MCP_ALLOWED_HOSTS \
  MCP_SESSION_IDLE_TTL_MS \
  MCP_MAX_SESSIONS \
  MCP_PORT \
  MCP_PATH \
  BOT_WEBHOOK_PATH \
  BOT_WEBHOOK_AUTH \
  BOT_WEBHOOK_SHARED_SECRET \
  BOT_WEBHOOK_SHARED_SECRET_HEADER \
  BOT_MODE \
  BOT_MAX_AGENT_STEPS \
  LLM_BASE_URL \
  LLM_MODEL \
  LLM_API_KEY \
  LLM_CHAT_COMPLETIONS_PATH \
  LLM_TIMEOUT_MS \
  BOT_REPO_PATH \
  BOT_REPO_REMOTE \
  REQUEST_TIMEOUT_MS \
  LOG_LEVEL
do
  write_key "$key"
done

printf 'Wrote %s\n' "$OUTPUT_FILE"
