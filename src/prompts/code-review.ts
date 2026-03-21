import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerCodeReviewPrompt(server: McpServer): void {
  server.registerPrompt(
    "code-review",
    {
      title: "Code Review",
      description:
        "Structured review prompt for checking a diff against the linked Fizzy card requirements.",
      argsSchema: {
        card_title: z.string().describe("Card title."),
        card_body: z
          .string()
          .describe("Card description or acceptance criteria."),
        diff: z.string().describe("Diff to review."),
      },
    },
    async ({ card_title, card_body, diff }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review the following diff for:
1. Correctness - does it satisfy the card requirements?
2. Security - any obvious vulnerabilities or unsafe assumptions?
3. Style - does it fit the project conventions?
4. Tests - are the current and missing tests sufficient?

Card: ${card_title}
Card description: ${card_body}
Diff:
${diff}

Respond with APPROVE, REQUEST_CHANGES, or COMMENT and include specific line-level feedback.`,
          },
        },
      ],
    }),
  );
}
