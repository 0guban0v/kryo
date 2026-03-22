devbox-up: guard-env-file
	$(COMPOSE) $(DEVBOX_PROFILE) up -d $(DEVBOX_SERVICE)

container-install: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL)'

container-build: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run build'

container-test-offline: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run test:offline'

container-test-online: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run test:online'

container-lint: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run lint'

container-format: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run format'

container-deadcode: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run deadcode'

container-quality: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run quality'

install: container-install

build: container-build

test-offline: container-test-offline

test-online: container-test-online

lint: container-lint

format: container-format

deadcode: container-deadcode

quality: container-quality

bootstrap: guard-env-file
	$(COMPOSE) up -d fizzy campfire gitea
	ENV_FILE='$(ENV_FILE)' \
	BOOTSTRAP_FIZZY_ACCOUNT_NAME='$(BOOTSTRAP_FIZZY_ACCOUNT_NAME)' \
	BOOTSTRAP_FIZZY_OWNER_NAME='$(BOOTSTRAP_FIZZY_OWNER_NAME)' \
	BOOTSTRAP_FIZZY_OWNER_EMAIL='$(BOOTSTRAP_FIZZY_OWNER_EMAIL)' \
	BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION='$(BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION)' \
	BOOTSTRAP_FIZZY_TOKEN_PERMISSION='$(BOOTSTRAP_FIZZY_TOKEN_PERMISSION)' \
	./scripts/bootstrap-fizzy-env.sh
	ENV_FILE='$(ENV_FILE)' \
	BOOTSTRAP_CAMPFIRE_ADMIN_NAME='$(BOOTSTRAP_CAMPFIRE_ADMIN_NAME)' \
	BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL='$(BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL)' \
	BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD='$(BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD)' \
	BOOTSTRAP_CAMPFIRE_ROOM_NAME='$(BOOTSTRAP_CAMPFIRE_ROOM_NAME)' \
	BOOTSTRAP_CAMPFIRE_BOT_NAME='$(BOOTSTRAP_CAMPFIRE_BOT_NAME)' \
	./scripts/bootstrap-campfire-env.sh
	ENV_FILE='$(ENV_FILE)' \
	BOOTSTRAP_GITEA_ROOT_URL='$(BOOTSTRAP_GITEA_ROOT_URL)' \
	BOOTSTRAP_GITEA_ADMIN_NAME='$(BOOTSTRAP_GITEA_ADMIN_NAME)' \
	BOOTSTRAP_GITEA_ADMIN_USERNAME='$(BOOTSTRAP_GITEA_ADMIN_USERNAME)' \
	BOOTSTRAP_GITEA_ADMIN_EMAIL='$(BOOTSTRAP_GITEA_ADMIN_EMAIL)' \
	BOOTSTRAP_GITEA_ADMIN_PASSWORD='$(BOOTSTRAP_GITEA_ADMIN_PASSWORD)' \
	BOOTSTRAP_GITEA_SERVICE_NAME='$(BOOTSTRAP_GITEA_SERVICE_NAME)' \
	BOOTSTRAP_GITEA_SERVICE_USERNAME='$(BOOTSTRAP_GITEA_SERVICE_USERNAME)' \
	BOOTSTRAP_GITEA_SERVICE_EMAIL='$(BOOTSTRAP_GITEA_SERVICE_EMAIL)' \
	BOOTSTRAP_GITEA_SERVICE_PASSWORD='$(BOOTSTRAP_GITEA_SERVICE_PASSWORD)' \
	BOOTSTRAP_GITEA_REPO_NAME='$(BOOTSTRAP_GITEA_REPO_NAME)' \
	BOOTSTRAP_GITEA_TOKEN_NAME='$(BOOTSTRAP_GITEA_TOKEN_NAME)' \
	./scripts/bootstrap-gitea-env.sh

bootstrap-fizzy: guard-env-file
	$(COMPOSE) up -d fizzy
	ENV_FILE='$(ENV_FILE)' \
	BOOTSTRAP_FIZZY_ACCOUNT_NAME='$(BOOTSTRAP_FIZZY_ACCOUNT_NAME)' \
	BOOTSTRAP_FIZZY_OWNER_NAME='$(BOOTSTRAP_FIZZY_OWNER_NAME)' \
	BOOTSTRAP_FIZZY_OWNER_EMAIL='$(BOOTSTRAP_FIZZY_OWNER_EMAIL)' \
	BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION='$(BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION)' \
	BOOTSTRAP_FIZZY_TOKEN_PERMISSION='$(BOOTSTRAP_FIZZY_TOKEN_PERMISSION)' \
	./scripts/bootstrap-fizzy-env.sh

