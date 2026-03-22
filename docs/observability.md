# Observability

The local observability profile includes:

- `Prometheus`
- `blackbox-exporter`
- `Loki`
- `Promtail`
- `Grafana`

## Start It

```sh
make observability-up
```

## Access

- Grafana: `http://localhost:3001`
- Prometheus: `http://localhost:9090`
- blackbox-exporter: `http://localhost:9115`
- Loki: `http://localhost:3101`

Grafana credentials:

- user: `admin`
- password: `admin`

## What You Get

- a provisioned `Prometheus` datasource
- a provisioned `Loki` datasource
- a starter dashboard named `Kryo Overview`
- uniform HTTP health probes for:
  - `mcp`
  - `fizzy`
  - `campfire`
  - `gitea`
- container log ingestion for:
  - `mcp`
  - `fizzy`
  - `campfire`
  - `gitea`
