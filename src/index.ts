import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerCampfireBotRoutes } from "./bot/server.js";
import { loadConfig } from "./config.js";
import {
  createMissionControlHttpApp,
  registerMcpHttpRoutes,
  startHttpServer,
} from "./http-server.js";
import { Logger } from "./logger.js";
import { createServices } from "./runtime.js";
import { createMissionControlServer } from "./server.js";

const config = loadConfig();
const logger = new Logger(config.logLevel);
const services = createServices(config, logger);
const app = createMissionControlHttpApp(config.mcp.host);

registerCampfireBotRoutes(app, services);
registerMcpHttpRoutes(app, services);

const httpServer = await startHttpServer(app, config.mcp.host, config.mcp.port);
logger.info("HTTP server listening.", {
  host: config.mcp.host,
  port: config.mcp.port,
  botWebhookPath: config.bot.webhookPath,
  mcpTransport: config.mcp.transport,
});

let stdioServer: ReturnType<typeof createMissionControlServer> | undefined;

if (config.mcp.transport === "stdio") {
  stdioServer = createMissionControlServer(services);
  await stdioServer.connect(new StdioServerTransport());
  logger.info("MCP stdio transport connected.");
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down.`);

  await stdioServer?.close().catch(() => undefined);

  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  }).catch((error) => {
    logger.warn("HTTP shutdown encountered an error.", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
