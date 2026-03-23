import type { MissionControlServices } from "../runtime.js";
import type { WorkflowResult } from "../types.js";
import { heading, joinSections, normalizeName } from "../utils/markdown.js";
import { cardDetailsMarkdown, cardLabel, moveCardToTarget } from "./shared.js";

export interface PickUpWorkInput {
  boardId?: string | undefined;
  priorityTag?: string | undefined;
  targetColumnName?: string | undefined;
  assigneeId?: string | undefined;
}

export async function pickUpWork(
  services: MissionControlServices,
  input: PickUpWorkInput,
): Promise<WorkflowResult> {
  const boardId = await services.fizzy.resolveBoardIdOrName(input.boardId);
  const workflow = services.config.workflow;
  const priorityTag = input.priorityTag
    ? normalizeName(input.priorityTag)
    : null;
  const [currentUser, toDoColumn, cards] = await Promise.all([
    input.assigneeId
      ? Promise.resolve({ id: input.assigneeId, name: input.assigneeId })
      : services.fizzy.getCurrentUser(),
    services.fizzy.findColumnByName(boardId, workflow.todoColumnName),
    services.fizzy.listBoardCards(boardId, {
      sortedBy: "oldest",
      assignmentStatus: "unassigned",
    }),
  ]);

  const candidates = cards
    .filter((card) => !card.closed && !card.postponed)
    .filter((card) =>
      toDoColumn ? card.column?.id === toDoColumn.id : !card.column,
    )
    .filter((card) =>
      priorityTag
        ? card.tags.some((tag) => normalizeName(tag) === priorityTag)
        : true,
    );

  const selected = candidates[0];

  if (!selected) {
    return {
      summary: "No unassigned work item matched the requested queue.",
      markdown: joinSections([
        heading("Pick Up Work", 2),
        `No unassigned card was found in the \`${workflow.todoColumnName}\` queue.`,
        input.priorityTag ? `Priority tag filter: ${input.priorityTag}` : null,
      ]),
    };
  }

  const assignedCard = await services.fizzy.ensureAssigned(
    selected,
    currentUser.id,
  );
  const moved = await moveCardToTarget(
    services,
    assignedCard,
    input.targetColumnName ?? workflow.inProgressColumnName,
  );

  const summary = `Picked up ${cardLabel(moved.card)} and moved it to ${moved.destinationLabel}.`;

  return {
    summary,
    markdown: joinSections([
      heading("Picked Up Work", 2),
      `Assigned to ${currentUser.name} and moved to ${moved.destinationLabel}.`,
      cardDetailsMarkdown(services, moved.card),
    ]),
  };
}
