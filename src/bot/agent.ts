import type { ChatMessage } from "../inference/model-client.js";
import type { MissionControlServices } from "../runtime.js";
import type { CampfireWebhookPayload } from "../types.js";
import { getBlockedWork, getBoardStatus } from "../workflows/board-status.js";
import { completeWork } from "../workflows/complete-work.js";
import { createCard } from "../workflows/create-card.js";
import { pickUpWork } from "../workflows/pick-up-work.js";
import { cardLabel } from "../workflows/shared.js";
import { submitForReview } from "../workflows/submit-for-review.js";
import { updateProgress } from "../workflows/update-progress.js";
import { KRYO_BOT_SYSTEM_PROMPT } from "./system-prompt.js";

interface AgentDecision {
  type: "reply" | "action";
  message?: string | undefined;
  progress?: string | undefined;
  action?: string | undefined;
  args?: Record<string, unknown> | undefined;
}

interface AgentRequestDispatch {
  immediateReply: string;
  completion: Promise<void>;
}

function toPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^- /gm, "* ")
    .replace(/`/g, "")
    .trim();
}

function extractJsonObject(value: string): string {
  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return value.slice(start, end + 1);
  }

  return value.trim();
}

function parseDecision(value: string): AgentDecision {
  const parsed = JSON.parse(extractJsonObject(value)) as AgentDecision;

  if (parsed.type !== "reply" && parsed.type !== "action") {
    throw new Error("Model returned an unsupported decision type.");
  }

  return parsed;
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Expected ${fieldName} to be a non-empty string.`);
  }

  return value.trim();
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Expected ${fieldName} to be a number.`);
}

function asCardReference(value: unknown, fieldName: string): string | number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : trimmed;
  }

  throw new Error(`Expected ${fieldName} to be a non-empty string or number.`);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizePostedMessage(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function truncate(value: string, limit = 500): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}...`;
}

function buildTraceId(payload: CampfireWebhookPayload): string {
  return `campfire:${payload.room.id}:${payload.message.id}`;
}

function hasExplicitMergeApproval(command: string): boolean {
  return /\b(merge|ship|land)\b/i.test(command);
}

function buildAgentInstructions(services: MissionControlServices): string {
  const repoRoot = services.repo?.rootPath() ?? "not configured";

  return [
    KRYO_BOT_SYSTEM_PROMPT,
    "",
    "Return JSON only. No prose outside JSON.",
    'Use {"type":"reply","message":"..."} when you are done or need clarification.',
    'Use {"type":"action","progress":"...","action":"...","args":{...}} to run one action.',
    "",
    "Available actions:",
    "- board_status { boardId? }",
    "- blocked_work { boardId? }",
    "- get_card { cardId }",
    "- comment_card { cardId, comment }",
    "- move_card { cardId, targetColumn, message? }",
    "- pick_up_next { priorityTag? }",
    "- create_card { title, body?, column?, tags? }",
    "- submit_for_review { cardId, branch, title, body?, base?, repo? }",
    "- merge_pr { cardId, prNumber, repo? }",
    "- repo_list_files { path? }",
    "- repo_read_file { path }",
    "- repo_write_file { path, content }",
    "- repo_replace_in_file { path, oldText, newText }",
    "- repo_git_status {}",
    "- repo_git_diff {}",
    "- repo_current_branch {}",
    "- repo_create_branch { branch }",
    "- repo_commit_all { message }",
    "- repo_push_current_branch {}",
    "- repo_run_command { command }",
    "",
    `Protected default branch: ${services.config.github.defaultBranch}`,
    `Configured repo root: ${repoRoot}`,
    "Never call merge_pr unless the user explicitly approved a merge in the current message.",
  ].join("\n");
}

