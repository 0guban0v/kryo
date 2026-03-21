# Implementation Plan

## Current Credibility Foundation

These repo-level foundation items are now in place:

1. a production-grade `Dockerfile` for `mission-control-mcp`
2. a `sample-service/Dockerfile`
3. `.dockerignore` files
4. baseline workflow-layer unit tests
5. starter deployment manifests under `deploy/`
6. a baseline CI pipeline for build, test, and image validation
7. explicit security-boundary and Infisical documentation

## Next Hardening Priorities

1. expand workflow-layer tests beyond the first baseline scenarios
2. wire deployed runtime secrets through Infisical-backed delivery instead of only documenting the contract
3. strengthen the deployed bot boundary at ingress or service-mesh level
4. add a fuller cloud deployment example, including ingress and TLS termination

## Phase 1: Container-First Scaffold

1. Create a multi-stage `Dockerfile` for `mission-control-mcp`.
2. Create `sample-service/Dockerfile`.
3. Add `.dockerignore` files.
4. Create `docker-compose.yml` with `mission-control-mcp`, `sample-service`, `fizzy`, and `campfire`.
5. Make installs, builds, tests, and dev commands run inside containers.
6. Initialize the TypeScript project and minimal boot path inside the containerized workflow.

## Phase 2: Shared Adapters

1. Build the Fizzy adapter.
2. Build the Campfire adapter.
3. Build the provider-aware git forge adapter.
4. Keep adapter outputs structured and useful for both tools and bot flows.

## Phase 3: MCP Runtime

1. Register the workflow tools.
2. Register resources and prompts.
3. Support both `stdio` and HTTP-based transport modes.
4. Add concurrency and error-handling rules appropriate for tool execution.
5. Add unit tests for the workflow layer before claiming production readiness.

## Phase 4: Campfire Bot

1. Build the webhook listener.
2. Parse bot commands from plain-text message content.
3. Route commands into the shared workflow layer.
4. Return simple, readable responses suitable for Campfire chat.
5. Add boundary authentication and webhook hardening appropriate to Campfire's unsigned webhook model.

## Phase 5: Sample Service

1. Build the demo app with a small API surface.
2. Add one failing health-check expectation so the workflow has a real coding task.
3. Make tests runnable in-container.

## Phase 6: Security, Secrets, And Portability

1. Make the full stack runnable via `docker compose up --build`.
2. Verify inter-service networking through service DNS.
3. Integrate Infisical as the source of truth for runtime secrets.
4. Add example deployment manifests under `deploy/compose/` and `deploy/kubernetes/`.
5. Keep application code ignorant of the deployment target.

## Phase 7: Docs And UX

1. Write a README centered on the container-first workflow.
2. Document tool behavior and deployment assumptions.
3. Explain the air-gapped and cloud-transferable story clearly.

## Phase 8: Validation

1. Test MCP inspection against the running containerized server.
2. Exercise each tool individually.
3. Run the full lifecycle flow end to end.
4. Destroy and recreate the local stack to prove disposability.
5. Verify that secrets are delivered through Infisical rather than checked-in runtime configuration.
6. Run the same baseline checks in CI so build and test expectations are not manual-only.