bootstrap-campfire: guard-env-file
	$(COMPOSE) up -d campfire
	ENV_FILE='$(ENV_FILE)' \
	BOOTSTRAP_CAMPFIRE_ADMIN_NAME='$(BOOTSTRAP_CAMPFIRE_ADMIN_NAME)' \
	BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL='$(BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL)' \
	BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD='$(BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD)' \
	BOOTSTRAP_CAMPFIRE_ROOM_NAME='$(BOOTSTRAP_CAMPFIRE_ROOM_NAME)' \
	BOOTSTRAP_CAMPFIRE_BOT_NAME='$(BOOTSTRAP_CAMPFIRE_BOT_NAME)' \
	./scripts/bootstrap-campfire-env.sh

bootstrap-gitea: guard-env-file
	$(COMPOSE) up -d gitea
	ENV_FILE='$(ENV_FILE)' \
	BOOTSTRAP_GITEA_ROOT_URL='$(BOOTSTRAP_GITEA_ROOT_URL)' \
	BOOTSTRAP_GITEA_ADMIN_NAME='$(BOOTSTRAP_GITEA_ADMIN_NAME)' \
	BOOTSTRAP_GITEA_ADMIN_USERNAME='$(BOOTSTRAP_GITEA_ADMIN_USERNAME)' \
	BOOTSTRAP_GITEA_ADMIN_EMAIL='$(BOOTSTRAP_GITEA_ADMIN_EMAIL)' \
	BOOTSTRAP_GITEA_ADMIN_PASSWORD='$(BOOTSTRAP_GITEA_ADMIN_PASSWORD)' \
	BOOTSTRAP_GITEA_SERVICE_NAME='$(BOOTSTRAP_GITEA_SERVICE_NAME)' \
	BOOTSTRAP_GITEA_SERVICE_USERNAME='$(BOOTSTRAP_GITEA_SERVICE_USERNAME)' \
	BOOTSTRAP_GITEA_SERVICE_EMAIL='$(BOOTSTRAP_GITEA_SERVICE_EMAIL)' \
	BOOTSTRAP_GITEA_SERVICE_PASSWORD='$(BOOTSTRAP_GITEA_SERVICE_PASSWORD)' \
	BOOTSTRAP_GITEA_REPO_NAME='$(BOOTSTRAP_GITEA_REPO_NAME)' \
	BOOTSTRAP_GITEA_TOKEN_NAME='$(BOOTSTRAP_GITEA_TOKEN_NAME)' \
	./scripts/bootstrap-gitea-env.sh

fizzy-login-code: guard-env-file
	$(COMPOSE) up -d fizzy
	$(COMPOSE) exec -T \
		-e EMAIL='$(EMAIL)' \
		fizzy bin/rails runner 'identity = Identity.find_by(email_address: ENV.fetch("EMAIL")) or abort("Unknown Fizzy identity: #{ENV.fetch("EMAIL")}") ; magic_link = identity.send_magic_link ; puts "EMAIL=#{identity.email_address}" ; puts "MAGIC_LINK_CODE=#{magic_link.code}"'

deploy: bootstrap
	$(COMPOSE) up -d mcp

deploy-all: deploy
	$(COMPOSE) --profile observability up -d prometheus grafana blackbox-exporter loki promtail

up: guard-env-file
	$(COMPOSE) up --build

down: guard-env-file
	$(COMPOSE) down

restart: guard-env-file
	$(if $(strip $(SERVICE)),$(COMPOSE) restart $(SERVICE),$(COMPOSE) restart)

ps: guard-env-file
	$(COMPOSE) ps

logs: guard-env-file
	$(if $(strip $(SERVICE)),$(COMPOSE) logs -f $(SERVICE),$(COMPOSE) logs -f)

health: guard-env-file
	$(COMPOSE) ps

observability-up: guard-env-file
	$(COMPOSE) --profile observability up -d prometheus grafana blackbox-exporter loki promtail

observability-down: guard-env-file
	$(COMPOSE) --profile observability down

observability-ps: guard-env-file
	$(COMPOSE) --profile observability ps
