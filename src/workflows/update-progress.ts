import type { CardReference } from "../adapters/fizzy.js";
import type { MissionControlServices } from "../runtime.js";
import type { WorkflowResult } from "../types.js";
import { heading, joinSections } from "../utils/markdown.js";
import { cardDetailsMarkdown, cardLabel, moveCardToTarget } from "./shared.js";

export interface UpdateProgressInput {
  cardId: CardReference;
  targetColumn: string;
  message?: string | undefined;
}

export async function updateProgress(
  services: MissionControlServices,
  input: UpdateProgressInput,
): Promise<WorkflowResult> {
  const moved = await moveCardToTarget(
    services,
    input.cardId,
    input.targetColumn,
  );
  const summary = `Moved ${cardLabel(moved.card)} to ${moved.destinationLabel}.`;

  return {
    summary,
    markdown: joinSections([
      heading("Progress Updated", 2),
      input.message ?? null,
      cardDetailsMarkdown(services, moved.card),
    ]),
  };
}
