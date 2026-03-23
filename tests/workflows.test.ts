import assert from "node:assert/strict";
import test from "node:test";

import { Logger } from "../src/logger.js";
import type { MissionControlServices } from "../src/runtime.js";
import type {
  FizzyBoard,
  FizzyCard,
  FizzyColumn,
  FizzyUser,
  GitHubCheckSummary,
} from "../src/types.js";
import {
  completeWork,
  createCard,
  getBoardStatus,
  pickUpWork,
  submitForReview,
  troubleshoot,
} from "../src/workflows/index.js";
import { updateProgress } from "../src/workflows/update-progress.js";

const now = "2026-03-20T00:00:00.000Z";

const creator: FizzyUser = {
  id: "user-creator",
  name: "Kryo",
};

const board: FizzyBoard = {
  id: "board-1",
  name: "Kryo",
  all_access: true,
  created_at: now,
  url: "http://fizzy/boards/board-1",
  creator,
};

function makeColumn(id: string, name: string): FizzyColumn {
  return {
    id,
    name,
    color: "var(--color-card-default)",
    created_at: now,
  };
}

function makeCard(overrides: Partial<FizzyCard> = {}): FizzyCard {
  return {
    id: overrides.id ?? "card-1",
    number: overrides.number ?? 1,
    title: overrides.title ?? "Implement health endpoint",
    status: overrides.status ?? "published",
    description: overrides.description ?? "Add a health endpoint.",
    description_html:
      overrides.description_html ?? "<p>Add a health endpoint.</p>",
    image_url: overrides.image_url ?? null,
    has_attachments: overrides.has_attachments ?? false,
    tags: overrides.tags ?? [],
    closed: overrides.closed ?? false,
    postponed: overrides.postponed ?? false,
    golden: overrides.golden ?? false,
    last_active_at: overrides.last_active_at ?? now,
    created_at: overrides.created_at ?? now,
    url: overrides.url ?? "http://fizzy/cards/1",
    board: overrides.board ?? board,
    creator: overrides.creator ?? creator,
    assignees: overrides.assignees ?? [],
    has_more_assignees: overrides.has_more_assignees ?? false,
    comments_url: overrides.comments_url ?? "http://fizzy/cards/1/comments",
    reactions_url: overrides.reactions_url ?? "http://fizzy/cards/1/reactions",
    steps: overrides.steps ?? [],
    ...(overrides.column ? { column: overrides.column } : {}),
  };
}

function toCard(reference: unknown, fallback: FizzyCard): FizzyCard {
  if (reference && typeof reference === "object" && "id" in reference) {
    return reference as FizzyCard;
  }

  return fallback;
}

function createMockServices(input: {
  fizzy: Record<string, unknown>;
  github?: Record<string, unknown>;
}): MissionControlServices {
  return {
    config: {
      limits: {
        cardDescriptionPreview: 500,
        boardStatusVisibleCards: 5,
        troubleshootErrorOutput: 1500,
      },
      workflow: {
        todoColumnName: "To Do",
        inProgressColumnName: "In Progress",
        reviewColumnName: "Review",
        blockedColumnName: "Blocked",
        doneLabel: "Done",
        notNowLabel: "Not Now",
        triageLabel: "Triage",
      },
    } as MissionControlServices["config"],
    logger: new Logger("error"),
    fizzy: input.fizzy as unknown as MissionControlServices["fizzy"],
    github: (input.github ?? {}) as unknown as MissionControlServices["github"],
  };
}

