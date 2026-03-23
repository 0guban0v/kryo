import type { CardReference } from "../adapters/fizzy.js";
import type { MissionControlServices } from "../runtime.js";
import type { FizzyCard, FizzyColumn, NotificationOptions } from "../types.js";
import { errorMessage } from "../utils/http.js";
import {
  bullet,
  heading,
  joinSections,
  normalizeName,
  truncate,
} from "../utils/markdown.js";

interface TargetResolution {
  kind: "column" | "closed" | "not_now" | "triage";
  label: string;
  column?: FizzyColumn | undefined;
}

export function cardLabel(card: Pick<FizzyCard, "number" | "title">): string {
  return `#${card.number} ${card.title}`;
}

function normalizedWorkflowLabels(services: MissionControlServices): {
  done: string[];
  inProgress: string[];
  notNow: string[];
  triage: string[];
} {
  const workflow = services.config.workflow;

  return {
    done: [workflow.doneLabel, "done", "closed"].map((value) =>
      normalizeName(value),
    ),
    inProgress: [
      workflow.inProgressColumnName,
      "in progress",
      "active",
      "started",
      "working",
    ].map((value) => normalizeName(value)),
    notNow: [workflow.notNowLabel, "not now", "postponed"].map((value) =>
      normalizeName(value),
    ),
    triage: [workflow.triageLabel, "triage", "to do", "maybe"].map((value) =>
      normalizeName(value),
    ),
  };
}

export function cardDetailsMarkdown(
  services: MissionControlServices,
  card: FizzyCard,
): string {
  return joinSections([
    heading(cardLabel(card), 3),
    bullet([
      `Board: ${card.board.name}`,
      `Status: ${card.status}`,
      `Column: ${card.column?.name ?? services.config.workflow.triageLabel}`,
      card.assignees.length
        ? `Assignees: ${card.assignees.map((assignee) => assignee.name).join(", ")}`
        : "Assignees: none",
      card.tags.length ? `Tags: ${card.tags.join(", ")}` : "Tags: none",
      `URL: ${card.url}`,
    ]),
    card.description
      ? truncate(
          card.description,
          services.config.limits.cardDescriptionPreview,
        )
      : "No description provided.",
  ]);
}

export async function notifyCampfireIfNeeded(
  services: MissionControlServices,
  message: string,
  options: NotificationOptions = {},
): Promise<boolean> {
  if (options.notifyCampfire === false) {
    return false;
  }

  try {
    await services.campfire.postMessage({
      body: message,
      roomId: options.roomId,
      roomPath: options.roomPath,
    });
    return true;
  } catch (error) {
    services.logger.warn("Campfire notification skipped.", {
      message,
      error: errorMessage(error),
    });
    return false;
  }
}

async function resolveTarget(
  services: MissionControlServices,
  boardId: string,
  targetColumn: string,
): Promise<TargetResolution> {
  const column = await services.fizzy.findColumnByName(boardId, targetColumn);
  const labels = normalizedWorkflowLabels(services);
  const normalizedTarget = normalizeName(targetColumn);

  if (column) {
    return {
      kind: "column",
      label: column.name,
      column,
    };
  }

  if (labels.done.includes(normalizedTarget)) {
    return { kind: "closed", label: services.config.workflow.doneLabel };
  }

  if (labels.notNow.includes(normalizedTarget)) {
    return { kind: "not_now", label: services.config.workflow.notNowLabel };
  }

  if (
    labels.triage.includes(normalizedTarget) ||
    labels.inProgress.includes(normalizedTarget)
  ) {
    return { kind: "triage", label: services.config.workflow.triageLabel };
  }

  throw new Error(
    `Board ${boardId} does not have a column named "${targetColumn}".`,
  );
}

export async function moveCardToTarget(
  services: MissionControlServices,
  reference: CardReference,
  targetColumn: string,
): Promise<{ card: FizzyCard; destinationLabel: string }> {
  const card = await services.fizzy.getCard(reference);
  const target = await resolveTarget(services, card.board.id, targetColumn);

  switch (target.kind) {
    case "column":
      if (!target.column) {
        throw new Error(
          `Board ${card.board.id} is missing the resolved column.`,
        );
      }

      return {
        card: await services.fizzy.moveCardToColumn(card, target.column.id),
        destinationLabel: target.label,
      };
    case "closed":
      return {
        card: card.closed ? card : await services.fizzy.closeCard(card),
        destinationLabel: target.label,
      };
    case "not_now":
      return {
        card: await services.fizzy.moveCardToNotNow(card),
        destinationLabel: target.label,
      };
    case "triage":
      return {
        card: await services.fizzy.sendCardBackToTriage(card),
        destinationLabel: target.label,
      };
  }
}

export async function tryMoveCardToTarget(
  services: MissionControlServices,
  reference: CardReference,
  targetColumn: string,
): Promise<{
  card: FizzyCard;
  destinationLabel: string;
  moved: boolean;
  note?: string | undefined;
}> {
  const current = await services.fizzy.getCard(reference);

  try {
    const moved = await moveCardToTarget(services, current, targetColumn);
    return { ...moved, moved: true };
  } catch (error) {
    return {
      card: current,
      destinationLabel:
        current.column?.name ?? services.config.workflow.triageLabel,
      moved: false,
      note:
        error instanceof Error
          ? error.message
          : `Unable to move card to ${targetColumn}`,
    };
  }
}
