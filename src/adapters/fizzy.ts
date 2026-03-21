import type { Logger } from "../logger.js";
import type {
  FizzyBoard,
  FizzyCard,
  FizzyColumn,
  FizzyComment,
  FizzyIdentity,
  FizzyTag,
  FizzyUser,
} from "../types.js";
import {
  nextLinkFromHeader,
  requestJson,
  requestJsonWithResponse,
  requestRaw,
} from "../utils/http.js";
import { normalizeName } from "../utils/markdown.js";

export type CardReference = number | string | Pick<FizzyCard, "id" | "number">;

export interface FizzyCardListFilters {
  boardIds?: string[] | undefined;
  tagIds?: string[] | undefined;
  assigneeIds?: string[] | undefined;
  creatorIds?: string[] | undefined;
  closerIds?: string[] | undefined;
  cardIds?: string[] | undefined;
  indexedBy?: string | undefined;
  sortedBy?: string | undefined;
  assignmentStatus?: "unassigned";
  creation?: string | undefined;
  closure?: string | undefined;
  terms?: string[] | undefined;
}

export interface CreateFizzyCardInput {
  title: string;
  description?: string | undefined;
  created_at?: string | undefined;
  last_active_at?: string | undefined;
}

export interface UpdateFizzyCardInput {
  title?: string | undefined;
  description?: string | undefined;
  last_active_at?: string | undefined;
}

export class FizzyClient {
  constructor(
    private readonly options: {
      baseUrl: string;
      accountId: string;
      apiToken: string;
      defaultBoardId?: string | undefined;
      selection?: "configured" | "require-explicit" | undefined;
      timeoutMs?: number | undefined;
      logger?: Logger | undefined;
    },
  ) {}

  get defaultBoardId(): string | undefined {
    return this.options.defaultBoardId;
  }

