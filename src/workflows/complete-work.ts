import type { CardReference } from "../adapters/fizzy.js";
import type { MissionControlServices } from "../runtime.js";
import type { WorkflowResult } from "../types.js";
import { bullet, heading, joinSections } from "../utils/markdown.js";
import {
  cardDetailsMarkdown,
  cardLabel,
  tryMoveCardToTarget,
} from "./shared.js";

export interface CompleteWorkInput {
  cardId: CardReference;
  prNumber: number;
  repo?: string | undefined;
}

export async function completeWork(
  services: MissionControlServices,
  input: CompleteWorkInput,
): Promise<WorkflowResult> {
  const [card, checks] = await Promise.all([
    services.fizzy.getCard(input.cardId),
    services.github.getPullRequestChecks(input.repo, input.prNumber),
  ]);

  if (checks.overall !== "success") {
    return {
      summary: `PR #${input.prNumber} was not merged because checks are ${checks.overall}.`,
      markdown: joinSections([
        heading("Complete Work", 2),
        `PR #${input.prNumber} cannot be merged yet.`,
        bullet([
          `Overall check state: ${checks.overall}`,
          `Combined status: ${checks.combinedState}`,
          ...checks.statuses.map(
            (status) =>
              `${status.context}: ${status.state}${status.description ? ` (${status.description})` : ""}`,
          ),
          ...checks.checkRuns.map(
            (checkRun) =>
              `${checkRun.name}: ${checkRun.status}${checkRun.conclusion ? `/${checkRun.conclusion}` : ""}`,
          ),
        ]),
      ]),
    };
  }

  const merge = await services.github.mergePullRequest({
    repo: input.repo,
    prNumber: input.prNumber,
    commitTitle: `Merge PR #${input.prNumber}: ${card.title}`,
  });

  const moved = await tryMoveCardToTarget(
    services,
    card,
    services.config.workflow.doneLabel,
  );
  const summary = moved.moved
    ? `Merged PR #${input.prNumber} and completed ${cardLabel(card)}.`
    : `⚠ Partial success: PR #${input.prNumber} was merged, but ${cardLabel(card)} could not be moved to ${services.config.workflow.doneLabel}.`;

  return {
    summary,
    markdown: joinSections([
      heading("Work Completed", 2),
      `Merge response: ${merge.message}`,
      bullet([
        "PR merged successfully.",
        moved.moved
          ? `Card moved to ${moved.destinationLabel}.`
          : `⚠ Card move failed.${moved.note ? ` ${moved.note}` : ""}`,
      ]),
      cardDetailsMarkdown(services, moved.card),
    ]),
  };
}
