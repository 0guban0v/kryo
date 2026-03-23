import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";

import { serve } from "@hono/node-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger as honoLogger } from "hono/logger";

import type { MissionControlServices } from "./runtime.js";
import { createMissionControlServer } from "./server.js";
import { AsyncMutex } from "./utils/async-mutex.js";
import { normalizeHost } from "./utils/host.js";
import { errorMessage } from "./utils/http.js";

interface StreamableSession {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  lastSeenAt: number;
  closing: boolean;
}

export interface HttpServerHandle {
  close(callback: (error?: Error | null) => void): void;
}

export interface McpHttpRuntimeHandle {
  closeActiveSessions(): Promise<void>;
  activeSessionCount(): number;
}

type ParsedJsonBody = { ok: true; value: unknown } | { ok: false };

const NOOP_MCP_RUNTIME: McpHttpRuntimeHandle = {
  closeActiveSessions: async () => undefined,
  activeSessionCount: () => 0,
};

export function createMissionControlHttpApp(allowedHosts: string[]): Hono {
  if (allowedHosts.length === 0) {
    throw new Error(
      "createMissionControlHttpApp requires at least one allowed host.",
    );
  }

  const app = new Hono();
  const normalizedAllowedHosts = new Set(
    allowedHosts.map((host) => normalizeHost(host)),
  );

  app.use("*", honoLogger());
  app.use("*", async (context, next) => {
    const response = validateHostHeader(context, normalizedAllowedHosts);

    if (response) {
      return response;
    }

    await next();
  });

  app.get("/up", (context) => context.text("ok"));

  return app;
}

export function registerMcpHttpRoutes(
  app: Hono,
  services: MissionControlServices,
): McpHttpRuntimeHandle {
  if (services.config.mcp.transport === "streamable-http") {
    if (services.config.mcp.httpSessionMode === "stateless") {
      registerStatelessStreamableHttpRoutes(app, services);
      return NOOP_MCP_RUNTIME;
    }

    return registerStatefulStreamableHttpRoutes(app, services);
  }

  return NOOP_MCP_RUNTIME;
}

function registerStatefulStreamableHttpRoutes(
  app: Hono,
  services: MissionControlServices,
): McpHttpRuntimeHandle {
  const sessions: Record<string, StreamableSession> = {};
  let pendingInitializations = 0;
  const sessionLock = new AsyncMutex();

  app.all(services.config.mcp.path, async (context) => {
    const sessionId = context.req.header("mcp-session-id");

    try {
      const existingSession = await sessionLock.runExclusive(async () => {
        await evictExpiredSessions(
          sessions,
          services.config.mcp.sessionIdleTtlMs,
          Date.now(),
        );

        if (!sessionId) {
          return undefined;
        }

        const session = sessions[sessionId];

        if (session) {
          session.lastSeenAt = Date.now();
        }

        return session;
      });

      if (existingSession) {
        return existingSession.transport.handleRequest(context.req.raw);
      }

      if (context.req.method === "POST" && !sessionId) {
        const parsedBody = await parseJsonBody(context);

        if (!parsedBody.ok) {
          return jsonRpcError(context, 400, -32700, "Parse error");
        }

        if (isInitializeRequest(parsedBody.value)) {
          const server = createMissionControlServer(services);
          const initializedAt = Date.now();
          let admissionReserved = false;
          const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: async (generatedSessionId) => {
              await sessionLock.runExclusive(async () => {
                if (admissionReserved) {
                  pendingInitializations -= 1;
                  admissionReserved = false;
                }

                sessions[generatedSessionId] = {
                  server,
                  transport,
                  lastSeenAt: initializedAt,
                  closing: false,
                };
              });
            },
          });

          transport.onclose = async () => {
            const currentSessionId = transport.sessionId;
            if (currentSessionId) {
              await closeSession(sessions, currentSessionId);
            }
          };

          const admitted = await sessionLock.runExclusive(async () => {
            await evictExpiredSessions(
              sessions,
              services.config.mcp.sessionIdleTtlMs,
              Date.now(),
            );

            if (
              Object.keys(sessions).length + pendingInitializations >=
              services.config.mcp.maxSessions
            ) {
              return false;
            }

            pendingInitializations += 1;
            admissionReserved = true;
            return true;
          });

          if (!admitted) {
            return jsonRpcError(
              context,
              503,
              -32000,
              "Too many active MCP sessions",
            );
          }

          const releaseAdmission = async (): Promise<void> => {
            if (!admissionReserved) {
              return;
            }

            await sessionLock.runExclusive(async () => {
              if (admissionReserved) {
                pendingInitializations -= 1;
                admissionReserved = false;
              }
            });
          };

          try {
            await server.connect(transport);
            const response = await transport.handleRequest(context.req.raw, {
              parsedBody: parsedBody.value,
            });

            await releaseAdmission();
            return response;
          } catch (error) {
            await releaseAdmission();
            await transport.close().catch(() => undefined);
            await server.close().catch(() => undefined);
            throw error;
          }
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

      if (context.req.method === "GET" || context.req.method === "DELETE") {
        return context.text("Invalid or missing MCP session ID", 400);
      }

      throw new HTTPException(405, {
        message: `Unsupported MCP method ${context.req.method}`,
      });
    } catch (error) {
      return handleMcpRequestError(
        context,
        services,
        error,
        "Streamable MCP request failed.",
      );
    }
  });

  return {
    closeActiveSessions: async () => {
      await sessionLock.runExclusive(async () => {
        const sessionIds = Object.keys(sessions);
        await Promise.all(
          sessionIds.map((sessionId) =>
            closeSession(sessions, sessionId, { closeTransport: true }),
          ),
        );
      });
    },
    activeSessionCount: () => Object.keys(sessions).length,
  };
}

