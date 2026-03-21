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

function renderBucket(name: string, cards: FizzyCard[]): string | null {
  if (!cards.length) {
    return null;
  }

  const visible = cards.slice(0, 5).map((card) => cardLabel(card));
  const more =
    cards.length > 5 ? `${cards.length - 5} more card(s) not shown` : null;

  return joinSections([
    heading(`${name} (${cards.length})`, 3),
    bullet([...visible, more]),
  ]);
}

export async function getBoardStatus(
  services: MissionControlServices,
  boardId?: string,
): Promise<WorkflowResult> {
  const resolvedBoardId = services.fizzy.resolveBoardId(boardId);
  const [board, cards] = await Promise.all([
    services.fizzy.getBoard(resolvedBoardId),
    services.fizzy.listBoardCards(resolvedBoardId, { sortedBy: "oldest" }),
  ]);

  const buckets = buildBuckets(cards);
  const columnCounts = Array.from(buckets.columns.entries()).map(
    ([name, columnCards]) => `${name}: ${columnCards.length}`,
  );

  const summary = `Board ${board.name}: ${[
    `Triage ${buckets.triage.length}`,
    ...columnCounts,
    `Not Now ${buckets.notNow.length}`,
    `Done ${buckets.done.length}`,
  ].join(", ")}`;

  const markdown = joinSections([
    heading(`Board Status: ${board.name}`, 2),
    bullet([
      `Board ID: ${board.id}`,
      `Total cards: ${cards.length}`,
      `Public URL: ${board.public_url ?? "not published"}`,
    ]),
    renderBucket("Triage", buckets.triage),
    ...Array.from(buckets.columns.entries()).map(([name, columnCards]) =>
      renderBucket(name, columnCards),
    ),
    renderBucket("Not Now", buckets.notNow),
    renderBucket("Done", buckets.done),
  ]);

  return { summary, markdown };
}

export async function getBlockedWork(
  services: MissionControlServices,
  boardId?: string,
): Promise<WorkflowResult> {
  const resolvedBoardId = services.fizzy.resolveBoardId(boardId);
  const [board, cards] = await Promise.all([
    services.fizzy.getBoard(resolvedBoardId),
    services.fizzy.listBoardCards(resolvedBoardId, { sortedBy: "oldest" }),
  ]);

  const blockedCards = cards.filter(
    (card) => card.column && card.column.name.toLowerCase() === "blocked",
  );

  if (!blockedCards.length) {
    return {
      summary: `No cards are currently blocked on ${board.name}.`,
      markdown: joinSections([
        heading(`Blocked Work: ${board.name}`, 2),
        "No cards are currently in a `Blocked` column.",
      ]),
    };
  }

  return {
    summary: `${blockedCards.length} card(s) are blocked on ${board.name}.`,
    markdown: joinSections([
      heading(`Blocked Work: ${board.name}`, 2),
      bullet(blockedCards.map((card) => `${cardLabel(card)} (${card.url})`)),
    ]),
  };
}
