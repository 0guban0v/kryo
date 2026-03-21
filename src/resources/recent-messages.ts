import {
  type McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MissionControlServices } from "../runtime.js";
import { bullet, heading, joinSections } from "../utils/markdown.js";

export function registerRecentMessagesResource(
  server: McpServer,
  services: MissionControlServices,
): void {
  const template = new ResourceTemplate("chat://recent/{roomId}", {
    list: async () => {
      const rooms = await services.campfire.listRooms();
      return {
        resources: rooms.map((room) => ({
          uri: `chat://recent/${room.id}`,
          name: `recent-messages-${room.id}`,
          title: room.name,
          description: `Recent Campfire messages for ${room.name}`,
          mimeType: "text/markdown",
        })),
      };
    },
    complete: {
      roomId: async (value) => {
        const rooms = await services.campfire.listRooms();
        return rooms
          .map((room) => room.id)
          .filter((roomId) => roomId.startsWith(value));
      },
    },
  });

  server.registerResource(
    "recent-messages",
    template,
    {
      title: "Recent Campfire Messages",
      description:
        "Recent Campfire room activity using API reads when available, or the observed transcript fallback.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const roomId = String(variables.roomId);
      const messages = await services.campfire.getRecentMessages(roomId, 20);
      const markdown = joinSections([
        heading(`Recent Messages: ${roomId}`, 2),
        messages.length
          ? bullet(
              messages.map(
                (message) =>
                  `[${message.observedAt}] ${message.senderName}: ${message.body}`,
              ),
            )
          : "No recent messages were available for this room.",
      ]);

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text: markdown,
          },
        ],
      };
    },
  );
}
