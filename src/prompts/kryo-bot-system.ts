import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KRYO_BOT_SYSTEM_PROMPT } from "../bot/system-prompt.js";

export function registerKryoBotSystemPrompt(server: McpServer): void {
  server.registerPrompt(
    "kryo-bot-system",
    {
      title: "Kryo Bot System Prompt",
      description:
        "System prompt for the Campfire-facing Kryo bot persona and action policy.",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: KRYO_BOT_SYSTEM_PROMPT,
          },
        },
      ],
    }),
  );
}
