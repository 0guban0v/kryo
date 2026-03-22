#!/bin/sh
set -eu

. "$(dirname "$0")/bootstrap-env-common.sh"

ensure_env_file

BOOTSTRAP_FIZZY_ACCOUNT_NAME=$(require_env_setting "BOOTSTRAP_FIZZY_ACCOUNT_NAME")
BOOTSTRAP_FIZZY_OWNER_NAME=$(require_env_setting "BOOTSTRAP_FIZZY_OWNER_NAME")
BOOTSTRAP_FIZZY_OWNER_EMAIL=$(require_env_setting "BOOTSTRAP_FIZZY_OWNER_EMAIL")
BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION=$(require_env_setting "BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION")
BOOTSTRAP_FIZZY_TOKEN_PERMISSION=$(require_env_setting "BOOTSTRAP_FIZZY_TOKEN_PERMISSION")

current_api_token=$(read_env_var "FIZZY_API_TOKEN")

bootstrap_output=$(
  compose_cmd exec -T \
    -e BOOTSTRAP_FIZZY_ACCOUNT_NAME="$BOOTSTRAP_FIZZY_ACCOUNT_NAME" \
    -e BOOTSTRAP_FIZZY_OWNER_NAME="$BOOTSTRAP_FIZZY_OWNER_NAME" \
    -e BOOTSTRAP_FIZZY_OWNER_EMAIL="$BOOTSTRAP_FIZZY_OWNER_EMAIL" \
    -e BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION="$BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION" \
    -e BOOTSTRAP_FIZZY_TOKEN_PERMISSION="$BOOTSTRAP_FIZZY_TOKEN_PERMISSION" \
    -e FIZZY_EXISTING_API_TOKEN="$current_api_token" \
    fizzy bin/rails runner - <<'RUBY'
identity = Identity.find_or_create_by!(email_address: ENV.fetch("BOOTSTRAP_FIZZY_OWNER_EMAIL"))

account = identity.users.first&.account ||
  Account.find_by(name: ENV.fetch("BOOTSTRAP_FIZZY_ACCOUNT_NAME")) ||
  Account.create_with_owner(
    account: {
      name: ENV.fetch("BOOTSTRAP_FIZZY_ACCOUNT_NAME")
    },
    owner: {
      name: ENV.fetch("BOOTSTRAP_FIZZY_OWNER_NAME"),
      identity: identity
    }
  )

user = identity.users.find_or_initialize_by(account: account)
user.name = ENV.fetch("BOOTSTRAP_FIZZY_OWNER_NAME")
user.role = :owner
user.verified_at ||= Time.current
user.save! if user.changed?

token =
  if ENV["FIZZY_EXISTING_API_TOKEN"].to_s.empty?
    identity.access_tokens.create!(
      description: ENV.fetch("BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION"),
      permission: ENV.fetch("BOOTSTRAP_FIZZY_TOKEN_PERMISSION")
    ).token
  end

puts "FIZZY_ACCOUNT_ID=#{account.external_account_id}"
puts "FIZZY_API_TOKEN=#{token}" if token
RUBY
)

account_id=$(printf '%s\n' "$bootstrap_output" | sed -n 's/^FIZZY_ACCOUNT_ID=//p' | tail -n 1)
api_token=${current_api_token:-$(printf '%s\n' "$bootstrap_output" | sed -n 's/^FIZZY_API_TOKEN=//p' | tail -n 1)}

if [ -z "$account_id" ] || [ -z "$api_token" ]; then
  printf '%s\n' "$bootstrap_output"
  echo "Failed to bootstrap Fizzy account/token." >&2
  exit 1
fi

update_env_var "BOOTSTRAP_FIZZY_ACCOUNT_NAME" "$BOOTSTRAP_FIZZY_ACCOUNT_NAME"
update_env_var "BOOTSTRAP_FIZZY_OWNER_NAME" "$BOOTSTRAP_FIZZY_OWNER_NAME"
update_env_var "BOOTSTRAP_FIZZY_OWNER_EMAIL" "$BOOTSTRAP_FIZZY_OWNER_EMAIL"
update_env_var "BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION" "$BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION"
update_env_var "BOOTSTRAP_FIZZY_TOKEN_PERMISSION" "$BOOTSTRAP_FIZZY_TOKEN_PERMISSION"
update_env_var "FIZZY_ACCOUNT_ID" "$account_id"
update_env_var "FIZZY_API_TOKEN" "$api_token"

printf 'Updated %s\n' "$ENV_FILE"
printf 'BOOTSTRAP_FIZZY_OWNER_EMAIL=%s\n' "$BOOTSTRAP_FIZZY_OWNER_EMAIL"
printf 'FIZZY_ACCOUNT_ID=%s\n' "$account_id"
printf 'FIZZY_API_TOKEN=<redacted>\n'
