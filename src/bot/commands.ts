import type { MissionControlServices } from "../runtime.js";
import type { CampfireWebhookPayload } from "../types.js";
import {
  createCard,
  getBlockedWork,
  getBoardStatus,
  pickUpWork,
} from "../workflows/index.js";
import { handleCampfireAgentCommand } from "./agent.js";

function toPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^- /gm, "* ")
    .replace(/`/g, "")
    .trim();
}

function helpText(): string {
  return [
    "Kryo bot commands:",
    "* board status",
    "* what's blocked",
    "* pick up next [#tag]",
    "* create card <title> | <description>",
    "* help",
  ].join("\n");
}

function parsePriorityTag(command: string): string | undefined {
  const match = command.match(/#([a-z0-9_-]+)/i);
  return match?.[1];
}

function parseCreateCard(command: string): {
  title: string;
  body?: string;
  tags?: string[];
} | null {
  const payload = command.replace(/^create card\b[:\s]*/i, "").trim();
  if (!payload) {
    return null;
  }

  const tags = Array.from(payload.matchAll(/#([a-z0-9_-]+)/gi)).flatMap(
    (match) => (match[1] ? [match[1]] : []),
  );

  const withoutTags = payload
    .replace(/(^|\s)#[a-z0-9_-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const [rawTitle, rawBody] = withoutTags.split(/\s+\|\s+/, 2);
  const title = rawTitle?.trim();

  if (!title) {
    return null;
  }

  return {
    title,
    ...(rawBody?.trim() ? { body: rawBody.trim() } : {}),
    ...(tags.length ? { tags } : {}),
  };
}

export async function handleCampfireCommand(
  services: MissionControlServices,
  payload: CampfireWebhookPayload,
): Promise<string> {
  services.campfire.observeWebhook(payload);

  if (services.config.bot.mode === "agent") {
    return handleCampfireAgentCommand(services, payload);
  }

  const command = payload.message.body.plain.trim();

  if (!command || /^help\b/i.test(command)) {
    return helpText();
  }

  if (/^(board status|status)\b/i.test(command)) {
    const result = await getBoardStatus(services);
    return toPlainText(result.markdown);
  }

  if (/^(what('?s| is) blocked|blocked)\b/i.test(command)) {
    const result = await getBlockedWork(services);
    return toPlainText(result.markdown);
  }

  if (/^pick up next\b/i.test(command)) {
    const result = await pickUpWork(
      services,
      { priorityTag: parsePriorityTag(command) },
      { notifyCampfire: false },
    );
    return toPlainText(result.markdown);
  }

  if (/^create card\b/i.test(command)) {
    const parsed = parseCreateCard(command);

    if (!parsed) {
      return "Usage: create card <title> | <description>";
    }

    const result = await createCard(
      services,
      {
        title: parsed.title,
        ...(parsed.body ? { body: parsed.body } : {}),
        ...(parsed.tags ? { tags: parsed.tags } : {}),
      },
      { notifyCampfire: false },
    );

    return toPlainText(result.markdown);
  }

  return helpText();
}
