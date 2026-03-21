import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";

import type { WorkflowResult } from "../types.js";
import type { AsyncMutex } from "../utils/async-mutex.js";
import { errorMessage } from "../utils/http.js";

type ToolConfig = {
  description: string;
  inputSchema?: ZodRawShape;
  annotations?: Record<string, unknown>;
};

function toCallToolResult(result: WorkflowResult): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: result.markdown,
      },
    ],
  };
}

function toToolError(error: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: errorMessage(error),
      },
    ],
    isError: true,
  };
}

export function registerWorkflowTool(
  server: McpServer,
  mutex: AsyncMutex,
  name: string,
  config: ToolConfig,
  handler: (args: Record<string, unknown>) => Promise<WorkflowResult>,
): void {
  server.registerTool(name, config, async (args: Record<string, unknown>) =>
    mutex.runExclusive(async () => {
      try {
        return toCallToolResult(
          await handler((args ?? {}) as Record<string, unknown>),
        );
      } catch (error) {
        return toToolError(error);
      }
    }),
  );
}
