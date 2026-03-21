import { randomUUID } from "node:crypto";

import { serve } from "@hono/node-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger as honoLogger } from "hono/logger";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import type { MissionControlServices } from "./runtime.js";
import { createMissionControlServer } from "./server.js";

interface StreamableSession {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
}

export interface HttpServerHandle {
  close(callback: (error?: Error | null) => void): void;
}

export function createMissionControlHttpApp(host: string): Hono {
  const app = new Hono();

  app.use("*", honoLogger());
  app.use("*", async (context, next) => {
    const response = validateHostHeader(context, host);

    if (response) {
      return response;
    }

    await next();
  });

  return app;
}

export function registerMcpHttpRoutes(
  app: Hono,
  services: MissionControlServices,
): void {
  if (services.config.mcp.transport === "streamable-http") {
    registerStreamableHttpRoutes(app, services);
  }
}

function registerStreamableHttpRoutes(
  app: Hono,
  services: MissionControlServices,
): void {
  const sessions: Record<string, StreamableSession> = {};

  app.all(services.config.mcp.path, async (context) => {
    const sessionId = context.req.header("mcp-session-id");

    try {
      if (sessionId && sessions[sessionId]) {
        return sessions[sessionId].transport.handleRequest(context.req.raw);
      }

      if (context.req.method === "POST" && !sessionId) {
        const parsedBody = await tryParseJsonBody(context);

        if (parsedBody && isInitializeRequest(parsedBody)) {
          const server = createMissionControlServer(services);
          const transport = new WebStandardStreamableHTTPServerTransport({
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

          await server.connect(transport);
          return transport.handleRequest(context.req.raw, {
            parsedBody,
          });
        }
      }

      if (context.req.method === "POST") {
        return context.json(
          {
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid MCP session ID provided",
            },
            id: null,
          },
          400,
        );
      }

      if (sessionId && sessions[sessionId]) {
        return sessions[sessionId].transport.handleRequest(context.req.raw);
      }

      if (context.req.method === "GET" || context.req.method === "DELETE") {
        return context.text("Invalid or missing MCP session ID", 400);
      }

      throw new HTTPException(405, {
        message: `Unsupported MCP method ${context.req.method}`,
      });
    } catch (error) {
      services.logger.error("Streamable MCP request failed.", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HTTPException) {
        throw error;
      }

      return context.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        },
        500,
      );
    }
  });
}

async function tryParseJsonBody(context: Context): Promise<unknown | null> {
  try {
    return await context.req.raw.clone().json();
  } catch {
    return null;
  }
}

function validateHostHeader(context: Context, host: string): Response | null {
  const localhostHosts = new Set(["127.0.0.1", "localhost", "::1"]);

  if (!localhostHosts.has(host)) {
    return null;
  }

  const hostHeader = context.req.header("host");

  if (!hostHeader) {
    return context.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Missing Host header",
        },
        id: null,
      },
      403,
    );
  }

  try {
    const hostname = new URL(`http://${hostHeader}`).hostname;

    if (!localhostHosts.has(hostname)) {
      return context.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: `Invalid Host: ${hostname}`,
          },
          id: null,
        },
        403,
      );
    }
  } catch {
    return context.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Invalid Host header: ${hostHeader}`,
        },
        id: null,
      },
      403,
    );
  }

  return null;
}

export function startHttpServer(
  app: Hono,
  host: string,
  port: number,
): Promise<HttpServerHandle> {
  return Promise.resolve(
    serve({
      fetch: app.fetch,
      hostname: host,
      port,
    }) as HttpServerHandle,
  );
}
