#!/bin/sh
set -eu

. "$(dirname "$0")/bootstrap-env-common.sh"

ensure_env_file

BOOTSTRAP_CAMPFIRE_ADMIN_NAME=$(require_env_setting "BOOTSTRAP_CAMPFIRE_ADMIN_NAME")
BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL=$(require_env_setting "BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL")
BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD=$(require_env_setting "BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD")
BOOTSTRAP_CAMPFIRE_ROOM_NAME=$(require_env_setting "BOOTSTRAP_CAMPFIRE_ROOM_NAME")
BOOTSTRAP_CAMPFIRE_BOT_NAME=$(require_env_setting "BOOTSTRAP_CAMPFIRE_BOT_NAME")

bootstrap_output=$(
  compose_cmd exec -T \
    -e BOOTSTRAP_CAMPFIRE_ADMIN_NAME="$BOOTSTRAP_CAMPFIRE_ADMIN_NAME" \
    -e BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL="$BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL" \
    -e BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD="$BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD" \
    -e BOOTSTRAP_CAMPFIRE_ROOM_NAME="$BOOTSTRAP_CAMPFIRE_ROOM_NAME" \
    -e BOOTSTRAP_CAMPFIRE_BOT_NAME="$BOOTSTRAP_CAMPFIRE_BOT_NAME" \
    campfire bin/rails runner - <<'RUBY'
admin_email = ENV.fetch("BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL")
admin_name = ENV.fetch("BOOTSTRAP_CAMPFIRE_ADMIN_NAME")
admin_password = ENV.fetch("BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD")
room_name = ENV.fetch("BOOTSTRAP_CAMPFIRE_ROOM_NAME")
bot_name = ENV.fetch("BOOTSTRAP_CAMPFIRE_BOT_NAME")

admin = User.find_by(email_address: admin_email)
if admin.nil?
  admin =
    if User.none?
      FirstRun.create!(
        name: admin_name,
        email_address: admin_email,
        password: admin_password
      )
    else
      User.create!(
        name: admin_name,
        email_address: admin_email,
        password: admin_password,
        role: :administrator
      )
    end
else
  admin.update!(
    name: admin_name,
    password: admin_password,
    role: :administrator
  )
end

User.active.without_bots.where.not(id: admin.id).find_each do |user|
  user.deactivate
end

Current.user = admin

room = Room.opens.find_by(name: room_name)
room ||= Rooms::Open.create_for({ name: room_name }, users: admin)

bot = User.active_bots.find_by(name: bot_name)
bot ||= User.create_bot!(name: bot_name)

puts "CAMPFIRE_ROOM_ID=#{room.id}"
puts "CAMPFIRE_BOT_KEY=#{bot.bot_key}"
RUBY
)

room_id=$(printf '%s\n' "$bootstrap_output" | sed -n 's/^CAMPFIRE_ROOM_ID=//p' | tail -n 1)
bot_key=$(printf '%s\n' "$bootstrap_output" | sed -n 's/^CAMPFIRE_BOT_KEY=//p' | tail -n 1)

if [ -z "$room_id" ] || [ -z "$bot_key" ]; then
  printf '%s\n' "$bootstrap_output"
  echo "Failed to bootstrap Campfire room/bot." >&2
  exit 1
fi

update_env_var "CAMPFIRE_ROOM_ID" "$room_id"
update_env_var "CAMPFIRE_BOT_KEY" "$bot_key"
update_env_var "BOOTSTRAP_CAMPFIRE_ADMIN_NAME" "$BOOTSTRAP_CAMPFIRE_ADMIN_NAME"
update_env_var "BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL" "$BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL"
update_env_var "BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD" "$BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD"
update_env_var "BOOTSTRAP_CAMPFIRE_ROOM_NAME" "$BOOTSTRAP_CAMPFIRE_ROOM_NAME"
update_env_var "BOOTSTRAP_CAMPFIRE_BOT_NAME" "$BOOTSTRAP_CAMPFIRE_BOT_NAME"

printf 'Updated %s\n' "$ENV_FILE"
printf 'BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL=%s\n' "$BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL"
printf 'CAMPFIRE_ROOM_ID=%s\n' "$room_id"
printf 'CAMPFIRE_BOT_KEY=<redacted>\n'
