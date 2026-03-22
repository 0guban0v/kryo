# Architecture

## Runtime Shape

`kryo` packages:

- MCP server
- Campfire bot webhook handler
- shared workflow layer
- shared adapters for Fizzy, Campfire, and the configured git forge

The project is container-first and intended to run unchanged across local Compose, CI, and cloud container platforms.

## System Diagram

The layout below follows the same broad pattern as the Prometheus architecture overview: a central runtime with surrounding producers, consumers, and supporting systems.

```mermaid
flowchart LR
  subgraph Clients
    direction TB
    MCPClient[MCP client or IDE]
    Users[Users]
  end

  subgraph Runtime[mcp runtime]
    direction TB
    MCPTransport[MCP transport]
    BotWebhook[Campfire bot webhook]
    Workflow[Workflow orchestrator]
    Adapters[Shared adapters]
    Workflow --> Adapters
  end

  subgraph Systems[Managed systems]
    direction TB
    Fizzy[Fizzy]
    Campfire[Campfire]
    GitForge[Git forge]
  end

  subgraph Secrets[Secrets]
    Infisical[Infisical]
  end

  subgraph Observability
    direction TB
    Blackbox[blackbox-exporter]
    Promtail[Promtail]
    Prometheus[Prometheus]
    Loki[Loki]
    Grafana[Grafana]
    Blackbox --> Prometheus
    Promtail --> Loki
    Prometheus --> Grafana
    Loki --> Grafana
  end

  MCPClient --> MCPTransport
  Users --> Campfire
  Campfire --> BotWebhook
  MCPTransport --> Workflow
  BotWebhook --> Workflow
  Adapters --> Fizzy
  Adapters --> Campfire
  Adapters --> GitForge
  Infisical -.-> Workflow

  Blackbox -.-> MCPTransport
  Blackbox -.-> Fizzy
  Blackbox -.-> Campfire
  Promtail -.-> Workflow
  Promtail -.-> Fizzy
  Promtail -.-> Campfire
```

## Core Flow

```text
MCP client or IDE agent
  -> stdio or streamable HTTP
  -> mcp
  -> workflow layer
  -> adapters
  -> Fizzy / Campfire / git forge
```

## MCP Tool Sequence

```mermaid
sequenceDiagram
  participant Client as MCP client
  participant Kryo as mcp
  participant Fizzy as Fizzy
  participant Campfire as Campfire
  participant Forge as Git forge

  Client->>Kryo: invoke workflow tool
  Kryo->>Fizzy: read or update card state
  Kryo->>Campfire: post status update
  opt review or merge flow
    Kryo->>Forge: create PR or merge PR
  end
  Kryo-->>Client: markdown result
```

## Campfire Bot Sequence

```mermaid
sequenceDiagram
  participant User as Campfire user
  participant Campfire as Campfire
  participant Kryo as mcp bot webhook
  participant Fizzy as Fizzy

  User->>Campfire: mention bot or send command
  Campfire->>Kryo: webhook POST
  Kryo->>Fizzy: fetch board or card context
  Kryo-->>Campfire: plain-text reply
  Campfire-->>User: bot message in room
```

## HTTP Transport

Supported modes:

- `stdio`
- `streamable-http`

For `streamable-http`, the session strategy is explicit:

- `MCP_HTTP_SESSION_MODE=stateful`
  - in-process session storage
  - bounded by `MCP_SESSION_IDLE_TTL_MS` and `MCP_MAX_SESSIONS`
  - best for single-instance local use
- `MCP_HTTP_SESSION_MODE=stateless`
  - fresh MCP server per request
  - safer for non-sticky or multi-replica deployments

Inbound HTTP requests are also validated against `MCP_ALLOWED_HOSTS` before either the MCP transport or Campfire webhook handler runs.

## Service Boundaries

- `kryo`
  - orchestration and HTTP surfaces
- `fizzy`
  - board/card system of record
- `campfire`
  - chat and bot webhook integration
- git forge
  - PR and merge lifecycle
