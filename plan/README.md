# Plan Index

This folder replaces the old single-file implementation prompt with a set of focused documents that are easier to revise one topic at a time.

## How To Use This Folder

1. Start with [`01-context.md`](./01-context.md) for constraints and outcomes.
2. Use [`02-architecture.md`](./02-architecture.md) when changing runtime shape, deployment model, or repo layout.
3. Use [`03-workflows.md`](./03-workflows.md) when changing tool behavior, bot commands, resources, or prompts.
4. Use [`04-integrations-and-config.md`](./04-integrations-and-config.md) when changing API assumptions, auth, or environment variables.
5. Use [`05-implementation-plan.md`](./05-implementation-plan.md) when changing execution order or milestone scope.
6. Use [`06-demo-and-validation.md`](./06-demo-and-validation.md) when changing the demo story or test loop.
7. Use [`07-decisions-questions-references.md`](./07-decisions-questions-references.md) for rationale, unresolved choices, and upstream references.
8. Use [`08-security-and-deployment.md`](./08-security-and-deployment.md) when changing secrets, TLS, webhook hardening, or deployment security boundaries.

## Editing Rules

- Keep each file narrowly scoped.
- Prefer updating the owning file instead of repeating the same guidance across multiple files.
- When a change affects multiple areas, update architecture first, then workflows or plan, then references.
- External APIs and framework behavior should be verified against the upstream repos in this workspace instead of copied wholesale into this folder.

## Current Scope

The plan assumes:

- container-first local development
- OCI-image portability to any cloud runtime
- self-hosted Fizzy and Campfire
- a GitHub-compatible git forge adapter
- one shared adapter layer used by both MCP tools and the Campfire bot
- self-hosted Infisical for secrets management
