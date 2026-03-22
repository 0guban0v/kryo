devbox-up: guard-env-file
	$(COMPOSE) $(DEVBOX_PROFILE) up -d $(DEVBOX_SERVICE)

container-install: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL)'

container-build: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run build'

container-test-offline: devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run test:offline'

container-refresh-mcp-runtime: guard-env-file generate-mcp-env
	$(COMPOSE) up -d --force-recreate mcp

container-test-online: container-refresh-mcp-runtime devbox-up
	$(DEVBOX_EXEC) '$(DEVBOX_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && MCP_E2E_URL=http://mcp:3100/mcp pnpm run test:online'

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

refresh-mcp-runtime: container-refresh-mcp-runtime

lint: container-lint

format: container-format

deadcode: container-deadcode

quality: container-quality

bootstrap: guard-env-file
	$(COMPOSE) up -d fizzy campfire gitea
	$(RUN_WITH_ENV) ./scripts/bootstrap-fizzy-env.sh
	$(RUN_WITH_ENV) ./scripts/bootstrap-campfire-env.sh
	$(RUN_WITH_ENV) ./scripts/bootstrap-gitea-env.sh

bootstrap-fizzy: guard-env-file
	$(COMPOSE) up -d fizzy
	$(RUN_WITH_ENV) ./scripts/bootstrap-fizzy-env.sh

bootstrap-campfire: guard-env-file
	$(COMPOSE) up -d campfire
	$(RUN_WITH_ENV) ./scripts/bootstrap-campfire-env.sh

bootstrap-gitea: guard-env-file
	$(COMPOSE) up -d gitea
	$(RUN_WITH_ENV) ./scripts/bootstrap-gitea-env.sh

generate-mcp-env: guard-env-file
	$(RUN_WITH_ENV) ./scripts/generate-mcp-env.sh

fizzy-login-code: guard-env-file
	$(COMPOSE) up -d fizzy
	$(COMPOSE) exec -T \
		-e EMAIL='$(EMAIL)' \
		fizzy bin/rails runner 'identity = Identity.find_by(email_address: ENV.fetch("EMAIL")) or abort("Unknown Fizzy identity: #{ENV.fetch("EMAIL")}") ; magic_link = identity.send_magic_link ; puts "EMAIL=#{identity.email_address}" ; puts "MAGIC_LINK_CODE=#{magic_link.code}"'

deploy: bootstrap generate-mcp-env
	$(COMPOSE) up -d mcp

deploy-all: deploy
	$(COMPOSE) --profile observability up -d prometheus grafana blackbox-exporter loki promtail

up: guard-env-file generate-mcp-env
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
