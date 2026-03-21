# Demo And Validation

## Local Setup

- Build and start the full stack with `docker compose up --build`
- Create a Fizzy board called `Kryo`
- Add workflow columns such as `Triage`, `To Do`, `In Progress`, `Review`, `Done`, and `Blocked`
- Create a few starter cards
- Configure a Campfire room for status reporting
- Configure the MCP client to talk to the running server

## Demo Narrative

### 1. Show The Stack

Demonstrate that Fizzy, Campfire, the MCP server, and the sample service all run as containers.

### 2. Pick Up Work

Show the agent picking up the next task and updating both Fizzy and Campfire.

### 3. Implement The Feature

Use the agent to add the missing `/health` endpoint in the demo service.

### 4. Run Tests

Run tests inside the service container and show the previously failing expectation now passing.

### 5. Submit And Complete Work

Create a PR on the configured forge, move the card to review, then merge and move it to done.

### 6. Show Failure Handling

Break a test intentionally, run `troubleshoot`, and show blocker reporting in both Fizzy and Campfire.

## Validation Checklist

- The full stack starts from containers alone
- The MCP server works in local `stdio` mode
- The MCP server works in streamable HTTP mode for deployed scenarios
- The Campfire bot responds correctly to chat commands
- The workflow tools update Fizzy, Campfire, and the git forge coherently
- The demo-service tests run inside containers
- Recreating the stack does not require host-level dependency reinstall