test("pickUpWork assigns the oldest matching card", async () => {
  const toDo = makeColumn("col-todo", "To Do");
  const inProgress = makeColumn("col-progress", "In Progress");
  const currentUser: FizzyUser = { id: "user-1", name: "Ada" };

  const availableCard = makeCard({
    column: toDo,
    tags: ["p0"],
  });
  const assignedCard = makeCard({
    column: toDo,
    tags: ["p0"],
    assignees: [currentUser],
  });
  const movedCard = makeCard({
    column: inProgress,
    tags: ["p0"],
    assignees: [currentUser],
  });

  const assignedTo: string[] = [];

  const services = createMockServices({
    fizzy: {
      resolveBoardIdOrName: async () => board.id,
      getCurrentUser: async () => currentUser,
      findColumnByName: async (_boardId: string, name: string) => {
        if (name === "To Do") {
          return toDo;
        }

        if (name === "In Progress") {
          return inProgress;
        }

        return undefined;
      },
      listBoardCards: async () => [availableCard],
      ensureAssigned: async (_card: FizzyCard, userId: string) => {
        assignedTo.push(userId);
        return assignedCard;
      },
      getCard: async (reference: unknown) => toCard(reference, assignedCard),
      moveCardToColumn: async (_card: FizzyCard, columnId: string) => {
        assert.equal(columnId, inProgress.id);
        return movedCard;
      },
    },
  });

  const result = await pickUpWork(services, {
    priorityTag: "P0",
  });

  assert.equal(
    result.summary,
    "Picked up #1 Implement health endpoint and moved it to In Progress.",
  );
  assert.deepEqual(assignedTo, [currentUser.id]);
});

test("completeWork refuses to merge when checks are pending", async () => {
  const pendingChecks: GitHubCheckSummary = {
    overall: "pending",
    headSha: "abc123",
    combinedState: "pending",
    statuses: [
      {
        context: "ci/test",
        state: "pending",
        description: "Tests are still running",
      },
    ],
    checkRuns: [],
  };

  let merged = false;
  const services = createMockServices({
    fizzy: {
      getCard: async () => makeCard(),
    },
    github: {
      getPullRequestChecks: async () => pendingChecks,
      mergePullRequest: async () => {
        merged = true;
        return { merged: true, message: "unexpected merge" };
      },
    },
  });

  const result = await completeWork(services, {
    cardId: "card-1",
    prNumber: 42,
  });

  assert.equal(
    result.summary,
    "PR #42 was not merged because checks are pending.",
  );
  assert.equal(merged, false);
  assert.match(result.markdown, /Overall check state: pending/);
});

