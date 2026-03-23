import type { CardReference } from "../adapters/fizzy.js";
import type { MissionControlServices } from "../runtime.js";
import type { WorkflowResult } from "../types.js";
import { heading, joinSections } from "../utils/markdown.js";
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

  await services.fizzy.addComment(
    card,
    `PR created for review: ${pullRequest.html_url}`,
  );

  const moved = await tryMoveCardToTarget(
    services,
    card,
    services.config.workflow.reviewColumnName,
  );
  const summary = `Submitted ${cardLabel(card)} for review as PR #${pullRequest.number}.`;

  return {
    summary,
    markdown: joinSections([
      heading("Submitted For Review", 2),
      `PR #${pullRequest.number}: ${pullRequest.html_url}`,
      moved.note,
      cardDetailsMarkdown(services, moved.card),
    ]),
  };
}
