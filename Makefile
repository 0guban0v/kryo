.DEFAULT_GOAL := up

include make/common.mk
include make/container.mk
include make/observability.mk

.PHONY: guard-env-file

guard-env-file:
	@if [ "$(ENV_FILE)" = "$(ENV_FILE_PLACEHOLDER)" ]; then \
		echo "Set ENV_FILE, for example: cp .env.example yourname.env && make deploy ENV_FILE=yourname.env"; \
		exit 1; \
	fi
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "Missing $(ENV_FILE). Create it from .env.example or pass a different ENV_FILE."; \
		exit 1; \
	fi
