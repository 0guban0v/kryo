# Integrations And Config

## Fizzy

Base URL shape:

- `{FIZZY_URL}/{account_id}`

Key responsibilities:

- list boards and columns
- list and inspect cards
- create and update cards
- comment on cards
- apply tags
- move cards through workflow states

Auth model:

- Bearer token via `FIZZY_API_TOKEN`

## Campfire

There are two distinct Campfire interaction modes.

### Inbound Bot Webhooks

When a user mentions the bot, Campfire sends a webhook payload that includes:

- the sender
- the room
- the message body in HTML and plain text
- bot-scoped room posting path information

### Outbound Bot Posting

Bot-authored replies and proactive posts should use the per-room bot-authenticated path exposed by Campfire, not a generic user session endpoint.

Important rule:

- model proactive posting around the bot-specific room path derived from Campfire bot behavior, not around a normal interactive user client

## Git Forge

The git adapter must be provider-aware rather than hardcoded to `github.com`.

Supported provider modes:

- `github`
- `ghes`
- `gitea`

Rules:

1. `GITHUB_API_URL` is the real base URL for the configured provider.
2. Use `Authorization: Bearer ...` for GitHub and GHES.
3. Use `Authorization: token ...` for Gitea or Forgejo.
4. Prefer GitHub-style `check-runs` when available.
5. Fall back to combined commit statuses when `check-runs` are unsupported.
6. Validate provider-specific request fields against the target forge's `/swagger.v1.json`.
7. Keep the workflow tool surface identical regardless of provider.

## Infisical

Infisical is the secrets-management system for this project. The target deployment model is self-hosted Infisical, not a hosted SaaS dependency.

### Delivery Model

For generic containers, VMs, and CI environments:

- use the Infisical CLI or Infisical Agent to inject secrets at runtime
- authenticate with a machine identity rather than a human login
- prefer short-lived access tokens over long-lived static secrets

For Kubernetes environments:

- use Infisical Kubernetes Auth for workload identity
- use the Infisical Operator or Agent Injector depending on whether the platform prefers synced secrets or file-based injection

### Practical Rule

- `.env.example` documents variable names and bootstrap settings
- actual secret values come from Infisical at runtime
- `docker-compose.yml`, deployment manifests, and repo files should not be the system of record for service credentials

### Bootstrap Credentials

If a workload needs Infisical bootstrap credentials, treat them as deployment secrets too. Do not commit them. For non-Kubernetes environments, the default bootstrap mechanism should be a machine identity using Universal Auth.

## Bot Endpoint Hardening

Campfire's upstream bot webhook behavior does not include native signed webhook requests. That means "signature verification" must be implemented as an equivalent boundary control rather than assumed from Campfire itself.

Preferred controls:

1. private network exposure only
2. TLS termination at a reverse proxy or ingress
3. proxy-level shared-secret or HMAC enforcement
4. optional mTLS where the environment supports it

Any shared secret used for this boundary should be delivered through Infisical.

## Container Networking

Within the local stack, service-to-service URLs should use service DNS names rather than host loopback.

Examples:

- `FIZZY_URL=http://fizzy`
- `CAMPFIRE_URL=http://campfire`

The host-facing port mapping is for developers and browser access, not for app-internal service discovery.

## Environment Example

```bash
# Fizzy
FIZZY_URL=http://fizzy
FIZZY_API_TOKEN=your-fizzy-api-token
FIZZY_ACCOUNT_ID=897362094
FIZZY_BOARD_ID=your-board-id

# Campfire
CAMPFIRE_URL=http://campfire
CAMPFIRE_BOT_KEY=your-bot-key
CAMPFIRE_ROOM_ID=your-room-id

# Git forge
# Public GitHub: https://api.github.com
# GHES: https://ghes.internal.example/api/v3
# Gitea/Forgejo: https://gitea.internal.example/api/v1
GIT_FORGE_PROVIDER=github
GITHUB_API_URL=https://api.github.com
GITHUB_TOKEN=your-token
GITHUB_REPO=your-org/kryo-mcp
GITHUB_DEFAULT_BRANCH=main

# Infisical
INFISICAL_URL=https://infisical.internal.example
INFISICAL_PROJECT_ID=project-id
INFISICAL_ENVIRONMENT=dev
INFISICAL_SECRET_PATH=/kryo-mcp
# For generic containers or VMs, use a machine identity via Universal Auth.
INFISICAL_CLIENT_ID=machine-identity-client-id
INFISICAL_CLIENT_SECRET=machine-identity-client-secret

# MCP transport
MCP_TRANSPORT=stdio
MCP_PORT=3100
```

## Cloud Portability Rules

- Keep secrets and base URLs in environment variables.
- Use Infisical as the source of truth for secret values.
- Write logs to stdout and stderr.
- Avoid local-disk assumptions except for explicitly mounted persistent volumes.
- Keep deployment-target differences in `deploy/` manifests, not in runtime code.
