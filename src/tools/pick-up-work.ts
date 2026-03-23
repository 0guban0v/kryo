import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MissionControlServices } from "../runtime.js";
import type { AsyncMutex } from "../utils/async-mutex.js";
import { pickUpWork } from "../workflows/pick-up-work.js";
import { registerWorkflowTool } from "./shared.js";

export function registerPickUpWorkTool(
  server: McpServer,
  services: MissionControlServices,
  mutex: AsyncMutex,
): void {
  registerWorkflowTool(
    server,
    mutex,
    "pick_up_work",
    {
      description:
        "Pick up the next available card from the To Do queue, assign it to the current Fizzy user, and move it to In Progress.",
      inputSchema: {
        board_id: z
          .string()
          .optional()
          .describe(
            "Fizzy board ID or board name. Defaults to FIZZY_BOARD_ID.",
          ),
        priority_tag: z
          .string()
          .optional()
          .describe("Optional tag filter, such as urgent or p0."),
        target_column_name: z
          .string()
          .optional()
          .describe(
            "Column name to move the selected card into. Defaults to In Progress.",
          ),
      },
    },
    async (args) =>
      pickUpWork(services, {
        boardId: typeof args.board_id === "string" ? args.board_id : undefined,
        priorityTag:
          typeof args.priority_tag === "string" ? args.priority_tag : undefined,
        targetColumnName:
          typeof args.target_column_name === "string"
            ? args.target_column_name
            : undefined,
      }),
  );
}
