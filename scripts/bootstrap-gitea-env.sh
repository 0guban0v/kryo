#!/bin/sh
set -eu

. "$(dirname "$0")/bootstrap-env-common.sh"

ensure_env_file

BOOTSTRAP_GITEA_ROOT_URL=$(require_env_setting "BOOTSTRAP_GITEA_ROOT_URL")
BOOTSTRAP_GITEA_ADMIN_NAME=$(require_env_setting "BOOTSTRAP_GITEA_ADMIN_NAME")
BOOTSTRAP_GITEA_ADMIN_USERNAME=$(require_env_setting "BOOTSTRAP_GITEA_ADMIN_USERNAME")
BOOTSTRAP_GITEA_ADMIN_EMAIL=$(require_env_setting "BOOTSTRAP_GITEA_ADMIN_EMAIL")
BOOTSTRAP_GITEA_ADMIN_PASSWORD=$(require_env_setting "BOOTSTRAP_GITEA_ADMIN_PASSWORD")
BOOTSTRAP_GITEA_SERVICE_NAME=$(require_env_setting "BOOTSTRAP_GITEA_SERVICE_NAME")
BOOTSTRAP_GITEA_SERVICE_USERNAME=$(require_env_setting "BOOTSTRAP_GITEA_SERVICE_USERNAME")
BOOTSTRAP_GITEA_SERVICE_EMAIL=$(require_env_setting "BOOTSTRAP_GITEA_SERVICE_EMAIL")
BOOTSTRAP_GITEA_SERVICE_PASSWORD=$(require_env_setting "BOOTSTRAP_GITEA_SERVICE_PASSWORD")
BOOTSTRAP_GITEA_REPO_NAME=$(require_env_setting "BOOTSTRAP_GITEA_REPO_NAME")
BOOTSTRAP_GITEA_TOKEN_NAME=$(require_env_setting "BOOTSTRAP_GITEA_TOKEN_NAME")

current_api_token=$(read_env_var "GIT_FORGE_TOKEN")

