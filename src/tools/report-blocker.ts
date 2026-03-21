import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MissionControlServices } from "../runtime.js";
import type { AsyncMutex } from "../utils/async-mutex.js";
import { reportBlocker } from "../workflows/report-blocker.js";
import { registerWorkflowTool } from "./shared.js";

export function registerReportBlockerTool(
  server: McpServer,
  services: MissionControlServices,
  mutex: AsyncMutex,
): void {
  registerWorkflowTool(
    server,
    mutex,
    "report_blocker",
    {
      description:
        "Move a Fizzy card into Blocked when possible, add a blocker comment with context, and notify Campfire.",
      inputSchema: {
        card_id: z
          .union([z.string(), z.number()])
          .describe(
            "Fizzy card reference. Accepts card number, card ID, or card URL.",
          ),
        reason: z
          .string()
          .describe("Short explanation of what is blocking progress."),
        error_output: z
          .string()
          .optional()
          .describe(
            "Optional logs or test output to include in the blocker report.",
          ),
      },
    },
    async (args) =>
      reportBlocker(services, {
        cardId:
          typeof args.card_id === "string" || typeof args.card_id === "number"
            ? args.card_id
            : (() => {
                throw new Error("card_id must be a string or number.");
              })(),
        reason: String(args.reason),
        errorOutput:
          typeof args.error_output === "string" ? args.error_output : undefined,
      }),
  );
}
