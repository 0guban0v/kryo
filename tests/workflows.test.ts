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
  pickUpWork,
  troubleshoot,
} from "../src/workflows/index.js";

const now = "2026-03-20T00:00:00.000Z";

const creator: FizzyUser = {
  id: "user-creator",
  name: "Mission Control",
};

const board: FizzyBoard = {
  id: "board-1",
  name: "Mission Control",
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
  campfire?: Record<string, unknown>;
  github?: Record<string, unknown>;
}): MissionControlServices {
  return {
    config: {} as MissionControlServices["config"],
    logger: new Logger("error"),
    fizzy: input.fizzy as unknown as MissionControlServices["fizzy"],
    campfire: (input.campfire ??
      {}) as unknown as MissionControlServices["campfire"],
    github: (input.github ?? {}) as unknown as MissionControlServices["github"],
  };
}

test("pickUpWork assigns the oldest matching card and notifies Campfire", async () => {
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

  const notifications: string[] = [];
  const assignedTo: string[] = [];

  const services = createMockServices({
    fizzy: {
      resolveBoardId: () => board.id,
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
    campfire: {
      postMessage: async ({ body }: { body: string }) => {
        notifications.push(body);
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
  assert.equal(notifications.length, 1);
  const firstNotification = notifications[0];
  assert.ok(firstNotification);
  assert.match(firstNotification, /Assigned to Ada\./);
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
  let notifications = 0;

  const services = createMockServices({
    fizzy: {
      getCard: async () => makeCard(),
    },
    campfire: {
      postMessage: async () => {
        notifications += 1;
      },
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
  assert.equal(notifications, 0);
  assert.match(result.markdown, /Overall check state: pending/);
});

test("createCard applies tags, moves the card, and notifies Campfire", async () => {
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

  const notifications: string[] = [];

  const services = createMockServices({
    fizzy: {
      resolveBoardId: () => board.id,
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
    campfire: {
      postMessage: async ({ body }: { body: string }) => {
        notifications.push(body);
      },
    },
  });

  const result = await createCard(services, {
    title: "Fix auth timeout",
    body: "API calls fail after 7 seconds.",
    tags: ["bug", "p1"],
    column: "In Progress",
  });

  assert.equal(
    result.summary,
    "Created #2 Fix auth timeout on Mission Control.",
  );
  assert.equal(notifications.length, 1);
  assert.match(result.markdown, /Placed in In Progress\./);
  assert.match(result.markdown, /Tags: bug, p1/);
});

test("troubleshoot writes a targeted health-endpoint comment and notifies Campfire", async () => {
  const comments: string[] = [];
  const notifications: string[] = [];

  const services = createMockServices({
    fizzy: {
      getCard: async () => makeCard(),
      addComment: async (_card: FizzyCard, comment: string) => {
        comments.push(comment);
      },
    },
    campfire: {
      postMessage: async ({ body }: { body: string }) => {
        notifications.push(body);
      },
    },
  });

  const result = await troubleshoot(services, {
    cardId: "card-1",
    errorOutput: "GET /health returned 404 Not Found",
  });

  assert.equal(
    result.summary,
    "Added troubleshooting findings to #1 Implement health endpoint.",
  );
  assert.equal(comments.length, 1);
  const firstComment = comments[0];
  assert.ok(firstComment);
  assert.match(firstComment, /\/health` endpoint that does not exist yet/);
  assert.match(result.markdown, /Priority: p1/);
  assert.equal(notifications.length, 1);
  const firstTroubleshootNotification = notifications[0];
  assert.ok(firstTroubleshootNotification);
  assert.match(firstTroubleshootNotification, /Likely root cause/);
});
