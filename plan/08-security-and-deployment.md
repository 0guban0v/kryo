# Security And Deployment

## Why This File Exists

The project currently claims:

- container-first delivery
- production-quality intent
- air-gappable deployment
- transferability to any cloud runtime

Those claims need concrete controls behind them. This file defines the minimum security and deployment contract that makes those claims credible.

## Secrets Management

Use self-hosted Infisical as the source of truth for application secrets.

### Local And Generic Container Runtimes

Recommended baseline:

- run workloads with secrets injected by the Infisical CLI or Infisical Agent
- authenticate with a machine identity
- use short-lived access tokens instead of long-lived human credentials

This keeps the app code portable across Docker Compose, VMs, CI runners, and generic container platforms.

### Kubernetes

Recommended baseline:

- authenticate workloads with Infisical Kubernetes Auth
- use the Infisical Operator when the platform wants synced Kubernetes Secrets
- use the Agent Injector when the platform prefers file-based secret delivery at pod startup

### Repo Rule

The repository may contain:

- variable names
- non-secret identifiers
- sample configuration

The repository must not be the source of truth for:

- real service tokens
- bot boundary secrets
- TLS private keys
- bootstrap credentials for production identities

## TLS Boundary

### External Traffic

Terminate TLS at an ingress, reverse proxy, or load balancer for:

- MCP HTTP transport
- Campfire bot webhook endpoint
- browser access to Fizzy and Campfire

### Internal Traffic

Keep service-to-service traffic on a private network. If the target environment requires stronger controls, add mTLS or service identity at the platform layer rather than coupling the application to one platform.

## Bot Endpoint Authentication

Important constraint:

- Campfire's upstream webhook model does not provide built-in signed webhook requests

That means app-layer "signature verification" is not a native feature you can honestly claim from Campfire alone.

Credible options:

1. keep the bot endpoint private
2. require TLS plus reverse-proxy auth
3. enforce a shared secret or HMAC at the proxy or gateway layer
4. use mTLS if the deployment platform supports it

Any shared-secret material for this boundary should come from Infisical.

## Deployment Artifacts

The minimum deployment story should include:

1. a root `Dockerfile` for `kryo-mcp`
2. an `examples/demo-service/Dockerfile`
3. a local `docker-compose.yml`
4. at least one concrete deployment example under `deploy/`
5. a CI pipeline that builds, tests, and validates the container packaging

Preferred first deployment target:

- `deploy/kubernetes/` because it demonstrates the cleanest "any cloud that runs containers" story

## Production-Readiness Gate

Do not describe the service as production-quality until the following are present:

1. container image for the main service
2. workflow-layer unit tests
3. bot endpoint hardening
4. deployment manifests
5. CI-backed build and test automation
6. explicit security-boundary documentation