test("submitForReview reports partial success when Fizzy follow-up fails", async () => {
  const review = makeColumn("col-review", "Review");
  const card = makeCard();

  const services = createMockServices({
    fizzy: {
      getCard: async (reference: unknown) => toCard(reference, card),
      addComment: async () => {
        throw new Error("comment service unavailable");
      },
      findColumnByName: async (_boardId: string, name: string) =>
        name === "Review" ? review : undefined,
      moveCardToColumn: async () =>
        makeCard({
          column: review,
        }),
    },
    github: {
      createPullRequest: async () => ({
        number: 17,
        html_url: "http://gitea/pr/17",
      }),
    },
  });

  const result = await submitForReview(services, {
    cardId: "card-1",
    branch: "feature/health",
    title: "Add health endpoint",
  });

  assert.equal(
    result.summary,
    "⚠ Partial success: PR #17 was created for #1 Implement health endpoint, but follow-up updates failed.",
  );
  assert.match(result.markdown, /PR #17: http:\/\/gitea\/pr\/17/);
  assert.match(
    result.markdown,
    /⚠ Card comment failed\. comment service unavailable/,
  );
  assert.match(result.markdown, /Card moved to Review\./);
});

test("completeWork reports partial success when card move fails after merge", async () => {
  const successfulChecks: GitHubCheckSummary = {
    overall: "success",
    headSha: "abc123",
    combinedState: "success",
    statuses: [],
    checkRuns: [],
  };

  const services = createMockServices({
    fizzy: {
      getCard: async () => makeCard(),
      findColumnByName: async () => undefined,
      closeCard: async () => {
        throw new Error("close service unavailable");
      },
    },
    github: {
      getPullRequestChecks: async () => successfulChecks,
      mergePullRequest: async () => ({
        merged: true,
        message: "Pull Request successfully merged",
      }),
    },
  });

  const result = await completeWork(services, {
    cardId: "card-1",
    prNumber: 42,
  });

  assert.equal(
    result.summary,
    "⚠ Partial success: PR #42 was merged, but #1 Implement health endpoint could not be moved to Done.",
  );
  assert.match(
    result.markdown,
    /Merge response: Pull Request successfully merged/,
  );
  assert.match(
    result.markdown,
    /⚠ Card move failed\. close service unavailable/,
  );
});

test("createCard applies tags and moves the card", async () => {
  const inProgress = makeColumn("col-progress", "In Progress");
  const createdCard = makeCard({
    id: "card-2",
    number: 2,
    title: "Fix auth timeout",
    tags: [],
  });
  const taggedCard = makeCard({
    id: "card-2",
    number: 2,
    title: "Fix auth timeout",
    tags: ["bug", "p1"],
  });
  const movedCard = makeCard({
    id: "card-2",
    number: 2,
    title: "Fix auth timeout",
    tags: ["bug", "p1"],
    column: inProgress,
  });

  const services = createMockServices({
    fizzy: {
      resolveBoardIdOrName: async (value?: string) => {
        assert.equal(value, "Kryo");
        return board.id;
      },
      createCard: async (
        _boardId: string,
        card: { title: string; description?: string },
      ) => {
        assert.equal(card.title, "Fix auth timeout");
        return createdCard;
      },
      ensureTags: async (_card: FizzyCard, tags: string[]) => {
        assert.deepEqual(tags, ["bug", "p1"]);
        return taggedCard;
      },
      findColumnByName: async (_boardId: string, name: string) =>
        name === "In Progress" ? inProgress : undefined,
      getCard: async (reference: unknown) => toCard(reference, taggedCard),
      moveCardToColumn: async (_card: FizzyCard, columnId: string) => {
        assert.equal(columnId, inProgress.id);
        return movedCard;
      },
    },
  });

  const result = await createCard(services, {
    boardId: "Kryo",
    title: "Fix auth timeout",
    body: "API calls fail after 7 seconds.",
    tags: ["bug", "p1"],
    column: "In Progress",
  });

  assert.equal(result.summary, "Created #2 Fix auth timeout on Kryo.");
  assert.match(result.markdown, /Placed in In Progress\./);
  assert.match(result.markdown, /Tags: bug, p1/);
});

test("getBoardStatus resolves a board name before reading cards", async () => {
  const services = createMockServices({
    fizzy: {
      resolveBoardIdOrName: async (value?: string) => {
        assert.equal(value, "Kryo");
        return board.id;
      },
      getBoard: async (boardId: string) => {
        assert.equal(boardId, board.id);
        return board;
      },
      listBoardCards: async (boardId: string) => {
        assert.equal(boardId, board.id);
        return [];
      },
    },
  });

  const result = await getBoardStatus(services, "Kryo");

  assert.match(result.summary, /Board Kryo:/);
  assert.match(result.markdown, /Board Status: Kryo/);
});

test('updateProgress maps "In Progress" to the active Fizzy state when no column exists', async () => {
  const triagedCard = makeCard({
    column: undefined,
    postponed: false,
    closed: false,
  });

  const services = createMockServices({
    fizzy: {
      getCard: async () => makeCard(),
      findColumnByName: async () => undefined,
      sendCardBackToTriage: async () => triagedCard,
    },
  });

  services.config.workflow.triageLabel = "Maybe";
  services.config.workflow.inProgressColumnName = "Maybe";

  const result = await updateProgress(services, {
    cardId: 1,
    targetColumn: "In Progress",
  });

  assert.equal(result.summary, "Moved #1 Implement health endpoint to Maybe.");
  assert.match(result.markdown, /Column: Maybe/);
});

test("troubleshoot writes raw context and error output", async () => {
  const comments: string[] = [];

  const services = createMockServices({
    fizzy: {
      getCard: async () => makeCard(),
      addComment: async (_card: FizzyCard, comment: string) => {
        comments.push(comment);
      },
    },
  });

  const result = await troubleshoot(services, {
    cardId: "card-1",
    errorOutput: "GET /health returned 404 Not Found",
    context: "running a deployment smoke test",
  });

  assert.equal(
    result.summary,
    "Added troubleshooting findings to #1 Implement health endpoint.",
  );
  assert.equal(comments.length, 1);
  const firstComment = comments[0];
  assert.ok(firstComment);
  assert.match(firstComment, /Context: running a deployment smoke test/);
  assert.match(firstComment, /GET \/health returned 404 Not Found/);
  assert.match(
    result.markdown,
    /Analysis: deferred to the caller or external reasoning layer\./,
  );
});
