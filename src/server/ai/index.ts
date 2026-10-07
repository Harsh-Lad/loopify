import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { decrypt } from "@/server/crypto";
import { OpenAiCompatibleProvider } from "@/server/ai/providers/openai-compatible";
import { AiNotConfiguredError, type LlmProvider } from "@/server/ai/types";

export * from "@/server/ai/types";

const DEFAULT_BASE_URLS = {
  XAI: "https://api.x.ai/v1",
  OPENAI_COMPATIBLE: env.AI_BASE_URL,
} as const;

/**
 * Resolves the model for an org: the org's own config if it has one,
 * otherwise the server default from env.
 */
export async function getAi(orgId?: string): Promise<LlmProvider> {
  if (orgId) {
    const config = await db.aiProviderConfig.findUnique({ where: { orgId } });
    if (config) {
      const apiKey = config.apiKeyEnc ? decrypt(config.apiKeyEnc) : env.AI_API_KEY;
      if (!apiKey) throw new AiNotConfiguredError();
      return new OpenAiCompatibleProvider({
        id: config.provider.toLowerCase(),
        baseUrl: config.baseUrl ?? DEFAULT_BASE_URLS[config.provider],
        apiKey,
        model: config.model,
      });
    }
  }

  if (!env.AI_API_KEY) throw new AiNotConfiguredError();

  return new OpenAiCompatibleProvider({
    id: env.AI_PROVIDER.toLowerCase(),
    baseUrl: env.AI_PROVIDER === "XAI" ? DEFAULT_BASE_URLS.XAI : env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
  });
}

export function isAiConfigured() {
  return Boolean(env.AI_API_KEY);
}

/** Parses a JSON reply, tolerating code fences some models wrap around it. */
export function parseJsonReply<T>(content: string | null): T {
  if (!content) throw new Error("The model returned an empty reply.");
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");
  return JSON.parse(cleaned) as T;
}
