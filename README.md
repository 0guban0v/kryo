# Kryo

Self-hosted MCP server for AI-powered developer workflow orchestration across Fizzy, Campfire, and a GitHub-compatible git forge, designed for air-gapped or defense-sensitive environments.

## What It Does

`kryo` lets an agent:

- pick up work from a Fizzy board
- move cards through workflow states
- report blockers and create follow-up work
- create and merge pull requests against a GitHub-compatible forge
- notify Campfire and respond to Campfire bot commands

The server is workflow-oriented rather than a thin API wrapper. Tools compose multiple Fizzy, Campfire, and forge operations into one agent intent.

## Local Bootstrap

For a clean local start with the full local stack, including observability:

```sh
cp .env.example yourname.env
make deploy-all ENV_FILE=yourname.env
```

The Makefile intentionally defaults `ENV_FILE` to a placeholder so Compose-backed targets fail fast until you pick a real local env file name and pass `ENV_FILE=...`.

`make deploy-all` runs the idempotent bootstrap flow, starts the core developer workflow services, and brings up the local observability profile. Installation details, seeded demo identities, login helpers, and the broader Make target reference live in the docs.

| Service | Purpose | URL |
| --- | --- | --- |
| MCP HTTP | MCP endpoint | [http://localhost:3100/mcp](http://localhost:3100/mcp) |
| MCP Health | Kryo liveness check | [http://localhost:3100/up](http://localhost:3100/up) |
| Campfire Webhook | Bot webhook endpoint | [http://localhost:3100/campfire/webhook](http://localhost:3100/campfire/webhook) |
| Fizzy | Board UI | [http://localhost:3006](http://localhost:3006) |
| Campfire | Chat UI | [http://localhost:3000](http://localhost:3000) |
| Gitea | Git forge UI | [http://localhost:3007](http://localhost:3007) |
| Grafana | Dashboards | [http://localhost:3001](http://localhost:3001) |
| Prometheus | Metrics and query UI | [http://localhost:9090](http://localhost:9090) |
| blackbox-exporter | Probe debug endpoint | [http://localhost:9115](http://localhost:9115) |
| Loki | Log API | [http://localhost:3101](http://localhost:3101) |

## Docs

- [Installation](docs/installation.md)
- [Architecture](docs/architecture.md)
- [Integrations](docs/integrations.md)
- [Observability](docs/observability.md)
- [Security](docs/security.md)
