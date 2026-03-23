import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";

import { loadConfig } from "../src/config.js";
import {
  type HttpServerHandle,
  createMissionControlHttpApp,
  registerMcpHttpRoutes,
  startHttpServer,
} from "../src/http-server.js";
import { Logger } from "../src/logger.js";
import type { MissionControlServices } from "../src/runtime.js";

function createMockServices(
  overrides: Partial<MissionControlServices> = {},
  envOverrides: Record<string, string> = {},
): MissionControlServices {
  const config = loadConfig({
    FIZZY_URL: "http://fizzy.internal",
    FIZZY_API_TOKEN: "fizzy-token",
    FIZZY_ACCOUNT_ID: "account-1",
    MCP_TRANSPORT: "streamable-http",
    MCP_HTTP_SESSION_MODE: "stateless",
    MCP_HOST: "127.0.0.1",
    MCP_ALLOWED_HOSTS: "127.0.0.1,localhost,mcp",
    MCP_PORT: "3100",
    ...envOverrides,
  });

  return {
    config,
    logger: new Logger("error"),
    fizzy: {
      resolveBoardIdOrName: async () => "board-1",
      getBoard: async () => {
        throw new Error("not implemented");
      },
      listBoardCards: async () => [],
    } as unknown as MissionControlServices["fizzy"],
    github: {} as unknown as MissionControlServices["github"],
    ...overrides,
  };
}

async function closeServer(server: HttpServerHandle): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function getAvailablePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;
  probe.close();
  await once(probe, "close");
  return port;
}

async function initializeMcpSession(
  app: ReturnType<typeof createMissionControlHttpApp>,
) {
  const response = await app.request(
    "http://localhost/mcp",
    buildInitializeRequest(),
  );

  return response;
}

function buildInitializeRequest(): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      host: "localhost",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "kryo-test-client",
          version: "0.1.0",
        },
      },
    }),
  };
}

function buildStatefulSessionHeaders(sessionId: string): HeadersInit {
  return {
    accept: "application/json, text/event-stream",
    host: "localhost",
    "mcp-protocol-version": "2025-03-26",
    "mcp-session-id": sessionId,
  };
}

test("host validation rejects requests outside the configured allowlist", async () => {
  const app = createMissionControlHttpApp(["localhost"]);

  const denied = await app.request("http://localhost/up", {
    headers: {
      host: "evil.example",
    },
  });
  assert.equal(denied.status, 403);

  const allowed = await app.request("http://localhost/up", {
    headers: {
      host: "localhost",
    },
  });
  assert.equal(allowed.status, 200);
  assert.equal(await allowed.text(), "ok");
});

test("createMissionControlHttpApp rejects an empty allowed host list", () => {
  assert.throws(
    () => createMissionControlHttpApp([]),
    /requires at least one allowed host/,
  );
});

test("stateless MCP returns parse errors for invalid JSON payloads", async () => {
  const app = createMissionControlHttpApp(["localhost"]);
  registerMcpHttpRoutes(app, createMockServices());

  const response = await app.request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost",
    },
    body: "{",
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    jsonrpc: "2.0",
    error: {
      code: -32700,
      message: "Parse error",
    },
    id: null,
  });
});

test("startHttpServer waits for listen and rejects bind conflicts", async () => {
  const firstApp = createMissionControlHttpApp(["127.0.0.1", "localhost"]);

  const secondApp = createMissionControlHttpApp(["127.0.0.1", "localhost"]);

  const port = await getAvailablePort();
  const firstServer = await startHttpServer(firstApp, "127.0.0.1", port);

  try {
    const health = await fetch(`http://127.0.0.1:${port}/up`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), "ok");

    await assert.rejects(
      startHttpServer(secondApp, "127.0.0.1", port),
      /EADDRINUSE/,
    );
  } finally {
    await closeServer(firstServer);
  }
});

test("stateful MCP sessions expire and free capacity", async () => {
  const app = createMissionControlHttpApp(["localhost"]);
  const runtime = registerMcpHttpRoutes(
    app,
    createMockServices(
      {},
      {
        MCP_HTTP_SESSION_MODE: "stateful",
        MCP_SESSION_IDLE_TTL_MS: "1",
        MCP_MAX_SESSIONS: "1",
      },
    ),
  );

  const firstResponse = await initializeMcpSession(app);
  assert.equal(firstResponse.status, 200);
  const firstSessionId = firstResponse.headers.get("mcp-session-id");
  assert.ok(firstSessionId);
  assert.equal(runtime.activeSessionCount(), 1);

  await new Promise((resolve) => setTimeout(resolve, 10));

  const secondResponse = await initializeMcpSession(app);
  assert.equal(secondResponse.status, 200);
  const secondSessionId = secondResponse.headers.get("mcp-session-id");
  assert.ok(secondSessionId);
  assert.notEqual(secondSessionId, firstSessionId);
  assert.equal(runtime.activeSessionCount(), 1);
});

