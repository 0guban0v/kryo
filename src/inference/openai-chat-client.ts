import type { Logger } from "../logger.js";
import { requestJson } from "../utils/http.js";
import type { ChatCompletionInput, ChatModelClient } from "./model-client.js";

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
    };
  }>;
}

function truncate(value: string, limit = 800): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}...`;
}

function normalizeContent(
  content: string | Array<{ type?: string; text?: string }> | null | undefined,
): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
      .join("")
      .trim();
  }

  return "";
}

export class OpenAICompatibleChatClient implements ChatModelClient {
  constructor(
    private readonly options: {
      baseUrl: string;
      model: string;
      apiKey?: string | undefined;
      path: string;
      timeoutMs: number;
      logIo?: boolean | undefined;
      logger?: Logger | undefined;
    },
  ) {}

  async complete(input: ChatCompletionInput): Promise<string> {
    const startedAt = Date.now();
    if (this.options.logIo) {
      this.options.logger?.info("LLM request", {
        traceId: input.traceId,
        model: this.options.model,
        path: this.options.path,
        temperature: input.temperature ?? 0.1,
        metadata: input.metadata,
        messages: input.messages.map((message) => ({
          role: message.role,
          content: truncate(message.content),
        })),
      });
    }

    const response = await requestJson<OpenAIChatCompletionResponse>(
      this.options.baseUrl,
      this.options.path,
      {
        method: "POST",
        headers: this.requestHeaders(),
        body: {
          model: this.options.model,
          messages: input.messages,
          temperature: input.temperature ?? 0.1,
        },
        timeoutMs: this.options.timeoutMs,
      },
    );

    const content = normalizeContent(response.choices?.[0]?.message?.content);
    if (!content) {
      this.options.logger?.warn("Model response did not contain text output.");
      throw new Error("Model response did not contain text output.");
    }

    if (this.options.logIo) {
      this.options.logger?.info("LLM response", {
        traceId: input.traceId,
        model: this.options.model,
        durationMs: Date.now() - startedAt,
        metadata: input.metadata,
        content: truncate(content),
      });
    }

    return content;
  }

  private requestHeaders(): HeadersInit {
    if (!this.options.apiKey) {
      return {
        Accept: "application/json",
      };
    }

    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.options.apiKey}`,
    };
  }
}
