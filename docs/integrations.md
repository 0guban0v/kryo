# Integrations

## MCP Tools

- `pick_up_work`
- `update_progress`
- `submit_for_review`
- `complete_work`
- `report_blocker`
- `create_card`
- `troubleshoot`

## Resources

- `board://status/{boardId}`
- `chat://recent/{roomId}`

`chat://recent/{roomId}` uses direct Campfire API reads only when `CAMPFIRE_SESSION_COOKIE` is configured. Otherwise it falls back to the in-memory transcript built from webhook and bot activity.

## Prompts

- `code-review`
- `bug-triage`

## Campfire Bot Commands

- `board status`
- `what's blocked`
- `pick up next`
- `pick up next #p0`
- `create card Fix auth timeout | API calls fail after 7 seconds #bug`
- `help`

## Git Forge Compatibility

The adapter is base-URL driven and provider-aware.

- `GIT_FORGE_PROVIDER=github|ghes|gitea`
- `GIT_FORGE_API_URL`
- `GIT_FORGE_TOKEN`
- `GIT_FORGE_REPO`
- `GIT_FORGE_ALLOW_REPO_OVERRIDE=false` by default, which rejects explicit repo overrides when `GIT_FORGE_REPO` is configured

Gitea and Forgejo use `Authorization: token ...`. GHES and GitHub use bearer auth. The workflow tool surface stays the same across providers.