run_gitea_bootstrap() {
  existing_token="$1"
  force_new_token="${2:-0}"

  compose_cmd exec -T \
    -e BOOTSTRAP_GITEA_ADMIN_NAME="$BOOTSTRAP_GITEA_ADMIN_NAME" \
    -e BOOTSTRAP_GITEA_ADMIN_USERNAME="$BOOTSTRAP_GITEA_ADMIN_USERNAME" \
    -e BOOTSTRAP_GITEA_ADMIN_EMAIL="$BOOTSTRAP_GITEA_ADMIN_EMAIL" \
    -e BOOTSTRAP_GITEA_ADMIN_PASSWORD="$BOOTSTRAP_GITEA_ADMIN_PASSWORD" \
    -e BOOTSTRAP_GITEA_SERVICE_NAME="$BOOTSTRAP_GITEA_SERVICE_NAME" \
    -e BOOTSTRAP_GITEA_SERVICE_USERNAME="$BOOTSTRAP_GITEA_SERVICE_USERNAME" \
    -e BOOTSTRAP_GITEA_SERVICE_EMAIL="$BOOTSTRAP_GITEA_SERVICE_EMAIL" \
    -e BOOTSTRAP_GITEA_SERVICE_PASSWORD="$BOOTSTRAP_GITEA_SERVICE_PASSWORD" \
    -e BOOTSTRAP_GITEA_TOKEN_NAME="$BOOTSTRAP_GITEA_TOKEN_NAME" \
    -e GITEA_EXISTING_API_TOKEN="$existing_token" \
    -e GITEA_FORCE_NEW_API_TOKEN="$force_new_token" \
    gitea sh -eu -c '
      has_user() {
        username="$1"
        gitea admin user list | awk "NR > 1 { print \$2 }" | grep -Fx "$username" >/dev/null 2>&1
      }

      ensure_user() {
        username="$1"
        password="$2"
        email="$3"
        full_name="$4"
        admin_flag="${5-}"

        if has_user "$username"; then
          gitea admin user change-password \
            --username "$username" \
            --password "$password" \
            --must-change-password=false >/dev/null
          return
        fi

        gitea admin user create \
          --username "$username" \
          --password "$password" \
          --email "$email" \
          --fullname "$full_name" \
          --must-change-password=false \
          $admin_flag >/dev/null
      }

      generate_token() {
        token_name="$BOOTSTRAP_GITEA_TOKEN_NAME"
        if ! token="$(gitea admin user generate-access-token \
          --username "$BOOTSTRAP_GITEA_SERVICE_USERNAME" \
          --token-name "$token_name" \
          --scopes write:repository,write:user \
          --raw 2>/dev/null)"; then
          token_name="${BOOTSTRAP_GITEA_TOKEN_NAME}-$(date +%s)"
          token="$(gitea admin user generate-access-token \
            --username "$BOOTSTRAP_GITEA_SERVICE_USERNAME" \
            --token-name "$token_name" \
            --scopes write:repository,write:user \
            --raw)"
        fi

        printf "GIT_FORGE_TOKEN=%s\n" "$token"
      }

      ensure_user \
        "$BOOTSTRAP_GITEA_ADMIN_USERNAME" \
        "$BOOTSTRAP_GITEA_ADMIN_PASSWORD" \
        "$BOOTSTRAP_GITEA_ADMIN_EMAIL" \
        "$BOOTSTRAP_GITEA_ADMIN_NAME" \
        "--admin"

      ensure_user \
        "$BOOTSTRAP_GITEA_SERVICE_USERNAME" \
        "$BOOTSTRAP_GITEA_SERVICE_PASSWORD" \
        "$BOOTSTRAP_GITEA_SERVICE_EMAIL" \
        "$BOOTSTRAP_GITEA_SERVICE_NAME"

      if [ "$GITEA_FORCE_NEW_API_TOKEN" = "1" ] || [ -z "$GITEA_EXISTING_API_TOKEN" ]; then
        generate_token
      fi
    '
}

wait_for_gitea() {
  attempts=0
  max_attempts=30

  until compose_cmd exec -T gitea sh -c \
    'curl -fsS http://127.0.0.1:3000/api/healthz >/dev/null'; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "$max_attempts" ]; then
      echo "Timed out waiting for Gitea to report healthy." >&2
      exit 1
    fi

    sleep 2
  done
}

wait_for_gitea

bootstrap_output=$(run_gitea_bootstrap "${current_api_token:-}" 0)

api_token=${current_api_token:-$(printf '%s\n' "$bootstrap_output" | sed -n 's/^GIT_FORGE_TOKEN=//p' | tail -n 1)}
repo_owner="$BOOTSTRAP_GITEA_SERVICE_USERNAME"
repo_full_name="${repo_owner}/${BOOTSTRAP_GITEA_REPO_NAME}"

if [ -z "$api_token" ]; then
  printf '%s\n' "$bootstrap_output"
  echo "Failed to bootstrap Gitea service token." >&2
  exit 1
fi

repo_status=$(
  compose_cmd exec -T \
    -e GITEA_API_TOKEN="$api_token" \
    -e GITEA_REPO_FULL_NAME="$repo_full_name" \
    gitea sh -c \
    'curl -sS -o /dev/null -w "%{http_code}" \
      -H "Authorization: token $GITEA_API_TOKEN" \
      "http://127.0.0.1:3000/api/v1/repos/$GITEA_REPO_FULL_NAME"'
)

