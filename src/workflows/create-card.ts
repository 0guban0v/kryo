import type { MissionControlServices } from "../runtime.js";
import type { NotificationOptions, WorkflowResult } from "../types.js";
import { heading, joinSections } from "../utils/markdown.js";
import {
  cardDetailsMarkdown,
  cardLabel,
  notifyCampfireIfNeeded,
  tryMoveCardToTarget,
} from "./shared.js";

export interface CreateCardInput {
  boardId?: string | undefined;
  title: string;
  body?: string | undefined;
  column?: string | undefined;
  tags?: string[] | undefined;
}

export async function createCard(
  services: MissionControlServices,
  input: CreateCardInput,
  options: NotificationOptions = {},
): Promise<WorkflowResult> {
  const boardId = services.fizzy.resolveBoardId(input.boardId);
  let card = await services.fizzy.createCard(boardId, {
    title: input.title,
    description: input.body,
  });

  if (input.tags?.length) {
    card = await services.fizzy.ensureTags(card, input.tags);
  }

  let moveNote: string | null = null;
  if (input.column) {
    const move = await tryMoveCardToTarget(services, card, input.column);
    card = move.card;
    moveNote = move.moved
      ? `Placed in ${move.destinationLabel}.`
      : `Created successfully, but not moved: ${move.note}`;
  }

  const summary = `Created ${cardLabel(card)} on ${card.board.name}.`;
  await notifyCampfireIfNeeded(services, summary, options);

  return {
    summary,
    markdown: joinSections([
      heading("Card Created", 2),
      moveNote,
      cardDetailsMarkdown(card),
    ]),
  };
}
