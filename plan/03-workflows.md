# Workflows

## Design Principle

Tools should represent user intent, not one-to-one API calls. A single tool may orchestrate multiple Fizzy, Campfire, and git forge requests behind one stable surface.

## MCP Tools

### `pick_up_work`

Find the next available card from a target board or column, assign it if appropriate, move it to `In Progress`, and notify Campfire.

Suggested inputs:

- `board_id`
- `priority_tag` optional

### `update_progress`

Move a card to another workflow state or column and post an optional status update.

Suggested inputs:

- `card_id`
- `target_column`
- `message` optional

### `submit_for_review`

Create a PR on the configured git forge, comment the link back to Fizzy, move the card to `Review`, and notify Campfire.

Suggested inputs:

- `card_id`
- `repo`
- `branch`
- `base` optional
- `title`
- `body` optional

### `complete_work`

Inspect PR checks, merge the PR if eligible, move the card to `Done`, and notify Campfire.

Suggested inputs:

- `card_id`
- `pr_number`
- `repo`

### `report_blocker`

Move a card to `Blocked`, add context to the card, and notify Campfire.

Suggested inputs:

- `card_id`
- `reason`
- `error_output` optional

### `create_card`

Create a new Fizzy card for follow-up work, discovered bugs, or new tasks.

Suggested inputs:

- `board_id`
- `title`
- `body` optional
- `column` optional
- `tags` optional

### `troubleshoot`

Analyze failures, summarize likely root cause, and publish the findings to both Fizzy and Campfire.

Suggested inputs:

- `card_id`
- `error_output`
- `context` optional

## Campfire Bot Commands

The chat-driven entry point should expose a small, opinionated command set:

- `board status`
- `what's blocked`
- `pick up next`
- `create card`
- `help`

These commands should route into the same workflow layer used by MCP tools rather than reimplementing logic in the bot handler.

## MCP Resources

### `board://status/{board_id}`

Read-only board status summary with columns, counts, and current notable work.

### `chat://recent/{room_id}`

Recent Campfire room context useful to the agent without requiring a tool invocation.

## MCP Prompts

### `code-review`

Structured review prompt focused on:

1. correctness
2. security
3. style and conventions
4. tests

### `bug-triage`

Structured failure-analysis prompt focused on:

1. root cause
2. impact
3. suggested fix
4. priority