if [ "$repo_status" = "401" ]; then
  bootstrap_output=$(run_gitea_bootstrap "" 1)
  api_token=$(printf '%s\n' "$bootstrap_output" | sed -n 's/^GIT_FORGE_TOKEN=//p' | tail -n 1)

  if [ -z "$api_token" ]; then
    printf '%s\n' "$bootstrap_output"
    echo "Failed to rotate Gitea service token after HTTP 401." >&2
    exit 1
  fi

  repo_status=$(
    compose_cmd exec -T \
      -e GITEA_API_TOKEN="$api_token" \
      -e GITEA_REPO_FULL_NAME="$repo_full_name" \
      gitea sh -c \
      'curl -sS -o /dev/null -w "%{http_code}" \
        -H "Authorization: token $GITEA_API_TOKEN" \
        "http://127.0.0.1:3000/api/v1/repos/$GITEA_REPO_FULL_NAME"'
  )
fi

case "$repo_status" in
  200)
    ;;
  404)
    compose_cmd exec -T \
      -e GITEA_API_TOKEN="$api_token" \
      -e GITEA_REPO_NAME="$BOOTSTRAP_GITEA_REPO_NAME" \
      gitea sh -c \
      'curl -fsS \
        -H "Authorization: token $GITEA_API_TOKEN" \
        -H "Content-Type: application/json" \
        -X POST \
        -d "{\"name\":\"$GITEA_REPO_NAME\",\"default_branch\":\"main\",\"private\":false,\"auto_init\":true,\"description\":\"Bootstrap repo for the Kryo demo flow.\"}" \
        "http://127.0.0.1:3000/api/v1/user/repos" >/dev/null'
    ;;
  *)
    echo "Failed to inspect Gitea repo $repo_full_name (HTTP $repo_status)." >&2
    exit 1
    ;;
esac

update_env_var "BOOTSTRAP_GITEA_ROOT_URL" "$BOOTSTRAP_GITEA_ROOT_URL"
update_env_var "BOOTSTRAP_GITEA_ADMIN_NAME" "$BOOTSTRAP_GITEA_ADMIN_NAME"
update_env_var "BOOTSTRAP_GITEA_ADMIN_USERNAME" "$BOOTSTRAP_GITEA_ADMIN_USERNAME"
update_env_var "BOOTSTRAP_GITEA_ADMIN_EMAIL" "$BOOTSTRAP_GITEA_ADMIN_EMAIL"
update_env_var "BOOTSTRAP_GITEA_ADMIN_PASSWORD" "$BOOTSTRAP_GITEA_ADMIN_PASSWORD"
update_env_var "BOOTSTRAP_GITEA_SERVICE_NAME" "$BOOTSTRAP_GITEA_SERVICE_NAME"
update_env_var "BOOTSTRAP_GITEA_SERVICE_USERNAME" "$BOOTSTRAP_GITEA_SERVICE_USERNAME"
update_env_var "BOOTSTRAP_GITEA_SERVICE_EMAIL" "$BOOTSTRAP_GITEA_SERVICE_EMAIL"
update_env_var "BOOTSTRAP_GITEA_SERVICE_PASSWORD" "$BOOTSTRAP_GITEA_SERVICE_PASSWORD"
update_env_var "BOOTSTRAP_GITEA_REPO_NAME" "$BOOTSTRAP_GITEA_REPO_NAME"
update_env_var "BOOTSTRAP_GITEA_TOKEN_NAME" "$BOOTSTRAP_GITEA_TOKEN_NAME"
update_env_var "GIT_FORGE_PROVIDER" "gitea"
update_env_var "GIT_FORGE_TOKEN" "$api_token"
update_env_var "GIT_FORGE_REPO" "$repo_full_name"
update_env_var "GIT_FORGE_ALLOW_REPO_OVERRIDE" "false"

printf 'Updated %s\n' "$ENV_FILE"
printf 'BOOTSTRAP_GITEA_ADMIN_USERNAME=%s\n' "$BOOTSTRAP_GITEA_ADMIN_USERNAME"
printf 'BOOTSTRAP_GITEA_SERVICE_USERNAME=%s\n' "$BOOTSTRAP_GITEA_SERVICE_USERNAME"
printf 'GIT_FORGE_REPO=%s\n' "$repo_full_name"
printf 'GIT_FORGE_TOKEN=<redacted>\n'
