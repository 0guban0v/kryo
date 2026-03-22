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

For a clean local start:

```sh
cp .env.example yourname.env
make deploy ENV_FILE=yourname.env
```

The Makefile intentionally defaults `ENV_FILE` to a placeholder so Compose-backed targets fail fast until you pick a real local env file name and pass `ENV_FILE=...`.

Then access:

- MCP HTTP: `http://localhost:3100/mcp`
- `mcp` health: `http://localhost:3100/up`
- Fizzy: `http://localhost:3006`
- Campfire: `http://localhost:3000`
- Gitea: `http://localhost:3007`

`make deploy` runs the idempotent bootstrap flow and starts the local stack. Installation details, seeded demo identities, login helpers, and the broader Make target reference live in the docs.

## Docs

- [Installation](docs/installation.md)
- [Architecture](docs/architecture.md)
- [Integrations](docs/integrations.md)
- [Observability](docs/observability.md)
- [Security](docs/security.md)
