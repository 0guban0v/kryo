import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import {
  createMissionControlHttpApp,
  registerMcpHttpRoutes,
  startHttpServer,
} from "./http-server.js";
import { Logger } from "./logger.js";
import { createServices } from "./runtime.js";
import { createMissionControlServer } from "./server.js";
import { errorMessage } from "./utils/http.js";

const config = loadConfig();
const logger = new Logger(config.logLevel);
const services = createServices(config, logger);
const app = createMissionControlHttpApp(config.mcp.allowedHosts);

const mcpHttpRuntime = registerMcpHttpRoutes(app, services);

const httpServer = await startHttpServer(app, config.mcp.host, config.mcp.port);
logger.info("HTTP server listening.", {
  host: config.mcp.host,
  port: config.mcp.port,
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

  const httpClosePromise = new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const activeSessionCount = mcpHttpRuntime.activeSessionCount();
  if (activeSessionCount > 0) {
    logger.info("Closing active MCP HTTP sessions before exit.", {
      activeSessionCount,
    });
  }

  await mcpHttpRuntime.closeActiveSessions().catch((error) => {
    logger.warn("Closing MCP HTTP sessions encountered an error.", {
      error: errorMessage(error),
    });
  });

  await Promise.race([
    httpClosePromise,
    new Promise<void>((resolve) => {
      setTimeout(resolve, 5_000);
    }),
  ]).catch((error) => {
    logger.warn("HTTP shutdown encountered an error.", {
      error: errorMessage(error),
    });
  });

  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
