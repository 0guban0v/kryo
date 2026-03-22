observability-up: guard-env-file
	$(COMPOSE) --profile observability up -d prometheus grafana blackbox-exporter loki promtail

observability-down: guard-env-file
	$(COMPOSE) --profile observability down

observability-ps: guard-env-file
	$(COMPOSE) --profile observability ps

observability-deploy-dashboard: guard-env-file
	$(COMPOSE) --profile observability up -d --force-recreate grafana