async function postProgress(
  services: MissionControlServices,
  payload: CampfireWebhookPayload,
  message: string | undefined,
): Promise<void> {
  if (!message) {
    return;
  }

  await services.campfire
    .postMessage({
      body: message,
      roomId: String(payload.room.id),
      roomPath: payload.room.path,
      roomName: payload.room.name,
    })
    .catch((error) => {
      services.logger.warn("Bot progress update skipped.", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

async function executeAction(
  services: MissionControlServices,
  payload: CampfireWebhookPayload,
  decision: AgentDecision,
): Promise<string> {
  const args = decision.args ?? {};
  const notifyOptions = {
    roomId: String(payload.room.id),
    roomPath: payload.room.path,
  };

  switch (decision.action) {
    case "board_status": {
      const result = await getBoardStatus(
        services,
        asOptionalString(args.boardId),
      );
      return toPlainText(result.markdown);
    }
    case "blocked_work": {
      const result = await getBlockedWork(
        services,
        asOptionalString(args.boardId),
      );
      return toPlainText(result.markdown);
    }
    case "get_card": {
      const card = await services.fizzy.getCard(
        asCardReference(args.cardId, "cardId"),
      );
      return JSON.stringify({
        number: card.number,
        title: card.title,
        status: card.status,
        board: card.board.name,
        column: card.column?.name ?? services.config.workflow.triageLabel,
        url: card.url,
        description: card.description ?? "",
        tags: card.tags,
        assignees: card.assignees.map((assignee) => assignee.name),
      });
    }
    case "comment_card": {
      const card = await services.fizzy.getCard(
        asCardReference(args.cardId, "cardId"),
      );
      await services.fizzy.addComment(card, asString(args.comment, "comment"));
      return `Commented on ${cardLabel(card)}.`;
    }
    case "move_card": {
      const result = await updateProgress(
        services,
        {
          cardId: asCardReference(args.cardId, "cardId"),
          targetColumn: asString(args.targetColumn, "targetColumn"),
          message: asOptionalString(args.message),
        },
        notifyOptions,
      );
      return result.summary;
    }
    case "pick_up_next": {
      const result = await pickUpWork(
        services,
        { priorityTag: asOptionalString(args.priorityTag) },
        notifyOptions,
      );
      return result.summary;
    }
    case "create_card": {
      const result = await createCard(
        services,
        {
          title: asString(args.title, "title"),
          body: asOptionalString(args.body),
          column: asOptionalString(args.column),
          tags: asStringArray(args.tags),
        },
        notifyOptions,
      );
      return result.summary;
    }
    case "submit_for_review": {
      const result = await submitForReview(
        services,
        {
          cardId: asCardReference(args.cardId, "cardId"),
          branch: asString(args.branch, "branch"),
          title: asString(args.title, "title"),
          body: asOptionalString(args.body),
          base: asOptionalString(args.base),
          repo: asOptionalString(args.repo),
        },
        notifyOptions,
      );
      return result.summary;
    }
    case "merge_pr": {
      if (!hasExplicitMergeApproval(payload.message.body.plain)) {
        throw new Error(
          "Merge requires explicit approval in the current message.",
        );
      }

      const result = await completeWork(
        services,
        {
          cardId: asCardReference(args.cardId, "cardId"),
          prNumber: asNumber(args.prNumber, "prNumber"),
          repo: asOptionalString(args.repo),
        },
        notifyOptions,
      );
      return result.summary;
    }
    case "repo_list_files": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return JSON.stringify(
        await services.repo.listFiles(asOptionalString(args.path)),
      );
    }
    case "repo_read_file": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return await services.repo.readFile(asString(args.path, "path"));
    }
    case "repo_write_file": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      await services.repo.writeFile(
        asString(args.path, "path"),
        asString(args.content, "content"),
      );
      return `Wrote ${asString(args.path, "path")}.`;
    }
    case "repo_replace_in_file": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      await services.repo.replaceInFile(
        asString(args.path, "path"),
        asString(args.oldText, "oldText"),
        asString(args.newText, "newText"),
      );
      return `Updated ${asString(args.path, "path")}.`;
    }
    case "repo_git_status": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return await services.repo.gitStatus();
    }
    case "repo_git_diff": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return await services.repo.gitDiff();
    }
    case "repo_current_branch": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return await services.repo.currentBranch();
    }
    case "repo_create_branch": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return `Created branch ${await services.repo.createBranch(asString(args.branch, "branch"))}.`;
    }
    case "repo_commit_all": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return await services.repo.commitAll(asString(args.message, "message"));
    }
    case "repo_push_current_branch": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return await services.repo.pushCurrentBranch();
    }
    case "repo_run_command": {
      if (!services.repo) {
        throw new Error("Local repo access is not configured.");
      }

      return await services.repo.runAllowedCommand(
        asString(args.command, "command"),
      );
    }
    default:
      throw new Error(`Unsupported action ${decision.action ?? "unknown"}.`);
  }
}

export async function handleCampfireAgentCommand(
  services: MissionControlServices,
  payload: CampfireWebhookPayload,
): Promise<string> {
  const dispatch = dispatchCampfireAgentCommand(services, payload);
  void dispatch.completion;
  return dispatch.immediateReply;
}

