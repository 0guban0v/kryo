import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";

import { HttpError, requestText } from "../src/utils/http.js";

async function withServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  work: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    await work(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("requestText rejects known metadata hosts before issuing the request", async () => {
  await assert.rejects(
    requestText("http://169.254.169.254", "/latest/meta-data"),
    /Refusing outbound HTTP request to metadata host/,
  );
});

test("requestText does not follow redirects automatically", async () => {
  await withServer(
    (request, response) => {
      if (request.url === "/redirect") {
        response.statusCode = 302;
        response.setHeader("Location", "/final");
        response.end("redirect");
        return;
      }

      response.statusCode = 200;
      response.end("ok");
    },
    async (baseUrl) => {
      await assert.rejects(
        requestText(baseUrl, "/redirect"),
        (error: unknown) =>
          error instanceof HttpError &&
          error.status === 302 &&
          error.responseBody === "redirect",
      );
    },
  );
});
