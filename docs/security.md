# Security

## Secrets

Use self-hosted Infisical as the source of truth for secrets in non-local environments.

The local env file is a bootstrap convenience, not the intended long-term secrets system.

## Bot Endpoint

Campfire does not natively sign webhook requests. Treat bot endpoint hardening as a network or ingress concern:

- private network exposure
- TLS termination
- reverse-proxy shared secret or HMAC
- optional mTLS where supported

`kryo` also supports an optional shared-secret boundary header:

- `BOT_WEBHOOK_AUTH=shared-secret|none`
- `BOT_WEBHOOK_SHARED_SECRET`
- `BOT_WEBHOOK_SHARED_SECRET_HEADER`

When `BOT_WEBHOOK_AUTH=shared-secret`, `BOT_WEBHOOK_SHARED_SECRET` must be set for
HTTP deployments. Set `BOT_WEBHOOK_AUTH=none` only when an ingress, proxy, or
private network boundary is intentionally enforcing webhook access outside the app.

## TLS Boundary

Terminate TLS at the ingress, reverse proxy, or load balancer in deployed environments.

## HTTP Host Validation

`kryo` validates inbound `Host` headers against `MCP_ALLOWED_HOSTS`.

- set `MCP_ALLOWED_HOSTS` explicitly when exposing the HTTP listener behind an ingress, reverse proxy, or custom DNS name
- keep the default local allowlist for localhost and in-cluster service access during bootstrap
- bound stateful MCP session growth with `MCP_SESSION_IDLE_TTL_MS` and `MCP_MAX_SESSIONS` when using `MCP_HTTP_SESSION_MODE=stateful`

## Git Forge Scope

For the local Gitea demo flow, `make bootstrap` creates a dedicated `platform-team` user and repo-scoped token.

- `GIT_FORGE_REPO` is set to the seeded repo owned by that service user
- `GIT_FORGE_ALLOW_REPO_OVERRIDE=false` keeps MCP callers pinned to that repo by default
- set `GIT_FORGE_ALLOW_REPO_OVERRIDE=true` only if you intentionally want one Kryo instance to operate on multiple repos

## Cloud Portability

- keep secrets in environment or secret managers
- keep logs on stdout/stderr
- keep deployment-specific concerns in `deploy/`
- keep runtime code platform-neutral