async function postFinalMessage(
  services: MissionControlServices,
  payload: CampfireWebhookPayload,
  message: string,
): Promise<void> {
  await services.campfire.postMessage({
    body: message,
    roomId: String(payload.room.id),
    roomPath: payload.room.path,
    roomName: payload.room.name,
  });
}

function dispatchCampfireAgentCommand(
  services: MissionControlServices,
  payload: CampfireWebhookPayload,
): AgentRequestDispatch {
  const model = services.model;
  if (!model) {
    return {
      immediateReply: "Failed — bot agent mode is not configured. ✗",
      completion: Promise.resolve(),
    };
  }

  const immediateReply = `Working on it: ${payload.message.body.plain.trim()}. ⏳`;
  const completion = (async () => {
    try {
      const traceId = buildTraceId(payload);
      let lastActionResult: string | undefined;
      services.logger.info("Agent request started", {
        traceId,
        roomId: String(payload.room.id),
        roomName: payload.room.name,
        messageId: String(payload.message.id),
        sender: payload.user.name,
        command: payload.message.body.plain.trim(),
      });
      const recentMessages = await services.campfire
        .getRecentMessages(String(payload.room.id), 6)
        .catch(() => []);

      const messages: ChatMessage[] = [
        {
          role: "system" as const,
          content: buildAgentInstructions(services),
        },
        {
          role: "user" as const,
          content: [
            `Room: ${payload.room.name} (${payload.room.id})`,
            `Sender: ${payload.user.name}`,
            `Current message: ${payload.message.body.plain}`,
            "Recent messages:",
            recentMessages
              .map((message) => `- ${message.senderName}: ${message.body}`)
              .join("\n") || "- none",
          ].join("\n"),
        },
      ];

      for (let step = 0; step < services.config.bot.maxAgentSteps; step += 1) {
        const completion = await model.complete({
          messages,
          temperature: 0.1,
          traceId,
          metadata: {
            agentStep: step + 1,
            roomId: String(payload.room.id),
            messageId: String(payload.message.id),
          },
        });
        const decision = parseDecision(completion);
        services.logger.info("Agent decision", {
          traceId,
          step: step + 1,
          type: decision.type,
          progress: decision.progress,
          action: decision.action,
          args: decision.args,
          message:
            decision.type === "reply"
              ? truncate(asString(decision.message, "message"))
              : undefined,
        });

        if (decision.type === "reply") {
          const finalMessage = asString(decision.message, "message");
          if (
            !lastActionResult ||
            normalizePostedMessage(finalMessage) !==
              normalizePostedMessage(lastActionResult)
          ) {
            await postFinalMessage(services, payload, finalMessage);
          }
          services.logger.info("Agent request completed", {
            traceId,
            step: step + 1,
            finalMessage: truncate(finalMessage),
            suppressedDuplicateFinalReply:
              !!lastActionResult &&
              normalizePostedMessage(finalMessage) ===
                normalizePostedMessage(lastActionResult),
          });
          return;
        }

        await postProgress(services, payload, decision.progress);

        try {
          const result = await executeAction(services, payload, decision);
          lastActionResult = result;
          services.logger.info("Agent action succeeded", {
            traceId,
            step: step + 1,
            action: decision.action,
            result: truncate(result),
          });
          messages.push({
            role: "assistant",
            content: JSON.stringify(decision),
          });
          messages.push({
            role: "user",
            content: `ACTION_RESULT\n${result}`,
          });
        } catch (error) {
          services.logger.warn("Agent action failed", {
            traceId,
            step: step + 1,
            action: decision.action,
            error: error instanceof Error ? error.message : String(error),
          });
          messages.push({
            role: "assistant",
            content: JSON.stringify(decision),
          });
          messages.push({
            role: "user",
            content: `ACTION_ERROR\n${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      }

      await postFinalMessage(
        services,
        payload,
        "Stopped before finishing. Narrow the request or ask me to continue from the current state.",
      );
      services.logger.warn("Agent request stopped before completion", {
        traceId,
        maxSteps: services.config.bot.maxAgentSteps,
      });
    } catch (error) {
      const traceId = buildTraceId(payload);
      await postFinalMessage(
        services,
        payload,
        `Failed — ${error instanceof Error ? error.message : String(error)} ✗`,
      ).catch((postError) => {
        services.logger.error("Agent background failure could not be posted.", {
          error:
            postError instanceof Error ? postError.message : String(postError),
        });
      });
      services.logger.error("Agent request failed", {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return {
    immediateReply,
    completion,
  };
}
