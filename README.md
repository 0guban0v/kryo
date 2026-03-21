# Kryo MCP

Self-hosted MCP server for AI-powered developer workflow orchestration across Fizzy, Campfire, and a GitHub-compatible git forge, designed for air-gapped or defense-sensitive environments.

## Why this exists

`kryo-mcp` demonstrates an end-to-end developer workflow where an agent can:

- pick up work from a Fizzy board
- update progress and report blockers
- create and merge pull requests against a GitHub-compatible forge
- notify a Campfire room
- respond to Campfire bot commands over webhooks

The server is intentionally workflow-oriented instead of exposing raw API wrappers. A single MCP tool can compose multiple Fizzy, Campfire, and GitHub operations into one agent intent.

## Architecture

```text
+--------------------------+
| MCP client or IDE agent  |
+------------+-------------+
             |
             | stdio / HTTP
             v
+----------------------------------------------------+
| kryo-mcp                                           |
|                                                    |
| MCP tools        Campfire bot webhook              |
|      \             /                               |
|       +-----------+                                |
|                   |                                |
|                   v                                |
|           Shared workflow layer                    |
|                   v                                |
|           Shared adapters                          |
|           - Fizzy                                  |
|           - Campfire                               |
|           - GitHub / GHES / Gitea                 |
+----------+-------------+--------------+-----------+
           |             |              |
           v             v              v
        Fizzy         Campfire       GitHub
```

## Repository layout

```text
.
|-- Dockerfile
|-- Makefile
|-- biome.json
|-- pnpm-workspace.yaml
|-- src/
|   |-- adapters/
|   |-- bot/
|   |-- prompts/
|   |-- resources/
|   |-- tools/
|   |-- workflows/
|   |-- config.ts
|   |-- http-server.ts
|   |-- index.ts
|   `-- server.ts
|-- examples/
|   `-- demo-service/
|       |-- Dockerfile
|       `-- tests/
|-- tests/
|-- deploy/
|-- docker-compose.yml
|-- .env.example
`-- VIDEO_SCRIPT.md
```

## Quick start

1. Copy `.env.example` to `.env` and fill in the non-secret config. Prefer injecting real secret values into the runtime environment via self-hosted Infisical rather than treating `.env` as the system of record for credentials.
2. Build and start the full local stack with `docker compose up --build`.
3. Point your MCP client at `http://localhost:3100/mcp` when `MCP_TRANSPORT=streamable-http`.
4. Open Fizzy on `http://localhost:3006`, Campfire on `http://localhost:3000`, and the demo service on `http://localhost:4000`.
5. For host-run development instead of containerized execution, override `FIZZY_URL`, `CAMPFIRE_URL`, `MCP_HOST`, and `MCP_TRANSPORT` appropriately and use `pnpm` or the `Makefile` targets.

The bundled demo app at `examples/demo-service` intentionally does **not** implement `/health` yet. The baseline smoke test remains green for CI, while the full demo suite at `pnpm run demo-service:test:demo` is designed to fail until an agent completes that task during the demo.

## Tooling

- Package management: `pnpm`
- Linting and formatting: `Biome`
- Task runner: lean `Makefile`

## MCP tools

| Tool | Purpose |
| --- | --- |
| `pick_up_work` | Find the next unassigned card, assign it, move it to In Progress, and notify Campfire |
| `update_progress` | Move a card between workflow states and notify Campfire |
| `submit_for_review` | Create a PR, link it to the card, move to Review, and notify Campfire |
| `complete_work` | Merge a PR if checks passed, move the card to Done, and notify Campfire |
| `report_blocker` | Add blocker context to the card, move it to Blocked when possible, and notify Campfire |
| `create_card` | Create a new Fizzy card with optional tags and placement |
| `troubleshoot` | Turn raw logs into a structured triage note on the card and in Campfire |

## Resources

| Resource | Purpose |
| --- | --- |
| `board://status/{boardId}` | Current board state grouped by column and lifecycle bucket |
| `chat://recent/{roomId}` | Recent Campfire messages |

