.PHONY: \
	install build test lint format demo-test demo-test-demo up tooling-up \
	container-install container-build container-test container-lint container-format container-demo-test container-demo-test-demo

COMPOSE := docker compose
TOOLING_PROFILE := --profile tooling
TOOLING_SERVICE := tooling
TOOLING_EXEC := $(COMPOSE) $(TOOLING_PROFILE) exec -T $(TOOLING_SERVICE) sh -lc
TOOLING_BOOTSTRAP := corepack enable >/dev/null && pnpm config set store-dir /pnpm/store >/dev/null
PNPM_INSTALL := pnpm install --frozen-lockfile
