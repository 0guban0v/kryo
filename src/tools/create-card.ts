import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MissionControlServices } from "../runtime.js";
import type { AsyncMutex } from "../utils/async-mutex.js";
import { createCard } from "../workflows/create-card.js";
import { registerWorkflowTool } from "./shared.js";

export function registerCreateCardTool(
  server: McpServer,
  services: MissionControlServices,
  mutex: AsyncMutex,
): void {
  registerWorkflowTool(
    server,
    mutex,
    "create_card",
    {
      description:
        "Create a new Fizzy card, optionally tag it, and place it in a target column.",
      inputSchema: {
        board_id: z
          .string()
          .optional()
          .describe(
            "Fizzy board ID or board name. Defaults to FIZZY_BOARD_ID.",
          ),
        title: z.string().describe("Card title."),
        body: z.string().optional().describe("Optional card description."),
        column: z
          .string()
          .optional()
          .describe(
            "Optional target column or state, such as Triage, Review, or Done.",
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe("Optional list of tag names."),
      },
    },
    async (args) =>
      createCard(services, {
        boardId: typeof args.board_id === "string" ? args.board_id : undefined,
        title: String(args.title),
        body: typeof args.body === "string" ? args.body : undefined,
        column: typeof args.column === "string" ? args.column : undefined,
        tags: Array.isArray(args.tags)
          ? args.tags.map((value) => String(value))
          : undefined,
      }),
  );
}
