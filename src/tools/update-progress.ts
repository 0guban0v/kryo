import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MissionControlServices } from "../runtime.js";
import type { AsyncMutex } from "../utils/async-mutex.js";
import { updateProgress } from "../workflows/update-progress.js";
import { registerWorkflowTool } from "./shared.js";

export function registerUpdateProgressTool(
  server: McpServer,
  services: MissionControlServices,
  mutex: AsyncMutex,
): void {
  registerWorkflowTool(
    server,
    mutex,
    "update_progress",
    {
      description:
        "Move a Fizzy card to a target column or lifecycle state and notify Campfire with an optional status message.",
      inputSchema: {
        card_id: z
          .union([z.string(), z.number()])
          .describe(
            "Fizzy card reference. Accepts card number, card ID, or card URL.",
          ),
        target_column: z
          .string()
          .describe(
            "Column or state name, such as Review, Done, Blocked, or Triage.",
          ),
        message: z
          .string()
          .optional()
          .describe(
            "Optional status message to include in the Campfire notification.",
          ),
      },
    },
    async (args) =>
      updateProgress(services, {
        cardId:
          typeof args.card_id === "string" || typeof args.card_id === "number"
            ? args.card_id
            : (() => {
                throw new Error("card_id must be a string or number.");
              })(),
        targetColumn: String(args.target_column),
        message: typeof args.message === "string" ? args.message : undefined,
      }),
  );
}
