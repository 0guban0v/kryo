tooling-up:
	$(COMPOSE) $(TOOLING_PROFILE) up -d $(TOOLING_SERVICE)

container-install: tooling-up
	$(TOOLING_EXEC) '$(TOOLING_BOOTSTRAP) && $(PNPM_INSTALL)'

container-build: tooling-up
	$(TOOLING_EXEC) '$(TOOLING_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run build && pnpm run demo-service:build'

container-test: tooling-up
	$(TOOLING_EXEC) '$(TOOLING_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm test && pnpm run demo-service:test'

container-lint: tooling-up
	$(TOOLING_EXEC) '$(TOOLING_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run lint'

container-format: tooling-up
	$(TOOLING_EXEC) '$(TOOLING_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run format'

container-demo-test: tooling-up
	$(TOOLING_EXEC) '$(TOOLING_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run demo-service:test'

container-demo-test-demo: tooling-up
	$(TOOLING_EXEC) '$(TOOLING_BOOTSTRAP) && $(PNPM_INSTALL) >/dev/null && pnpm run demo-service:test:demo'

install: container-install

build: container-build

test: container-test

lint: container-lint

format: container-format

demo-test: container-demo-test

demo-test-demo: container-demo-test-demo

up:
	$(COMPOSE) up --build
