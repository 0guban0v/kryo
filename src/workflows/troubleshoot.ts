import type { CardReference } from "../adapters/fizzy.js";
import type { MissionControlServices } from "../runtime.js";
import type { NotificationOptions, WorkflowResult } from "../types.js";
import {
  bullet,
  codeFence,
  heading,
  joinSections,
  truncate,
} from "../utils/markdown.js";
import { cardLabel, notifyCampfireIfNeeded } from "./shared.js";

export interface TroubleshootInput {
  cardId: CardReference;
  errorOutput: string;
  context?: string | undefined;
}

interface TroubleAnalysis {
  rootCause: string;
  impact: string;
  suggestedFix: string;
  priority: "p0" | "p1" | "p2";
}

function analyzeErrorOutput(
  errorOutput: string,
  context?: string,
): TroubleAnalysis {
  const normalized = errorOutput.toLowerCase();

  if (/404|not found/.test(normalized) && /health/.test(normalized)) {
    return {
      rootCause:
        "The failing workflow is calling a `/health` endpoint that does not exist yet.",
      impact:
        "Health checks and deployment automation that rely on that endpoint will fail.",
      suggestedFix:
        "Add a lightweight `/health` route that returns a stable 200 response and update tests if they expect a specific body shape.",
      priority: "p1",
    };
  }

  if (/cannot find module|err_module_not_found/.test(normalized)) {
    return {
      rootCause:
        "A required module or import path does not resolve in the current runtime.",
      impact:
        "The application cannot boot or the affected test file cannot load.",
      suggestedFix:
        "Verify the import path, file extension, and dependency installation for the missing module.",
      priority: "p1",
    };
  }

  if (/econnrefused|enotfound|fetch failed|socket hang up/.test(normalized)) {
    return {
      rootCause:
        "The code is trying to reach a service that is unavailable or misconfigured.",
      impact:
        "Dependent requests fail, which usually blocks integration tests and runtime workflows.",
      suggestedFix:
        "Check the target host, port, credentials, and whether the dependency is running in the expected environment.",
      priority: "p1",
    };
  }

  if (/syntaxerror|unexpected token|unexpected identifier/.test(normalized)) {
    return {
      rootCause:
        "The runtime hit invalid syntax before it could execute the target code path.",
      impact: "The process fails fast and no downstream functionality can run.",
      suggestedFix:
        "Inspect the first reported file and line number, then correct the syntax issue before retrying.",
      priority: "p0",
    };
  }

  if (/expected|assert|assertionerror|received/.test(normalized)) {
    return {
      rootCause:
        "A test assertion no longer matches the current application behavior.",
      impact:
        "The failing behavior may indicate a regression or a stale test expectation.",
      suggestedFix:
        "Compare the expected value against the actual runtime behavior and update the code or the test to restore alignment.",
      priority: "p2",
    };
  }

  return {
    rootCause: context
      ? `The failure occurred while ${context}, but the log does not expose a single deterministic root cause.`
      : "The log does not expose a single deterministic root cause.",
    impact:
      "The affected workflow cannot complete reliably until the failure is reproduced with more targeted instrumentation.",
    suggestedFix:
      "Re-run with narrower logging around the first failing stack frame or request boundary, then compare the earliest error against the intended behavior.",
    priority: "p2",
  };
}

export async function troubleshoot(
  services: MissionControlServices,
  input: TroubleshootInput,
  options: NotificationOptions = {},
): Promise<WorkflowResult> {
  const card = await services.fizzy.getCard(input.cardId);
  const analysis = analyzeErrorOutput(input.errorOutput, input.context);
  const errorExcerptLimit = services.config.limits.troubleshootErrorOutput;
  const comment = joinSections([
    "Troubleshooting note",
    `Root cause: ${analysis.rootCause}`,
    `Impact: ${analysis.impact}`,
    `Suggested fix: ${analysis.suggestedFix}`,
    `Priority: ${analysis.priority}`,
    "Error excerpt:",
    truncate(input.errorOutput, errorExcerptLimit),
  ]);

  await services.fizzy.addComment(card, comment);

  const summary = `Added troubleshooting findings to ${cardLabel(card)}.`;

  await notifyCampfireIfNeeded(
    services,
    `${summary} Likely root cause: ${analysis.rootCause}`,
    options,
  );

  return {
    summary,
    markdown: joinSections([
      heading("Troubleshooting Report", 2),
      bullet([
        `Root cause: ${analysis.rootCause}`,
        `Impact: ${analysis.impact}`,
        `Suggested fix: ${analysis.suggestedFix}`,
        `Priority: ${analysis.priority}`,
      ]),
      codeFence(truncate(input.errorOutput, errorExcerptLimit)),
    ]),
  };
}
