/**
 * Provider-agnostic chat interface. Every model provider is an adapter that
 * implements `LlmProvider`. Business code only talks to this interface, so
 * switching from Grok to another model is a config change.
 */

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };

export type ToolCall = {
  id: string;
  name: string;
  /** Raw JSON string as returned by the model. */
  arguments: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
};

export type ChatRequest = {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for a single JSON object as the reply. */
  json?: boolean;
  /** Constrain the reply to this JSON Schema (structured output). Takes precedence over `json`. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
};

export type ChatResponse = {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string | null;
  usage?: { inputTokens: number; outputTokens: number };
};

export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("No AI provider is configured. Set AI_API_KEY in your .env file.");
    this.name = "AiNotConfiguredError";
  }
}
