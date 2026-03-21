import { timingSafeEqual } from "node:crypto";

import type { Express, Request } from "express";

import type { MissionControlServices } from "../runtime.js";
import type { CampfireWebhookPayload } from "../types.js";
import { handleCampfireCommand } from "./commands.js";

function isCampfireWebhookPayload(
  value: unknown,
): value is CampfireWebhookPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<CampfireWebhookPayload>;
  return Boolean(
    payload.room &&
      payload.message &&
      payload.user &&
      typeof payload.message.body?.plain === "string",
  );
}

export function registerCampfireBotRoutes(
  app: Express,
  services: MissionControlServices,
): void {
  app.get("/up", (_request, response) => {
    response.type("text/plain").send("ok");
  });

  app.post(services.config.bot.webhookPath, async (request, response) => {
    try {
      if (!hasAuthorizedBoundarySecret(request, services)) {
        response
          .status(401)
          .type("text/plain")
          .send("Unauthorized webhook request");
        return;
      }

      if (!isCampfireWebhookPayload(request.body)) {
        response
          .status(400)
          .type("text/plain")
          .send("Invalid Campfire webhook payload");
        return;
      }

      const reply = await handleCampfireCommand(services, request.body);
      response.type("text/plain").send(reply);
    } catch (error) {
      services.logger.error("Campfire webhook handling failed.", {
        error: error instanceof Error ? error.message : String(error),
      });
      response
        .type("text/plain")
        .send(
          `Kryo bot error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
    }
  });
}

function hasAuthorizedBoundarySecret(
  request: Request,
  services: MissionControlServices,
): boolean {
  const secret = services.config.bot.auth.sharedSecret;

  if (!secret) {
    return true;
  }

  const provided = request.get(services.config.bot.auth.headerName);

  if (!provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