test("stateful MCP session cap rejects excess concurrent sessions", async () => {
  const app = createMissionControlHttpApp(["localhost"]);
  registerMcpHttpRoutes(
    app,
    createMockServices(
      {},
      {
        MCP_HTTP_SESSION_MODE: "stateful",
        MCP_MAX_SESSIONS: "1",
      },
    ),
  );

  const firstResponse = await initializeMcpSession(app);
  assert.equal(firstResponse.status, 200);

  const secondResponse = await initializeMcpSession(app);
  assert.equal(secondResponse.status, 503);
  assert.deepEqual(await secondResponse.json(), {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Too many active MCP sessions",
    },
    id: null,
  });
});

test("stateful MCP runtime can close active sessions during shutdown", async () => {
  const app = createMissionControlHttpApp(["localhost"]);
  const runtime = registerMcpHttpRoutes(
    app,
    createMockServices(
      {},
      {
        MCP_HTTP_SESSION_MODE: "stateful",
        MCP_MAX_SESSIONS: "1",
      },
    ),
  );

  const firstResponse = await initializeMcpSession(app);
  assert.equal(firstResponse.status, 200);
  assert.equal(runtime.activeSessionCount(), 1);

  await runtime.closeActiveSessions();
  assert.equal(runtime.activeSessionCount(), 0);

  const secondResponse = await initializeMcpSession(app);
  assert.equal(secondResponse.status, 200);
  assert.equal(runtime.activeSessionCount(), 1);
});

test("stateful MCP GET establishes an SSE stream for an initialized session", async () => {
  const app = createMissionControlHttpApp(["localhost"]);
  const runtime = registerMcpHttpRoutes(
    app,
    createMockServices(
      {},
      {
        MCP_HTTP_SESSION_MODE: "stateful",
      },
    ),
  );

  const initializeResponse = await initializeMcpSession(app);
  assert.equal(initializeResponse.status, 200);
  const sessionId = initializeResponse.headers.get("mcp-session-id");
  assert.ok(sessionId);

  const response = await app.request("http://localhost/mcp", {
    method: "GET",
    headers: buildStatefulSessionHeaders(sessionId),
  });

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/event-stream\b/i,
  );
  assert.equal(runtime.activeSessionCount(), 1);
});

test("stateful MCP DELETE terminates the active session", async () => {
  const app = createMissionControlHttpApp(["localhost"]);
  const runtime = registerMcpHttpRoutes(
    app,
    createMockServices(
      {},
      {
        MCP_HTTP_SESSION_MODE: "stateful",
      },
    ),
  );

  const initializeResponse = await initializeMcpSession(app);
  assert.equal(initializeResponse.status, 200);
  const sessionId = initializeResponse.headers.get("mcp-session-id");
  assert.ok(sessionId);
  assert.equal(runtime.activeSessionCount(), 1);

  const deleteResponse = await app.request("http://localhost/mcp", {
    method: "DELETE",
    headers: buildStatefulSessionHeaders(sessionId),
  });

  assert.equal(deleteResponse.status, 200);
  assert.equal(runtime.activeSessionCount(), 0);

  const subsequentGet = await app.request("http://localhost/mcp", {
    method: "GET",
    headers: buildStatefulSessionHeaders(sessionId),
  });

  assert.equal(subsequentGet.status, 400);
  assert.equal(await subsequentGet.text(), "Invalid or missing MCP session ID");
});

test("stateful MCP session cap is enforced under concurrent initialization", async () => {
  const app = createMissionControlHttpApp(["127.0.0.1", "localhost"]);
  registerMcpHttpRoutes(
    app,
    createMockServices(
      {},
      {
        MCP_HTTP_SESSION_MODE: "stateful",
        MCP_MAX_SESSIONS: "1",
      },
    ),
  );

  const port = await getAvailablePort();
  const server = await startHttpServer(app, "127.0.0.1", port);

  try {
    const url = `http://127.0.0.1:${port}/mcp`;
    const [firstResponse, secondResponse] = await Promise.all([
      fetch(url, buildInitializeRequest()),
      fetch(url, buildInitializeRequest()),
    ]);

    const statuses = [firstResponse.status, secondResponse.status].sort();
    assert.deepEqual(statuses, [200, 503]);
  } finally {
    await closeServer(server);
  }
});
