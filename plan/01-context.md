# Context

## Goal

Build a production-quality TypeScript MCP server called `mission-control-mcp` that orchestrates an AI-powered developer workflow across:

- Fizzy for kanban
- Campfire for chat and bot interactions
- a GitHub-compatible git forge for pull requests and merge flow

The server has two entry points:

- MCP tools invoked from an IDE or agent client
- a Campfire bot webhook interface for chat-driven commands

Both entry points must share the same adapter and workflow layers.

## Why This Project Exists

This is a portfolio project for a defense-platform engineering context. It should demonstrate:

1. sound MCP server design
2. workflow-oriented tool composition rather than raw API wrapping
3. self-hosted, air-gappable system thinking
4. a full development loop from task pickup through merge and status reporting

## Core Constraints

- Zero SaaS dependency in the production architecture
- All application services run as OCI containers
- The solution is disposable locally and transferable to any cloud environment that can run containers
- The MCP layer is model-agnostic
- The app layer stays cloud-neutral
- External integrations are environment-driven, not hardcoded

## Deliverable Shape

The final system should include:

- the MCP server
- the Campfire bot webhook handler
- a shared adapter/workflow layer
- a tiny `sample-service` used as the coding target in the demo
- local container orchestration
- example deployment artifacts for cloud portability

## Non-Goals

- Building a provider-specific cloud control plane
- Tying the solution to public `github.com`
- Requiring host-installed language runtimes for normal use
- Using WebAssembly as the main application runtime
