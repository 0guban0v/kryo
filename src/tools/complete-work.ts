import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MissionControlServices } from "../runtime.js";
import type { AsyncMutex } from "../utils/async-mutex.js";
import { completeWork } from "../workflows/complete-work.js";
import { registerWorkflowTool } from "./shared.js";

export function registerCompleteWorkTool(
  server: McpServer,
  services: MissionControlServices,
  mutex: AsyncMutex,
): void {
  registerWorkflowTool(
    server,
    mutex,
    "complete_work",
    {
      description:
        "Merge a GitHub pull request when checks have passed, move the linked Fizzy card to Done, and notify Campfire.",
      inputSchema: {
        card_id: z
          .union([z.string(), z.number()])
          .describe(
            "Fizzy card reference. Accepts card number, card ID, or card URL.",
          ),
        pr_number: z
          .number()
          .int()
          .positive()
          .describe("GitHub pull request number."),
        repo: z
          .string()
          .optional()
          .describe(
            "Git forge repo in owner/name format. Defaults to GIT_FORGE_REPO and is rejected unless GIT_FORGE_ALLOW_REPO_OVERRIDE=true.",
          ),
      },
    },
    async (args) =>
      completeWork(services, {
        cardId:
          typeof args.card_id === "string" || typeof args.card_id === "number"
            ? args.card_id
            : (() => {
                throw new Error("card_id must be a string or number.");
              })(),
        prNumber: Number(args.pr_number),
        repo: typeof args.repo === "string" ? args.repo : undefined,
      }),
  );
}
