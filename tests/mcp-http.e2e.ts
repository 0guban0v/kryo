import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const mcpE2eUrl = process.env.MCP_E2E_URL ?? "http://127.0.0.1:3100/mcp";

test("live MCP HTTP endpoint initializes and exposes the expected surface", async () => {
  const client = new Client({
    name: "kryo-mcp-http-e2e",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(mcpE2eUrl));

  try {
    await client.connect(transport as Parameters<typeof client.connect>[0]);

    const tools = await client.listTools();
    const toolNames = new Set(tools.tools.map((tool) => tool.name));
    assert.ok(toolNames.has("pick_up_work"));
    assert.ok(toolNames.has("update_progress"));
    assert.ok(toolNames.has("submit_for_review"));
    assert.ok(toolNames.has("complete_work"));
    assert.ok(toolNames.has("report_blocker"));
    assert.ok(toolNames.has("create_card"));
    assert.ok(toolNames.has("troubleshoot"));

    const prompts = await client.listPrompts();
    const promptNames = new Set(prompts.prompts.map((prompt) => prompt.name));
    assert.ok(promptNames.has("code-review"));
    assert.ok(promptNames.has("bug-triage"));

    const resources = await client.listResources();
    assert.ok(Array.isArray(resources.resources));
  } finally {
    await transport.close();
  }
});