`chat://recent/{roomId}` uses direct Campfire API reads when `CAMPFIRE_SESSION_COOKIE` is configured. Without that cookie, it falls back to an in-memory transcript built from webhook traffic and bot-authored messages.

## Prompts

| Prompt | Purpose |
| --- | --- |
| `code-review` | Review a diff against a Fizzy card's requirements |
| `bug-triage` | Reduce raw error output into root cause, impact, and next steps |

## Campfire bot commands

The webhook listener responds to simple room commands:

- `board status`
- `what's blocked`
- `pick up next`
- `pick up next #p0`
- `create card Fix auth timeout | API calls fail after 7 seconds #bug`
- `help`

## Git forge compatibility

The git adapter is base-URL driven. It does not depend on `github.com` or a GitHub SDK.

- Provider selection: `GIT_FORGE_PROVIDER=github|ghes|gitea`
- Public GitHub: `GITHUB_API_URL=https://api.github.com`
- GHES: `GITHUB_API_URL=https://ghes.internal.example/api/v3`
- Gitea or Forgejo: `GITHUB_API_URL=https://gitea.internal.example/api/v1`

The implementation assumes a GitHub-compatible REST surface for pull request creation, merge, and status checks. GHES works directly. For Gitea or Forgejo, the adapter switches auth to `Authorization: token ...` and degrades gracefully to commit-status-only evaluation if the forge does not expose GitHub-style `check-runs`. Exact provider-specific request fields should be validated against the target instance's `/swagger.v1.json`. GitLab would require a separate adapter because its API model differs.

For demos, pointing at public GitHub is fine. For a real air-gapped deployment, point the same adapter at GHES, Gitea, or Forgejo and keep the MCP server unchanged.

## Transport modes

- `stdio`: starts the MCP server over stdio and also boots the Campfire webhook HTTP listener for host-run development
- `streamable-http`: serves MCP over `MCP_PATH` and is the default containerized mode

All modes also expose:

- `GET /up`
- `POST {BOT_WEBHOOK_PATH}`

## Secrets and security boundary

- Use self-hosted Infisical as the source of truth for application secrets.
- Inject runtime secrets into the service environment instead of relying on checked-in `.env` values.
- Campfire's upstream bot webhook model does not provide native signed webhook requests, so bot endpoint authentication should be enforced at the network or reverse-proxy boundary.
- The server supports optional boundary auth for the bot endpoint using `BOT_WEBHOOK_SHARED_SECRET` and `BOT_WEBHOOK_SHARED_SECRET_HEADER`. This is intended for a trusted proxy or gateway that injects the header, not as a claim that Campfire itself signs requests.
- Terminate TLS at an ingress, reverse proxy, or load balancer for deployed HTTP entry points.

## Design notes

- The Fizzy adapter normalizes card references so MCP tools can accept a card number, a card UUID, or a full card URL.
- The workflow layer hides real Fizzy endpoint details such as triage and assignment toggles behind intent-based operations.
- Campfire proactive posting uses the real bot path shape from Once Campfire: `/rooms/:room_id/:bot_key/messages`.
- The git adapter targets `GITHUB_API_URL` and `GIT_FORGE_PROVIDER`, so the same code can point at public GitHub, GHES, or a local Gitea/Forgejo instance.
- Check evaluation is capability-based: prefer `check-runs`, but fall back to combined commit statuses when a forge does not support that endpoint.
- Tool output is markdown-first so it reads well in both MCP clients and logs.
- The stack stays model-agnostic: nothing in the server depends on a specific frontier model vendor.

## Docker notes

`docker-compose.yml` now runs the full local stack: `kryo-mcp`, `demo-service`, Fizzy, and Campfire.

The repository now includes a shared `pnpm-lock.yaml`, and both CI and Docker builds use
`pnpm install --frozen-lockfile` for reproducible dependency resolution.

The Campfire service uses `../once-campfire` as its Docker build context, matching the local reference checkout included in this workspace.

For a fully disconnected deployment, you would also mirror container images into an internal registry such as Harbor instead of pulling from public registries. That is an operations concern and does not change the MCP server code.
