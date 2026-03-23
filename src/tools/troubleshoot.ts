import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MissionControlServices } from "../runtime.js";
import type { AsyncMutex } from "../utils/async-mutex.js";
import { troubleshoot } from "../workflows/troubleshoot.js";
import { registerWorkflowTool } from "./shared.js";

export function registerTroubleshootTool(
  server: McpServer,
  services: MissionControlServices,
  mutex: AsyncMutex,
): void {
  registerWorkflowTool(
    server,
    mutex,
    "troubleshoot",
    {
      description:
        "Analyze a failing test or error log and attach a structured troubleshooting comment to the Fizzy card.",
      inputSchema: {
        card_id: z
          .union([z.string(), z.number()])
          .describe(
            "Fizzy card reference. Accepts card number, card ID, or card URL.",
          ),
        error_output: z
          .string()
          .describe("Raw error log or test output to analyze."),
        context: z
          .string()
          .optional()
          .describe(
            "Optional note about what the agent was attempting when the error occurred.",
          ),
      },
    },
    async (args) =>
      troubleshoot(services, {
        cardId:
          typeof args.card_id === "string" || typeof args.card_id === "number"
            ? args.card_id
            : (() => {
                throw new Error("card_id must be a string or number.");
              })(),
        errorOutput: String(args.error_output),
        context: typeof args.context === "string" ? args.context : undefined,
      }),
  );
}
