# Decisions, Questions, References

## Key Decisions

### Intent-Driven Tools

Expose user workflows, not low-level API wrappers.

### Shared Workflow Layer

The MCP entry point and Campfire bot must call the same workflow logic.

### Container-First Delivery

The local demo environment should be disposable, and the same images should move to any cloud runtime with minimal manifest changes.

### Explicit Security Boundary

Security claims must map to concrete controls. If the stack claims air-gappability, production readiness, or cloud portability, the docs must specify:

- where TLS terminates
- what is public versus private
- how secrets are delivered
- how the Campfire bot endpoint is authenticated despite unsigned upstream webhooks

### GitHub-Compatible Forge Adapter

Target a stable workflow surface and make the backend forge configurable.

### Infisical For Secrets Management

Use self-hosted Infisical as the system of record for application secrets and runtime secret delivery.

### Model Agnosticism

MCP stays transport-oriented and independent of any one model provider.

## Questions To Resolve During Iteration

1. TypeScript remains the current implementation language, but should Go or Python be a future alternative track?
2. Which HTTP transport should be treated as the default deployed mode: streamable HTTP or SSE?
3. Which cloud deployment example should be added first under `deploy/`: Kubernetes, ECS, or Nomad?
4. Which git forge should be the first validation target after the initial happy path: GitHub, GHES, or Gitea?
5. What is the minimum viable persistence model for the local stack versus a cloud deployment?
6. Which Infisical delivery path should be the default for the first cloud example: CLI/agent injection or Kubernetes-native operator/injector?
7. Which CI system should be the first reference implementation: GitHub Actions for the demo repo, or a forge-neutral pipeline example?

## Upstream References In This Workspace

- `fizzy/docs/API.md`
- `fizzy/docs/docker-deployment.md`
- `fizzy/app/controllers/boards_controller.rb`
- `fizzy/app/controllers/cards_controller.rb`
- `fizzy/app/controllers/cards/comments_controller.rb`
- `fizzy/app/controllers/cards/assignments_controller.rb`
- `fizzy/app/controllers/cards/taggings_controller.rb`
- `fizzy/app/controllers/webhooks_controller.rb`
- `once-campfire/app/models/webhook.rb`
- `once-campfire/app/models/user/bot.rb`
- `once-campfire/app/controllers/messages/by_bots_controller.rb`
- `once-campfire/app/controllers/messages_controller.rb`
- `campfire-bot-kit/README.md`
- `campfire-bot-kit/bot.rb`
- `chrome-devtools-mcp/src/index.ts`
- `chrome-devtools-mcp/src/tools/ToolDefinition.ts`
- `chrome-devtools-mcp/docs/design-principles.md`
- Infisical docs for self-hosting, CLI injection, Universal Auth, and Kubernetes integrations

## External Reference Themes

- Block on workflow-oriented MCP server design
- CloudQuery on tool naming, schema discipline, and token economy
- PagerDuty on tool count and real user journeys
- Multiplayer on Markdown-first tool output
- Microsoft on schema evolution and long-term maintenance
- Infisical on self-hosted secrets delivery for containers, VMs, CI, and Kubernetes
