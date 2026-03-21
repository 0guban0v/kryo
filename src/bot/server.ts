import { timingSafeEqual } from "node:crypto";

import type { Context, Hono } from "hono";

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
  app: Hono,
  services: MissionControlServices,
): void {
  app.get("/up", (context) => {
    return context.text("ok");
  });

  app.post(services.config.bot.webhookPath, async (context) => {
    try {
      if (!hasAuthorizedBoundarySecret(context, services)) {
        return context.text("Unauthorized webhook request", 401);
      }

      const body = await context.req.json().catch(() => null);

      if (!isCampfireWebhookPayload(body)) {
        return context.text("Invalid Campfire webhook payload", 400);
      }

      const reply = await handleCampfireCommand(services, body);
      return context.text(reply);
    } catch (error) {
      services.logger.error("Campfire webhook handling failed.", {
        error: error instanceof Error ? error.message : String(error),
      });
      return context.text(
        `Kryo bot error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });
}

function hasAuthorizedBoundarySecret(
  context: Pick<Context, "req">,
  services: MissionControlServices,
): boolean {
  const secret = services.config.bot.auth.sharedSecret;

  if (!secret) {
    return true;
  }

  const provided = context.req.header(services.config.bot.auth.headerName);

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
