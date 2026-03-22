.PHONY: \
	install build test-offline test-online lint format deadcode quality up down restart ps logs health devbox-up \
	bootstrap bootstrap-fizzy bootstrap-campfire bootstrap-gitea fizzy-login-code deploy deploy-all observability-up observability-down observability-ps \
	container-install container-build container-test-offline container-test-online container-lint container-format container-deadcode container-quality

ENV_FILE_PLACEHOLDER := yourname.env
ENV_FILE ?= $(ENV_FILE_PLACEHOLDER)
COMPOSE := docker compose --env-file $(ENV_FILE)
DEVBOX_PROFILE := --profile devbox
DEVBOX_SERVICE := devbox
DEVBOX_EXEC := $(COMPOSE) $(DEVBOX_PROFILE) exec -T $(DEVBOX_SERVICE) sh -lc
DEVBOX_BOOTSTRAP := corepack enable >/dev/null && pnpm config set store-dir /pnpm/store >/dev/null
PNPM_INSTALL := pnpm install --frozen-lockfile
SERVICE ?=
BOOTSTRAP_FIZZY_ACCOUNT_NAME ?= Demo Platform
BOOTSTRAP_FIZZY_OWNER_NAME ?= Fizzy Admin
BOOTSTRAP_FIZZY_OWNER_EMAIL ?= fizzy-admin@demo.local
BOOTSTRAP_FIZZY_TOKEN_DESCRIPTION ?= demo-platform
BOOTSTRAP_FIZZY_TOKEN_PERMISSION ?= write
BOOTSTRAP_CAMPFIRE_ADMIN_NAME ?= Platform Admin
BOOTSTRAP_CAMPFIRE_ADMIN_EMAIL ?= campfire-admin@demo.local
BOOTSTRAP_CAMPFIRE_ADMIN_PASSWORD ?= campfire-admin
BOOTSTRAP_CAMPFIRE_ROOM_NAME ?= platform-ops
BOOTSTRAP_CAMPFIRE_BOT_NAME ?= Kryo
BOOTSTRAP_GITEA_ROOT_URL ?= http://localhost:3007
BOOTSTRAP_GITEA_ADMIN_NAME ?= Gitea Admin
BOOTSTRAP_GITEA_ADMIN_USERNAME ?= gitea-admin
BOOTSTRAP_GITEA_ADMIN_EMAIL ?= gitea-admin@demo.local
BOOTSTRAP_GITEA_ADMIN_PASSWORD ?= gitea-admin
BOOTSTRAP_GITEA_SERVICE_NAME ?= Kryo Service
BOOTSTRAP_GITEA_SERVICE_USERNAME ?= kryo-service
BOOTSTRAP_GITEA_SERVICE_EMAIL ?= kryo-service@demo.local
BOOTSTRAP_GITEA_SERVICE_PASSWORD ?= kryo-service
BOOTSTRAP_GITEA_REPO_NAME ?= target-service
BOOTSTRAP_GITEA_TOKEN_NAME ?= kryo-mcp
EMAIL ?= $(BOOTSTRAP_FIZZY_OWNER_EMAIL)
