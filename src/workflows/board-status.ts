import type { MissionControlServices } from "../runtime.js";
import type { FizzyCard, WorkflowResult } from "../types.js";
import { bullet, heading, joinSections } from "../utils/markdown.js";
import { cardLabel } from "./shared.js";

interface CardBuckets {
  triage: FizzyCard[];
  done: FizzyCard[];
  notNow: FizzyCard[];
  columns: Map<string, FizzyCard[]>;
}

function buildBuckets(cards: FizzyCard[]): CardBuckets {
  const buckets: CardBuckets = {
    triage: [],
    done: [],
    notNow: [],
    columns: new Map<string, FizzyCard[]>(),
  };

  for (const card of cards) {
    if (card.closed) {
      buckets.done.push(card);
      continue;
    }

    if (card.postponed) {
      buckets.notNow.push(card);
      continue;
    }

    if (card.column) {
      const columnCards = buckets.columns.get(card.column.name) ?? [];
      columnCards.push(card);
      buckets.columns.set(card.column.name, columnCards);
      continue;
    }

    buckets.triage.push(card);
  }

  return buckets;
}

function renderBucket(
  name: string,
  cards: FizzyCard[],
  visibleCardLimit: number,
): string | null {
  if (!cards.length) {
    return null;
  }

  const visible = cards
    .slice(0, visibleCardLimit)
    .map((card) => cardLabel(card));
  const more =
    cards.length > visibleCardLimit
      ? `${cards.length - visibleCardLimit} more card(s) not shown`
      : null;

  return joinSections([
    heading(`${name} (${cards.length})`, 3),
    bullet([...visible, more]),
  ]);
}

export async function getBoardStatus(
  services: MissionControlServices,
  boardId?: string,
): Promise<WorkflowResult> {
  const resolvedBoardId = await services.fizzy.resolveBoardIdOrName(boardId);
  const workflow = services.config.workflow;
  const visibleCardLimit = services.config.limits.boardStatusVisibleCards;
  const [board, cards] = await Promise.all([
    services.fizzy.getBoard(resolvedBoardId),
    services.fizzy.listBoardCards(resolvedBoardId, { sortedBy: "oldest" }),
  ]);

  const buckets = buildBuckets(cards);
  const columnCounts = Array.from(buckets.columns.entries()).map(
    ([name, columnCards]) => `${name}: ${columnCards.length}`,
  );

  const summary = `Board ${board.name}: ${[
    `${workflow.triageLabel} ${buckets.triage.length}`,
    ...columnCounts,
    `${workflow.notNowLabel} ${buckets.notNow.length}`,
    `${workflow.doneLabel} ${buckets.done.length}`,
  ].join(", ")}`;

  const markdown = joinSections([
    heading(`Board Status: ${board.name}`, 2),
    bullet([
      `Board ID: ${board.id}`,
      `Total cards: ${cards.length}`,
      `Public URL: ${board.public_url ?? "not published"}`,
    ]),
    renderBucket(workflow.triageLabel, buckets.triage, visibleCardLimit),
    ...Array.from(buckets.columns.entries()).map(([name, columnCards]) =>
      renderBucket(name, columnCards, visibleCardLimit),
    ),
    renderBucket(workflow.notNowLabel, buckets.notNow, visibleCardLimit),
    renderBucket(workflow.doneLabel, buckets.done, visibleCardLimit),
  ]);

  return { summary, markdown };
}
