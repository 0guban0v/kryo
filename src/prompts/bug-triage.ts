import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerBugTriagePrompt(server: McpServer): void {
  server.registerPrompt(
    "bug-triage",
    {
      title: "Bug Triage",
      description:
        "Structured bug analysis prompt for reducing raw errors into an actionable triage note.",
      argsSchema: {
        error_output: z.string().describe("Raw error output or logs."),
        context: z
          .string()
          .optional()
          .describe("Optional note describing what was happening."),
      },
    },
    async ({ error_output, context }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze this error and provide:
1. Root cause in 1-2 sentences
2. Impact
3. Suggested fix
4. Priority recommendation (p0, p1, or p2)

Error:
${error_output}

Context:
${context ?? "Not provided"}`,
          },
        },
      ],
    }),
  );
}
