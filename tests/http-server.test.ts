import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";

import { registerCampfireBotRoutes } from "../src/bot/server.js";
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
    CAMPFIRE_URL: "http://campfire.internal",
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
      resolveBoardId: () => "board-1",
      getBoard: async () => {
        throw new Error("not implemented");
      },
      listBoardCards: async () => [],
    } as unknown as MissionControlServices["fizzy"],
    campfire: {
      observeWebhook: () => undefined,
    } as unknown as MissionControlServices["campfire"],
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
  const response = await app.request("http://localhost/mcp", {
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
  });

  return response;
}

test("host validation rejects requests outside the configured allowlist", async () => {
  const app = createMissionControlHttpApp(["localhost"]);
  registerCampfireBotRoutes(app, createMockServices());

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

test("webhook failures return a generic 500 response", async () => {
  const app = createMissionControlHttpApp(["localhost"]);
  registerCampfireBotRoutes(
    app,
    createMockServices({
      fizzy: {
        resolveBoardId: () => {
          throw new Error("board lookup leaked detail");
        },
      } as unknown as MissionControlServices["fizzy"],
    }),
  );

  const response = await app.request("http://localhost/campfire/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost",
    },
    body: JSON.stringify({
      user: { id: "user-1", name: "Ada" },
      room: { id: "room-1", name: "Engineering" },
      message: {
        id: "message-1",
        body: { plain: "board status" },
      },
    }),
  });

  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Kryo bot error");
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
  registerCampfireBotRoutes(firstApp, createMockServices());

  const secondApp = createMissionControlHttpApp(["127.0.0.1", "localhost"]);
  registerCampfireBotRoutes(secondApp, createMockServices());

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
  registerMcpHttpRoutes(
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

  await new Promise((resolve) => setTimeout(resolve, 10));

  const secondResponse = await initializeMcpSession(app);
  assert.equal(secondResponse.status, 200);
  const secondSessionId = secondResponse.headers.get("mcp-session-id");
  assert.ok(secondSessionId);
  assert.notEqual(secondSessionId, firstSessionId);
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
