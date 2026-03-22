import type { Logger } from "../logger.js";
import type {
  CampfireObservedMessage,
  CampfireRoomSummary,
  CampfireWebhookPayload,
} from "../types.js";
import { errorMessage, requestJson, requestText } from "../utils/http.js";

interface CampfireApiRoom {
  id: string | number;
  name: string;
}

interface CampfireApiMessage {
  id: string | number;
  created_at?: string | undefined;
  body?: {
    plain?: string | undefined;
    plain_text?: string | undefined;
  };
  creator?: {
    name: string;
  };
}

class RoomTranscriptStore {
  constructor(private readonly maxMessages: number) {}

  private readonly rooms = new Map<string, CampfireRoomSummary>();
  private readonly messages = new Map<string, CampfireObservedMessage[]>();

  registerRoom(room: CampfireRoomSummary): void {
    this.rooms.set(room.id, room);
  }

  observe(message: CampfireObservedMessage): void {
    this.registerRoom({
      id: message.roomId,
      name: message.roomName,
      path: message.path,
    });

    const roomMessages = this.messages.get(message.roomId) ?? [];
    roomMessages.push(message);
    this.messages.set(message.roomId, roomMessages.slice(-this.maxMessages));
  }

  listRooms(): CampfireRoomSummary[] {
    return Array.from(this.rooms.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  recentMessages(roomId: string, limit = 20): CampfireObservedMessage[] {
    return (this.messages.get(roomId) ?? []).slice(-limit).reverse();
  }
}

export class CampfireClient {
  private readonly transcripts: RoomTranscriptStore;

  constructor(
    private readonly options: {
      baseUrl: string;
      botKey?: string | undefined;
      defaultRoomId?: string | undefined;
      selection?: "configured" | "require-explicit" | undefined;
      sessionCookie?: string | undefined;
      transcriptLimit?: number | undefined;
      recentMessagesLimit?: number | undefined;
      timeoutMs?: number | undefined;
      logger?: Logger | undefined;
    },
  ) {
    this.transcripts = new RoomTranscriptStore(options.transcriptLimit ?? 100);

    if (options.defaultRoomId) {
      this.transcripts.registerRoom({
        id: options.defaultRoomId,
        name: `Room ${options.defaultRoomId}`,
      });
    }
  }

  observeWebhook(payload: CampfireWebhookPayload): void {
    this.transcripts.observe({
      roomId: String(payload.room.id),
      roomName: payload.room.name,
      messageId: String(payload.message.id),
      body: payload.message.body.plain,
      senderName: payload.user.name,
      observedAt: new Date().toISOString(),
      path: payload.room.path,
      source: "webhook",
    });
  }

  async postMessage(input: {
    body: string;
    roomId?: string | undefined;
    roomName?: string | undefined;
    roomPath?: string | undefined;
  }): Promise<void> {
    const path = input.roomPath ?? this.buildRoomPath(input.roomId);

    if (!path) {
      throw new Error(
        "Unable to post to Campfire because no room path or CAMPFIRE_ROOM_ID is available.",
      );
    }

    await requestText(this.options.baseUrl, path, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: input.body,
      timeoutMs: this.options.timeoutMs,
    });

    const roomId = input.roomId ?? this.extractRoomIdFromPath(path);
    if (roomId) {
      this.transcripts.observe({
        roomId,
        roomName: input.roomName ?? `Room ${roomId}`,
        body: input.body,
        senderName: "kryo",
        observedAt: new Date().toISOString(),
        path,
        source: "bot",
      });
    }
  }

  async listRooms(): Promise<CampfireRoomSummary[]> {
    if (!this.options.sessionCookie) {
      return this.transcripts.listRooms();
    }

    try {
      const rooms = await requestJson<CampfireApiRoom[]>(
        this.options.baseUrl,
        "/rooms.json",
        {
          headers: this.apiHeaders(),
          timeoutMs: this.options.timeoutMs,
        },
      );

      return rooms.map((room) => ({
        id: String(room.id),
        name: room.name,
      }));
    } catch (error) {
      this.options.logger?.warn(
        "Campfire room listing fell back to the in-memory transcript store.",
        errorMessage(error),
      );
      return this.transcripts.listRooms();
    }
  }

  async getRecentMessages(
    roomId: string,
    limit = this.options.recentMessagesLimit ?? 20,
  ): Promise<CampfireObservedMessage[]> {
    if (!this.options.sessionCookie) {
      return this.transcripts.recentMessages(roomId, limit);
    }

    try {
      const messages = await requestJson<CampfireApiMessage[]>(
        this.options.baseUrl,
        `/rooms/${roomId}/messages.json`,
        {
          headers: this.apiHeaders(),
          query: { limit },
          timeoutMs: this.options.timeoutMs,
        },
      );

      return messages
        .map((message) => ({
          roomId,
          roomName: `Room ${roomId}`,
          messageId: String(message.id),
          body:
            message.body?.plain ??
            message.body?.plain_text ??
            "[message body unavailable]",
          senderName: message.creator?.name ?? "Unknown sender",
          observedAt: message.created_at ?? new Date().toISOString(),
          source: "api" as const,
        }))
        .reverse();
    } catch (error) {
      this.options.logger?.warn(
        "Campfire message listing fell back to the in-memory transcript store.",
        errorMessage(error),
      );
      return this.transcripts.recentMessages(roomId, limit);
    }
  }

  buildRoomPath(roomId?: string): string | null {
    const resolvedRoomId =
      roomId ??
      (this.options.selection !== "require-explicit"
        ? this.options.defaultRoomId
        : undefined);

    if (!resolvedRoomId) {
      return null;
    }

    if (!this.options.botKey) {
      throw new Error(
        "CAMPFIRE_BOT_KEY is required for proactive Campfire notifications.",
      );
    }

    return `/rooms/${encodeURIComponent(resolvedRoomId)}/${encodeURIComponent(this.options.botKey)}/messages`;
  }

  private apiHeaders(): HeadersInit {
    return {
      Accept: "application/json",
      Cookie: this.options.sessionCookie ?? "",
    };
  }

  private extractRoomIdFromPath(path: string): string | null {
    const match = path.match(/\/rooms\/([^/]+)/);
    return match?.[1] ?? null;
  }
}