function registerStatelessStreamableHttpRoutes(
  app: Hono,
  services: MissionControlServices,
): void {
  app.all(services.config.mcp.path, async (context) => {
    try {
      const parsedBody =
        context.req.method === "POST"
          ? await parseJsonBody(context)
          : undefined;

      if (parsedBody && !parsedBody.ok) {
        return jsonRpcError(context, 400, -32700, "Parse error");
      }

      const server = createMissionControlServer(services);
      const transport = new WebStandardStreamableHTTPServerTransport();

      await server.connect(transport);
      return transport.handleRequest(context.req.raw, {
        ...(parsedBody?.ok ? { parsedBody: parsedBody.value } : {}),
      });
    } catch (error) {
      return handleMcpRequestError(
        context,
        services,
        error,
        "Stateless MCP request failed.",
      );
    }
  });
}

function handleMcpRequestError(
  context: Context,
  services: MissionControlServices,
  error: unknown,
  logMessage: string,
): Response {
  services.logger.error(logMessage, {
    error: errorMessage(error),
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

function jsonRpcError(
  context: Context,
  status: 400 | 403 | 500 | 503,
  code: number,
  message: string,
): Response {
  return context.json(
    {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: null,
    },
    { status },
  );
}

async function parseJsonBody(context: Context): Promise<ParsedJsonBody> {
  try {
    return { ok: true, value: await context.req.raw.clone().json() };
  } catch {
    return { ok: false };
  }
}

async function evictExpiredSessions(
  sessions: Record<string, StreamableSession>,
  sessionIdleTtlMs: number,
  now: number,
): Promise<void> {
  const expiredSessionIds = Object.entries(sessions)
    .filter(
      ([, session]) =>
        !session.closing && now - session.lastSeenAt > sessionIdleTtlMs,
    )
    .map(([sessionId]) => sessionId);

  await Promise.all(
    expiredSessionIds.map((sessionId) =>
      closeSession(sessions, sessionId, { closeTransport: true }),
    ),
  );
}

async function closeSession(
  sessions: Record<string, StreamableSession>,
  sessionId: string,
  options: { closeTransport?: boolean } = {},
): Promise<void> {
  const session = sessions[sessionId];

  if (!session || session.closing) {
    return;
  }

  session.closing = true;
  delete sessions[sessionId];

  if (options.closeTransport) {
    await session.transport.close().catch(() => undefined);
  }

  await session.server.close().catch(() => undefined);
}

function validateHostHeader(
  context: Context,
  allowedHosts: ReadonlySet<string>,
): Response | null {
  const hostHeader = context.req.header("host");

  if (!hostHeader) {
    return jsonRpcError(context, 403, -32000, "Missing Host header");
  }

  try {
    const hostname = normalizeHost(new URL(`http://${hostHeader}`).hostname);

    if (!allowedHosts.has(hostname)) {
      return jsonRpcError(context, 403, -32000, `Invalid Host: ${hostname}`);
    }
  } catch {
    return jsonRpcError(
      context,
      403,
      -32000,
      `Invalid Host header: ${hostHeader}`,
    );
  }

  return null;
}

export function startHttpServer(
  app: Hono,
  host: string,
  port: number,
): Promise<HttpServerHandle> {
  return new Promise((resolve, reject) => {
    const server = serve({
      fetch: app.fetch,
      hostname: host,
      port,
    }) as HttpServer;

    server.once("error", reject);
    server.once("listening", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}
