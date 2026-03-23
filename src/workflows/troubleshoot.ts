import type { CardReference } from "../adapters/fizzy.js";
import type { MissionControlServices } from "../runtime.js";
import type { WorkflowResult } from "../types.js";
import {
  bullet,
  codeFence,
  heading,
  joinSections,
  truncate,
} from "../utils/markdown.js";
import { cardLabel } from "./shared.js";

export interface TroubleshootInput {
  cardId: CardReference;
  errorOutput: string;
  context?: string | undefined;
}

export async function troubleshoot(
  services: MissionControlServices,
  input: TroubleshootInput,
): Promise<WorkflowResult> {
  const card = await services.fizzy.getCard(input.cardId);
  const errorExcerptLimit = services.config.limits.troubleshootErrorOutput;
  const comment = joinSections([
    "Troubleshooting note",
    input.context ? `Context: ${input.context}` : null,
    "Error excerpt:",
    truncate(input.errorOutput, errorExcerptLimit),
  ]);

  await services.fizzy.addComment(card, comment);

  const summary = `Added troubleshooting findings to ${cardLabel(card)}.`;

  return {
    summary,
    markdown: joinSections([
      heading("Troubleshooting Report", 2),
      bullet([
        input.context ? `Context: ${input.context}` : "Context: not provided",
        "Analysis: deferred to the caller or external reasoning layer.",
      ]),
      codeFence(truncate(input.errorOutput, errorExcerptLimit)),
    ]),
  };
}
