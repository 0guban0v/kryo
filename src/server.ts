import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerBugTriagePrompt } from "./prompts/bug-triage.js";
import { registerCodeReviewPrompt } from "./prompts/code-review.js";
import { registerBoardStatusResource } from "./resources/board-status.js";
import { registerRecentMessagesResource } from "./resources/recent-messages.js";
import type { MissionControlServices } from "./runtime.js";
import { registerCompleteWorkTool } from "./tools/complete-work.js";
import { registerCreateCardTool } from "./tools/create-card.js";
import { registerPickUpWorkTool } from "./tools/pick-up-work.js";
import { registerReportBlockerTool } from "./tools/report-blocker.js";
import { registerSubmitForReviewTool } from "./tools/submit-for-review.js";
import { registerTroubleshootTool } from "./tools/troubleshoot.js";
import { registerUpdateProgressTool } from "./tools/update-progress.js";
import { AsyncMutex } from "./utils/async-mutex.js";
import { VERSION } from "./version.js";

export function createMissionControlServer(
  services: MissionControlServices,
): McpServer {
  const server = new McpServer(
    {
      name: "kryo-mcp",
      title: "Kryo MCP Server",
      version: VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  const mutex = new AsyncMutex();

  registerPickUpWorkTool(server, services, mutex);
  registerUpdateProgressTool(server, services, mutex);
  registerSubmitForReviewTool(server, services, mutex);
  registerCompleteWorkTool(server, services, mutex);
  registerReportBlockerTool(server, services, mutex);
  registerCreateCardTool(server, services, mutex);
  registerTroubleshootTool(server, services, mutex);

  registerBoardStatusResource(server, services);
  registerRecentMessagesResource(server, services);

  registerCodeReviewPrompt(server);
  registerBugTriagePrompt(server);

  return server;
}
