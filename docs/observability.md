# Observability

The local observability profile includes:

- `Prometheus`
- `blackbox-exporter`
- `Loki`
- `Promtail`
- `Grafana`

## Start It

```sh
make observability-up ENV_FILE=yourname.env
```

To reapply Grafana dashboard and datasource provisioning after editing the
checked-in files without redeploying the whole stack:

```sh
make observability-deploy-dashboard ENV_FILE=yourname.env
```

## Access

- Grafana: `http://localhost:3001`
- Prometheus: `http://localhost:9090`
- blackbox-exporter: `http://localhost:9115`
- Loki: `http://localhost:3101`

Grafana credentials:

- user: `GRAFANA_ADMIN_USER` (default `grafana-admin@demo.local`)
- password: `GRAFANA_ADMIN_PASSWORD` (default `grafana-admin`)

## What You Get

- a provisioned `Prometheus` datasource
- a provisioned `Loki` datasource
- a starter dashboard named `Kryo Overview`
- uniform HTTP health probes for:
  - `mcp`
  - `fizzy`
  - `gitea`
- container log ingestion for:
  - `mcp`
  - `fizzy`
  - `gitea`

Promtail filters Docker discovery by Compose project name. By default it uses
`COMPOSE_PROJECT_NAME` when set, otherwise the local default `kryo`. Override
`PROMTAIL_COMPOSE_PROJECT_REGEX` if your deployment uses a different project
label or needs a broader match.
