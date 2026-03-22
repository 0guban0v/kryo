import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MissionControlServices } from "../runtime.js";
import type { AsyncMutex } from "../utils/async-mutex.js";
import { submitForReview } from "../workflows/submit-for-review.js";
import { registerWorkflowTool } from "./shared.js";

export function registerSubmitForReviewTool(
  server: McpServer,
  services: MissionControlServices,
  mutex: AsyncMutex,
): void {
  registerWorkflowTool(
    server,
    mutex,
    "submit_for_review",
    {
      description:
        "Create a GitHub pull request for the current work, comment the PR link on the Fizzy card, move the card to Review, and notify Campfire.",
      inputSchema: {
        card_id: z
          .union([z.string(), z.number()])
          .describe(
            "Fizzy card reference. Accepts card number, card ID, or card URL.",
          ),
        repo: z
          .string()
          .optional()
          .describe(
            "Git forge repo in owner/name format. Defaults to GIT_FORGE_REPO and is rejected unless GIT_FORGE_ALLOW_REPO_OVERRIDE=true.",
          ),
        branch: z
          .string()
          .describe("Source branch name to open the pull request from."),
        base: z
          .string()
          .optional()
          .describe("Target branch. Defaults to GIT_FORGE_DEFAULT_BRANCH."),
        title: z.string().describe("Pull request title."),
        body: z
          .string()
          .optional()
          .describe("Optional pull request description."),
      },
    },
    async (args) =>
      submitForReview(services, {
        cardId:
          typeof args.card_id === "string" || typeof args.card_id === "number"
            ? args.card_id
            : (() => {
                throw new Error("card_id must be a string or number.");
              })(),
        repo: typeof args.repo === "string" ? args.repo : undefined,
        branch: String(args.branch),
        base: typeof args.base === "string" ? args.base : undefined,
        title: String(args.title),
        body: typeof args.body === "string" ? args.body : undefined,
      }),
  );
}
