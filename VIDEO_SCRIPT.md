# Video Script

## Setup before recording

- Run `docker compose up -d`
- Create a Fizzy board named `Kryo`
- Add columns: `To Do`, `In Progress`, `Review`, `Done`, `Blocked`
- Add a card such as `Add health check endpoint to mission-api`
- Create a Campfire room such as `engineering`
- Configure the MCP client to use `kryo-mcp`

## Recording flow

### 0:00 Intro

Explain that the stack is self-hosted, MCP-driven, and meant for defense or other controlled environments where SaaS and data egress are a problem.

### 0:30 Show the tools

- Open Fizzy and show the board
- Open Campfire and show the room
- Mention that both are self-hosted and the MCP server coordinates them

### 1:00 Pick up work

- Ask the agent to pick up the next task
- Show the card move to `In Progress`
- Show the Campfire status update

### 1:45 Implement the feature

- Let the agent inspect `examples/demo-service`
- The agent notices the missing `/health` route and failing test
- The agent adds the route and fixes the test

### 3:15 Run tests and self-review

- Run the sample service tests
- Ask the agent to use the `code-review` prompt against its diff

### 4:00 Submit for review

- Ask the agent to call `submit_for_review`
- Show the new PR link in GitHub
- Show the PR link comment on the Fizzy card
- Show the card moving to `Review`

### 4:45 Complete work

- After checks pass, ask the agent to call `complete_work`
- Show the merge
- Show the card move to `Done`
- Show the Campfire summary

### 5:30 Troubleshooting branch

- Reintroduce a failing test or config issue
- Ask the agent to call `troubleshoot`
- Show the structured troubleshooting comment on the card
- Optionally create a follow-up card with `create_card`

### 6:15 Close

Summarize the design:

- workflow-oriented MCP tools
- shared adapter layer for both MCP and Campfire bot flows
- self-hostable collaboration stack
- transport flexibility: stdio and streamable HTTP
