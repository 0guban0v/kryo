import type { CardReference } from "../adapters/fizzy.js";
import type { MissionControlServices } from "../runtime.js";
import type { NotificationOptions, WorkflowResult } from "../types.js";
import { codeFence, heading, joinSections } from "../utils/markdown.js";
import {
  cardDetailsMarkdown,
  cardLabel,
  notifyCampfireIfNeeded,
  tryMoveCardToTarget,
} from "./shared.js";

export interface ReportBlockerInput {
  cardId: CardReference;
  reason: string;
  errorOutput?: string | undefined;
}

export async function reportBlocker(
  services: MissionControlServices,
  input: ReportBlockerInput,
  options: NotificationOptions = {},
): Promise<WorkflowResult> {
  const card = await services.fizzy.getCard(input.cardId);
  const moved = await tryMoveCardToTarget(
    services,
    card,
    services.config.workflow.blockedColumnName,
  );

  const comment = joinSections([
    "Blocked while working this card.",
    `Reason: ${input.reason}`,
    input.errorOutput ? `Error output:\n${input.errorOutput}` : null,
  ]);

  await services.fizzy.addComment(card, comment);

  const summary = `Reported ${cardLabel(card)} as blocked.`;

  await notifyCampfireIfNeeded(services, `${summary} ${input.reason}`, options);

  return {
    summary,
    markdown: joinSections([
      heading("Blocker Reported", 2),
      input.reason,
      input.errorOutput ? codeFence(input.errorOutput) : null,
      moved.note,
      cardDetailsMarkdown(services, moved.card),
    ]),
  };
}
