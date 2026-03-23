export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionInput {
  messages: ChatMessage[];
  temperature?: number | undefined;
  traceId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface ChatModelClient {
  complete(input: ChatCompletionInput): Promise<string>;
}
