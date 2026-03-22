.PHONY: \
	install build test-offline test-online lint format deadcode quality up down restart ps logs health devbox-up \
	bootstrap bootstrap-fizzy bootstrap-campfire bootstrap-gitea generate-mcp-env refresh-mcp-runtime fizzy-login-code deploy deploy-all observability-up observability-down observability-ps \
	container-install container-build container-test-offline container-test-online container-lint container-format container-deadcode container-quality container-refresh-mcp-runtime

ENV_FILE_PLACEHOLDER := yourname.env
ENV_FILE ?= $(ENV_FILE_PLACEHOLDER)
MCP_RUNTIME_ENV := deploy/mcp.env
RUN_WITH_ENV := ENV_FILE=$(ENV_FILE) MCP_RUNTIME_ENV=$(MCP_RUNTIME_ENV) ./scripts/compose-env.sh
COMPOSE := $(RUN_WITH_ENV) docker compose --env-file $(ENV_FILE)
DEVBOX_PROFILE := --profile devbox
DEVBOX_SERVICE := devbox
DEVBOX_EXEC := $(COMPOSE) $(DEVBOX_PROFILE) exec -T $(DEVBOX_SERVICE) sh -lc
DEVBOX_BOOTSTRAP := corepack enable >/dev/null && pnpm config set store-dir /pnpm/store >/dev/null
PNPM_INSTALL := pnpm install --frozen-lockfile
SERVICE ?=
EMAIL ?= $(shell [ -f "$(ENV_FILE)" ] && sed -n 's/^BOOTSTRAP_FIZZY_OWNER_EMAIL=//p' "$(ENV_FILE)" | tail -n 1)
