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

`make bootstrap` is the idempotent environment-seeding step behind `make deploy` and `make deploy-all`.
It creates or reuses the local Fizzy account/token, Campfire room/bot, and a local Gitea repo owned by a dedicated service user, then updates the selected env file with:

- `FIZZY_ACCOUNT_ID`
- `FIZZY_API_TOKEN`
- `CAMPFIRE_ROOM_ID`
- `CAMPFIRE_BOT_KEY`
- `GIT_FORGE_API_URL`
- `GIT_FORGE_TOKEN`
- `GIT_FORGE_REPO`

For local browser logins, the bootstrap defaults are service-specific: Fizzy uses `fizzy-admin@demo.local` with the development magic-link flow, and Campfire uses the seeded platform admin at `campfire-admin@demo.local` / `campfire-admin`. The only other seeded Campfire identity is the `Kryo` bot.
Gitea uses `gitea-admin` / `gitea-admin` for the admin UI and seeds a `platform-team` account that owns the repo Kryo is allowed to edit by default.
If you are using a browser without devtools, run `make fizzy-login-code` to print a fresh Fizzy sign-in code for the bootstrap email.
For local code health checks, run `make quality` to verify formatting, lint the repo, and detect dead code with `knip`.

## Docs

- [Installation](docs/installation.md)
- [Architecture](docs/architecture.md)
- [Integrations](docs/integrations.md)
- [Observability](docs/observability.md)
- [Security](docs/security.md)

## Repository Layout

```text
.
|-- Dockerfile
|-- Makefile
|-- docker-compose.yml
|-- docs/
|-- observability/
|-- scripts/
|-- src/
|-- tests/
`-- deploy/
```
