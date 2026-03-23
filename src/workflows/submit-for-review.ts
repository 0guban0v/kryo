import type { CardReference } from "../adapters/fizzy.js";
import type { MissionControlServices } from "../runtime.js";
import type { WorkflowResult } from "../types.js";
import { bullet, heading, joinSections } from "../utils/markdown.js";
import {
  cardDetailsMarkdown,
  cardLabel,
  tryMoveCardToTarget,
} from "./shared.js";

export interface SubmitForReviewInput {
  cardId: CardReference;
  repo?: string | undefined;
  branch: string;
  base?: string | undefined;
  title: string;
  body?: string | undefined;
}

export async function submitForReview(
  services: MissionControlServices,
  input: SubmitForReviewInput,
): Promise<WorkflowResult> {
  const card = await services.fizzy.getCard(input.cardId);
  const pullRequest = await services.github.createPullRequest({
    repo: input.repo,
    head: input.branch,
    base: input.base,
    title: input.title,
    body: input.body,
  });

  let commentAdded = false;
  let commentError: string | undefined;

  try {
    await services.fizzy.addComment(
      card,
      `PR created for review: ${pullRequest.html_url}`,
    );
    commentAdded = true;
  } catch (error) {
    commentError =
      error instanceof Error ? error.message : "Unable to add PR comment.";
  }

  const moved = await tryMoveCardToTarget(
    services,
    card,
    services.config.workflow.reviewColumnName,
  );
  const followUpIssues: string[] = [];

  if (!commentAdded) {
    followUpIssues.push(
      `Card comment failed.${commentError ? ` ${commentError}` : ""}`,
    );
  }

  if (!moved.moved) {
    followUpIssues.push(
      `Card move failed.${moved.note ? ` ${moved.note}` : ""}`,
    );
  }

  const summary =
    followUpIssues.length === 0
      ? `Submitted ${cardLabel(card)} for review as PR #${pullRequest.number}.`
      : `⚠ Partial success: PR #${pullRequest.number} was created for ${cardLabel(card)}, but follow-up updates failed.`;

  return {
    summary,
    markdown: joinSections([
      heading("Submitted For Review", 2),
      `PR #${pullRequest.number}: ${pullRequest.html_url}`,
      followUpIssues.length === 0
        ? bullet([
            "PR created successfully.",
            "Card comment added.",
            `Card moved to ${moved.destinationLabel}.`,
          ])
        : bullet([
            "PR created successfully.",
            commentAdded
              ? "Card comment added."
              : `⚠ Card comment failed.${commentError ? ` ${commentError}` : ""}`,
            moved.moved
              ? `Card moved to ${moved.destinationLabel}.`
              : `⚠ Card move failed.${moved.note ? ` ${moved.note}` : ""}`,
          ]),
      cardDetailsMarkdown(services, moved.card),
    ]),
  };
}
