# Demo Guide

This is a short, low-risk demo flow for a platform team.

Assumed humans in the loop:

- a PM
- an AI platform engineer

The demo shows how an agent can:

1. pick up a ticket from Fizzy
2. create a feature branch locally
3. implement a small fix in the target repository
4. run tests
5. open a pull request for review through `kryo`

The goal is reliability, not breadth.

## Demo Story

Use a single task with an obvious outcome:

- board card moves from `To Do` to `In Progress`
- code changes are small and easy to explain
- tests pass
- a PR appears in the git forge
- the card moves to `Review`

The strongest version of this story is:

- "The agent can coordinate work across planning, execution, and review using the same workflow state humans already use."

## Recommended Card

Board name:

`Demo Platform`

Title:

`Add /health endpoint to the target service`

Description:

```text
The platform team needs a simple health endpoint added to the target service so local demos and smoke checks have a stable readiness probe.

Acceptance criteria:
- GET /health returns HTTP 200
- response is JSON
- response includes {"status":"ok"}
- the relevant service tests pass
```

Recommended board columns:

- `To Do`
- `In Progress`
- `Review`
- `Done`
- `Blocked`

## Required Environment

These values must be real before recording:

- `SECRET_KEY_BASE`
- `FIZZY_URL`
- `FIZZY_ACCOUNT_ID`
- `FIZZY_API_TOKEN`
- `CAMPFIRE_URL`
- `CAMPFIRE_BOT_KEY` if you want proactive chat updates
- `CAMPFIRE_ROOM_ID`
- `FIZZY_BOARD_ID`
- `BOT_WEBHOOK_SHARED_SECRET`

Local browser sign-in defaults after `make bootstrap`:

- Fizzy: `fizzy-admin@demo.local` using the development magic-link flow
- Campfire: `campfire-admin@demo.local` / `campfire-admin`
- Gitea: `gitea-admin` / `gitea-admin`

Recommended git forge settings for the demo:

- `GIT_FORGE_PROVIDER=gitea`
- `GIT_FORGE_API_URL=http://kryo-gitea:3000/api/v1`
- `GIT_FORGE_REPO=kryo-service/target-service`
- `GIT_FORGE_ALLOW_REPO_OVERRIDE=false`
- `GIT_FORGE_DEFAULT_BRANCH=main`
- `GIT_FORGE_MERGE_METHOD=squash`
- `GIT_FORGE_SUPPORTS_CHECK_RUNS=false`

## Preflight Checklist

Run this before recording:

1. `make deploy`
2. confirm `make deploy` populated `FIZZY_ACCOUNT_ID`, `FIZZY_API_TOKEN`, `CAMPFIRE_ROOM_ID`, and `CAMPFIRE_BOT_KEY` in the selected env file
3. confirm Fizzy is reachable at `http://localhost:3006`
4. confirm Campfire is reachable at `http://localhost:3000`
5. confirm MCP health returns OK at `http://localhost:3100/up`
6. confirm the target board exists and contains the demo card
7. confirm the Campfire room exists
8. confirm `make bootstrap` populated `GIT_FORGE_API_URL`, `GIT_FORGE_TOKEN`, and `GIT_FORGE_REPO`
9. confirm Gitea is reachable at `http://localhost:3007`
10. confirm your local repo can push a demo branch
11. do one full dry run without recording

If using the online MCP HTTP test:

1. start the stack
2. run `make test-online`

## Recording Flow

Keep the recording to 4-5 minutes.

### 1. Show the systems

Open:

- Fizzy board
- Campfire room
- local repo

Explain:

- `kryo` is the workflow layer
- the coding agent does local git and code changes
- Fizzy and Campfire stay the source of truth for humans
- the PM owns the requirement and the platform engineer owns the delivery path

### 2. Pick up work

Prompt:

```text
Pick up the next task from the board using kryo.
```

Expected outcome:

- card moves to `In Progress`
- optional Campfire status message appears

### 3. Create a branch and implement the fix

Prompt:

```text
Create a local branch named feature/add-health-endpoint.
Inspect the target repository, implement the /health endpoint, and run the relevant tests.
```

Expected outcome:

- local branch created
- code change is small and reviewable
- tests pass

### 4. Push the branch

Prompt:

```text
Commit the change with a clear message and push feature/add-health-endpoint to origin.
```

Important:

- `submit_for_review` needs the branch to already exist on the forge

### 5. Open review

Prompt:

```text
Use kryo to submit this work for review for the active card.
Use branch feature/add-health-endpoint and generate a concise PR title and body from the task.
```

Expected outcome:

- PR created
- PR link added as a Fizzy comment
- card moves to `Review`
- optional Campfire update appears

### 6. Optional completion step

If checks are green and the PR is mergeable:

```text
Use kryo to complete the work for the active card and merge the PR.
```

## Safety Notes

For the demo, prefer:

- one small card
- one branch
- one PR
- one predictable test target

Avoid during the recording:

- bootstrap steps
- secret entry
- debugging Docker
- changing board/workflow config live
- large refactors

## Fast Failure Checks

If the demo fails, check these first:

- `FIZZY_API_TOKEN` is valid
- `GIT_FORGE_TOKEN` is valid
- `GIT_FORGE_REPO` is correct
- the branch was pushed before `submit_for_review`
- the card is on the expected board
- `CAMPFIRE_BOT_KEY` is set if you expect chat updates
- the MCP server is healthy on `http://localhost:3100/up`

## Exact Prompt Set

Use these in order:

```text
Pick up the next task from the board using kryo.
```

```text
Create a local branch named feature/add-health-endpoint.
Inspect the target repository, implement the /health endpoint, and run the relevant tests.
```

```text
Commit the change with message "Add health endpoint for platform demo" and push feature/add-health-endpoint to origin.
```

```text
Use kryo to submit this work for review for the active card.
Use branch feature/add-health-endpoint and create a concise PR title and body from the task.
```

```text
If the pull request checks are green, use kryo to complete the work and merge the PR.
```
