import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Express } from "express";

import type { MissionControlServices } from "./runtime.js";
import { createMissionControlServer } from "./server.js";

interface StreamableSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

export function createMissionControlExpressApp(host: string): Express {
  return createMcpExpressApp({ host });
}

export function registerMcpHttpRoutes(
  app: Express,
  services: MissionControlServices,
): void {
  if (services.config.mcp.transport === "streamable-http") {
    registerStreamableHttpRoutes(app, services);
  }
}

function registerStreamableHttpRoutes(
  app: Express,
  services: MissionControlServices,
): void {
  const sessions: Record<string, StreamableSession> = {};

  app.post(services.config.mcp.path, async (request, response) => {
    const sessionIdHeader = request.headers["mcp-session-id"];
    const sessionId =
      typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;

    try {
      if (sessionId && sessions[sessionId]) {
        await sessions[sessionId].transport.handleRequest(
          request,
          response,
          request.body,
        );
        return;
      }

      if (!sessionId && isInitializeRequest(request.body)) {
        const server = createMissionControlServer(services);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (generatedSessionId) => {
            sessions[generatedSessionId] = { server, transport };
          },
        });

        transport.onclose = async () => {
          const currentSessionId = transport.sessionId;
          if (currentSessionId && sessions[currentSessionId]) {
            delete sessions[currentSessionId];
          }

          await server.close().catch(() => undefined);
        };

        await server.connect(transport as unknown as Transport);
        await transport.handleRequest(request, response, request.body);
        return;
      }

      response.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid MCP session ID provided",
        },
        id: null,
      });
    } catch (error) {
      services.logger.error("Streamable MCP request failed.", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  app.get(services.config.mcp.path, async (request, response) => {
    const sessionIdHeader = request.headers["mcp-session-id"];
    const sessionId =
      typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;

    if (!sessionId || !sessions[sessionId]) {
      response.status(400).send("Invalid or missing MCP session ID");
      return;
    }

    await sessions[sessionId].transport.handleRequest(request, response);
  });

  app.delete(services.config.mcp.path, async (request, response) => {
    const sessionIdHeader = request.headers["mcp-session-id"];
    const sessionId =
      typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;

    if (!sessionId || !sessions[sessionId]) {
      response.status(400).send("Invalid or missing MCP session ID");
      return;
    }

    await sessions[sessionId].transport.handleRequest(request, response);
  });
}

export function startHttpServer(
  app: Express,
  host: string,
  port: number,
): Promise<HttpServer> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on("error", reject);
  });
}
