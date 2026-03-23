import {
  type McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MissionControlServices } from "../runtime.js";
import { getBoardStatus } from "../workflows/board-status.js";

const BOARD_RESOURCE_CACHE_TTL_MS = 30_000;

export function registerBoardStatusResource(
  server: McpServer,
  services: MissionControlServices,
): void {
  let cachedBoards:
    | {
        loadedAt: number;
        boards: Awaited<
          ReturnType<MissionControlServices["fizzy"]["listBoards"]>
        >;
      }
    | undefined;

  async function getBoardsForResource() {
    const now = Date.now();
    if (
      cachedBoards &&
      now - cachedBoards.loadedAt < BOARD_RESOURCE_CACHE_TTL_MS
    ) {
      return cachedBoards.boards;
    }

    const boards = await services.fizzy.listBoards();
    cachedBoards = {
      loadedAt: now,
      boards,
    };
    return boards;
  }

  const template = new ResourceTemplate("board://status/{boardId}", {
    list: async () => {
      const boards = await getBoardsForResource();
      return {
        resources: boards.map((board) => ({
          uri: `board://status/${board.id}`,
          name: `board-status-${board.id}`,
          title: board.name,
          description: `Current board state for ${board.name}`,
          mimeType: "text/markdown",
        })),
      };
    },
    complete: {
      boardId: async (value) => {
        const boards = await getBoardsForResource();
        return boards
          .map((board) => board.id)
          .filter((boardId) => boardId.startsWith(value));
      },
    },
  });

  server.registerResource(
    "board-status",
    template,
    {
      title: "Board Status",
      description: "Grouped Fizzy board state by column and lifecycle bucket.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const boardId = String(variables.boardId);
      const result = await getBoardStatus(services, boardId);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text: result.markdown,
          },
        ],
      };
    },
  );
}