  async listBoards(): Promise<FizzyBoard[]> {
    return requestJson<FizzyBoard[]>(
      this.options.baseUrl,
      this.accountPath("boards.json"),
      {
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async getBoard(boardId: string): Promise<FizzyBoard> {
    return requestJson<FizzyBoard>(
      this.options.baseUrl,
      this.accountPath(`boards/${boardId}.json`),
      {
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async listColumns(boardId: string): Promise<FizzyColumn[]> {
    return requestJson<FizzyColumn[]>(
      this.options.baseUrl,
      this.accountPath(`boards/${boardId}/columns.json`),
      {
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async listTags(): Promise<FizzyTag[]> {
    return requestJson<FizzyTag[]>(
      this.options.baseUrl,
      this.accountPath("tags.json"),
      {
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async listBoardCards(
    boardId: string,
    filters: Omit<FizzyCardListFilters, "boardIds"> = {},
  ): Promise<FizzyCard[]> {
    return this.listCards({
      ...filters,
      boardIds: [boardId],
    });
  }

  async listCards(filters: FizzyCardListFilters = {}): Promise<FizzyCard[]> {
    const initialPath = this.accountPath("cards.json");
    const query = this.cardQuery(filters);
    const cards: FizzyCard[] = [];
    let nextPath: string | null = initialPath;
    let nextQuery: Record<string, string[] | string> | undefined = query;

    while (nextPath) {
      const { body, response } = await requestJsonWithResponse<FizzyCard[]>(
        this.options.baseUrl,
        nextPath,
        {
          headers: this.headers(),
          query: nextQuery,
          timeoutMs: this.options.timeoutMs,
        },
      );

      cards.push(...body);
      const next = nextLinkFromHeader(response.headers.get("link"));
      nextPath = next;
      nextQuery = undefined;
    }

    return cards;
  }

  async getCard(reference: CardReference): Promise<FizzyCard> {
    return this.resolveCard(reference);
  }

  async getCardByNumber(cardNumber: number): Promise<FizzyCard> {
    return requestJson<FizzyCard>(
      this.options.baseUrl,
      this.accountPath(`cards/${cardNumber}.json`),
      {
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async createCard(
    boardId: string,
    input: CreateFizzyCardInput,
  ): Promise<FizzyCard> {
    return requestJson<FizzyCard>(
      this.options.baseUrl,
      this.accountPath(`boards/${boardId}/cards.json`),
      {
        method: "POST",
        headers: this.headers(),
        body: { card: input },
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async updateCard(
    reference: CardReference,
    input: UpdateFizzyCardInput,
  ): Promise<FizzyCard> {
    const card = await this.resolveCard(reference);

    return requestJson<FizzyCard>(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}.json`),
      {
        method: "PUT",
        headers: this.headers(),
        body: { card: input },
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async moveCardToColumn(
    reference: CardReference,
    columnId: string,
  ): Promise<FizzyCard> {
    const card = await this.resolveCard(reference);

    await requestRaw(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/triage.json`),
      {
        method: "POST",
        headers: this.headers(),
        body: { column_id: columnId },
        timeoutMs: this.options.timeoutMs,
      },
    );

    return this.getCardByNumber(card.number);
  }

  async sendCardBackToTriage(reference: CardReference): Promise<FizzyCard> {
    const card = await this.resolveCard(reference);

    await requestRaw(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/triage.json`),
      {
        method: "DELETE",
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );

    return this.getCardByNumber(card.number);
  }

  async moveCardToNotNow(reference: CardReference): Promise<FizzyCard> {
    const card = await this.resolveCard(reference);

    await requestRaw(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/not_now.json`),
      {
        method: "POST",
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );

    return this.getCardByNumber(card.number);
  }

  async closeCard(reference: CardReference): Promise<FizzyCard> {
    const card = await this.resolveCard(reference);

    await requestRaw(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/closure.json`),
      {
        method: "POST",
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );

    return this.getCardByNumber(card.number);
  }

  async reopenCard(reference: CardReference): Promise<FizzyCard> {
    const card = await this.resolveCard(reference);

    await requestRaw(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/closure.json`),
      {
        method: "DELETE",
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );

    return this.getCardByNumber(card.number);
  }

  async toggleAssignment(
    reference: CardReference,
    assigneeId: string,
  ): Promise<void> {
    const card = await this.resolveCard(reference);

    await requestRaw(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/assignments.json`),
      {
        method: "POST",
        headers: this.headers(),
        body: { assignee_id: assigneeId },
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async ensureAssigned(
    reference: CardReference,
    assigneeId: string,
  ): Promise<FizzyCard> {
    const card = await this.resolveCard(reference);

    if (!card.assignees.some((assignee) => assignee.id === assigneeId)) {
      await this.toggleAssignment(card, assigneeId);
    }

    return this.getCardByNumber(card.number);
  }

  async toggleTag(reference: CardReference, tagTitle: string): Promise<void> {
    const card = await this.resolveCard(reference);

    await requestRaw(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/taggings.json`),
      {
        method: "POST",
        headers: this.headers(),
        body: { tag_title: tagTitle },
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async ensureTags(
    reference: CardReference,
    tagTitles: string[],
  ): Promise<FizzyCard> {
    const card = await this.resolveCard(reference);
    const existing = new Set(card.tags.map((tag) => normalizeName(tag)));

    for (const tagTitle of tagTitles) {
      if (!existing.has(normalizeName(tagTitle))) {
        await this.toggleTag(card, tagTitle);
      }
    }

    return this.getCardByNumber(card.number);
  }

  async listComments(reference: CardReference): Promise<FizzyComment[]> {
    const card = await this.resolveCard(reference);
    return requestJson<FizzyComment[]>(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/comments.json`),
      {
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async addComment(
    reference: CardReference,
    body: string,
  ): Promise<FizzyComment> {
    const card = await this.resolveCard(reference);

    return requestJson<FizzyComment>(
      this.options.baseUrl,
      this.accountPath(`cards/${card.number}/comments.json`),
      {
        method: "POST",
        headers: this.headers(),
        body: { comment: { body } },
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async getIdentity(): Promise<FizzyIdentity> {
    return requestJson<FizzyIdentity>(
      this.options.baseUrl,
      "/my/identity.json",
      {
        headers: this.headers(),
        timeoutMs: this.options.timeoutMs,
      },
    );
  }

  async getCurrentUser(): Promise<FizzyUser> {
    const identity = await this.getIdentity();
    const account = identity.accounts.find((candidate) => {
      const slug = candidate.slug.replace(/^\//, "");
      return (
        slug === this.options.accountId ||
        candidate.id === this.options.accountId
      );
    });

    if (!account) {
      throw new Error(
        `Unable to resolve the current Fizzy user for account ${this.options.accountId}`,
      );
    }

    return account.user;
  }

  async findColumnByName(
    boardId: string,
    columnName: string,
  ): Promise<FizzyColumn | null> {
    const columns = await this.listColumns(boardId);
    return (
      columns.find(
        (column) => normalizeName(column.name) === normalizeName(columnName),
      ) ?? null
    );
  }

  resolveBoardId(boardId?: string): string {
    if (boardId) {
      return boardId;
    }

    if (
      this.options.selection !== "require-explicit" &&
      this.options.defaultBoardId
    ) {
      return this.options.defaultBoardId;
    }

    throw new Error(
      this.options.selection === "require-explicit"
        ? "A Fizzy board ID must be provided explicitly for this workflow."
        : "No Fizzy board was provided and FIZZY_BOARD_ID is not configured.",
    );
  }

  async resolveCard(reference: CardReference): Promise<FizzyCard> {
    if (typeof reference === "object") {
      if (typeof reference.number === "number") {
        return this.getCardByNumber(reference.number);
      }

      return this.findCardById(reference.id);
    }

    const numeric = this.extractCardNumber(reference);

    if (numeric !== null) {
      return this.getCardByNumber(numeric);
    }

    return this.findCardById(String(reference));
  }

  private async findCardById(cardId: string): Promise<FizzyCard> {
    const cards = await this.listCards({ cardIds: [cardId] });
    const card = cards[0];

    if (!card) {
      throw new Error(`Unable to find Fizzy card ${cardId}`);
    }

    return this.getCardByNumber(card.number);
  }

  private extractCardNumber(reference: string | number): number | null {
    if (typeof reference === "number") {
      return reference;
    }

    if (/^\d+$/.test(reference)) {
      return Number(reference);
    }

    const urlMatch = reference.match(/\/cards\/(\d+)(?:\.json)?$/);
    if (urlMatch?.[1]) {
      return Number(urlMatch[1]);
    }

    return null;
  }

  private accountPath(path: string): string {
    const trimmed = path.replace(/^\/+/, "");
    return `/${this.options.accountId}/${trimmed}`;
  }

  private headers(): HeadersInit {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.options.apiToken}`,
    };
  }

  private cardQuery(
    filters: FizzyCardListFilters,
  ): Record<string, string[] | string> {
    const query: Record<string, string[] | string> = {};

    if (filters.boardIds?.length) {
      query["board_ids[]"] = filters.boardIds;
    }
    if (filters.tagIds?.length) {
      query["tag_ids[]"] = filters.tagIds;
    }
    if (filters.assigneeIds?.length) {
      query["assignee_ids[]"] = filters.assigneeIds;
    }
    if (filters.creatorIds?.length) {
      query["creator_ids[]"] = filters.creatorIds;
    }
    if (filters.closerIds?.length) {
      query["closer_ids[]"] = filters.closerIds;
    }
    if (filters.cardIds?.length) {
      query["card_ids[]"] = filters.cardIds;
    }
    if (filters.terms?.length) {
      query["terms[]"] = filters.terms;
    }
    if (filters.indexedBy) {
      query.indexed_by = filters.indexedBy;
    }
    if (filters.sortedBy) {
      query.sorted_by = filters.sortedBy;
    }
    if (filters.assignmentStatus) {
      query.assignment_status = filters.assignmentStatus;
    }
    if (filters.creation) {
      query.creation = filters.creation;
    }
    if (filters.closure) {
      query.closure = filters.closure;
    }

    return query;
  }
}
