import "server-only";
import type { ChatMessage, ChatRequest, ChatResponse, LlmProvider, ToolCall } from "@/server/ai/types";

type Options = {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

type WireMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    }
  | { role: "tool"; content: string; tool_call_id: string };

function toWire(message: ChatMessage): WireMessage {
  switch (message.role) {
    case "assistant":
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: { name: call.name, arguments: call.arguments },
              })),
            }
          : {}),
      };
    case "tool":
      return { role: "tool", content: message.content, tool_call_id: message.toolCallId };
    default:
      return { role: message.role, content: message.content };
  }
}

/**
 * Adapter for any API that speaks the OpenAI chat-completions format.
 * xAI (Grok) follows this format, so it is the default provider.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: Options) {
    this.id = options.id;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = {
      model: this.model,
      messages: request.messages.map(toWire),
      temperature: request.temperature ?? 0.3,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      ...(request.jsonSchema
        ? { response_format: { type: "json_schema", json_schema: { ...request.jsonSchema, strict: true } } }
        : request.json
          ? { response_format: { type: "json_object" } }
          : {}),
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              type: "function",
              function: { name: tool.name, description: tool.description, parameters: tool.parameters },
            })),
            tool_choice: "auto",
          }
        : {}),
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`AI provider ${this.id} returned ${response.status}: ${detail.slice(0, 500)}`);
    }

    const data = (await response.json()) as {
      choices: {
        finish_reason: string | null;
        message: {
          content: string | null;
          tool_calls?: { id: string; function: { name: string; arguments: string } }[];
        };
      }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = data.choices[0];
    const toolCalls: ToolCall[] =
      choice?.message.tool_calls?.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      })) ?? [];

    return {
      content: choice?.message.content ?? null,
      toolCalls,
      finishReason: choice?.finish_reason ?? null,
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined,
    };
  }
}
