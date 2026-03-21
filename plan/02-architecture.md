# Architecture

## Runtime Shape

The architecture is container-first. The same images and environment-driven configuration should work:

- locally via Docker Compose or Podman Compose
- in CI for build and integration testing
- in any cloud environment that can run OCI containers

## Design Constraints

- Do not require host-level installation of Node, Bun, or Python for normal development, demo execution, or testing.
- Install dependencies inside containers.
- Use environment variables and service DNS for service discovery.
- Avoid hardcoded `localhost` assumptions inside the app.
- Keep the core server cloud-neutral.
- Package the MCP server and Campfire bot together in one service unless a later operational need justifies splitting them.
- Treat secrets delivery as an explicit runtime concern using self-hosted Infisical rather than committed `.env` secrets.
- Terminate TLS and enforce external auth at the ingress or reverse-proxy boundary rather than assuming an internal-only demo forever.

## High-Level Diagram

```text
MCP client
  -> stdio for local workflows
  -> streamable HTTP for deployed workflows

OCI container: kryo-mcp
  - MCP server
  - Campfire bot webhook handler
  - workflow orchestrator
  - adapters: Fizzy, Campfire, Git forge

Downstream services
  - Fizzy container
  - Campfire container
  - demo-service container
  - Git forge API endpoint
  - Infisical control plane
```

## Portability Rule

Anything that changes across Docker Compose, Kubernetes, ECS, Nomad, or another cloud runtime must be handled in configuration and deployment manifests, not application code.

## Security Boundary

### Public Or Ingress-Exposed Surface

- MCP HTTP transport, if enabled outside local `stdio`
- Campfire bot webhook endpoint
- browser access to Fizzy and Campfire

These entry points should sit behind TLS termination and authentication controls appropriate to the environment.

### Private Application Network

- `kryo-mcp`
- `examples/demo-service`
- Fizzy
- Campfire
- Infisical

These services should communicate over a private container or cluster network and should not assume public exposure.

### Secrets Boundary

- Long-lived application secrets should be stored in self-hosted Infisical.
- Runtime secrets should be injected into workloads at startup or synchronized by platform-native integrations.
- The repo may document variable names, but it should not be treated as a source of secret values.

### Bot Endpoint Authentication

Campfire's upstream bot webhook behavior does not provide a built-in signature-verification scheme. Do not claim native webhook signature verification unless a signing proxy or custom gateway is actually present.

Baseline hardening options:

- keep the bot endpoint on a private network
- front it with a reverse proxy that enforces a shared secret or HMAC
- use mTLS or service-to-service auth where the platform supports it
- store any shared secret or proxy credential in Infisical

## Core Data Flow

1. The agent picks up a Fizzy card from a target column.
2. The workflow assigns or moves the card and posts a Campfire update.
3. The agent edits code in the repo volume or mounted workspace.
4. Tests run inside the `demo-service` container or an ephemeral test container.
5. The workflow creates a pull request on the configured git forge.
6. If checks pass, the workflow merges the PR and moves the card to `Done`.
7. If checks fail, the workflow moves the card to `Blocked`, comments in Fizzy, and notifies Campfire.

## Repository Layout

```text
kryo-mcp/
├── Dockerfile
├── docker-compose.yml
├── deploy/
│   ├── compose/
│   └── kubernetes/
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── adapters/
│   ├── bot/
│   ├── prompts/
│   ├── resources/
│   ├── tools/
│   ├── workflows/
│   ├── config.ts
│   └── types.ts
├── examples/
│   └── demo-service/
│   ├── Dockerfile
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
└── plan/
```

## Service Boundaries

### `kryo-mcp`

- owns MCP transport
- owns Campfire bot webhook handling
- owns workflow orchestration
- calls the external service adapters

### `examples/demo-service`

- intentionally small demo app
- provides a concrete coding target for the agent
- includes a failing `/health` expectation at the start of the demo

### Fizzy and Campfire

- treated as self-hosted external systems
- run as local containers in the demo environment
- should remain replaceable from an app-architecture perspective

### Infisical

- treated as the system of record for application secrets
- may run self-hosted in local, lab, or cloud environments
- should deliver secrets without changing application code across environments
