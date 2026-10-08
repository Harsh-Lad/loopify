import "server-only";
import { z } from "zod";

/**
 * Server environment. Core values are required at boot; connector and AI
 * values are optional so the app runs before every integration is configured.
 * Use `requireEnv` at the point a feature needs an optional value.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_HOST: z.string().default("smtp.gmail.com"),
  EMAIL_PORT: z.coerce.number().default(465),
  EMAIL_FROM_NAME: z.string().default("Loopify"),

  AI_PROVIDER: z.enum(["XAI", "OPENAI_COMPATIBLE"]).default("XAI"),
  AI_BASE_URL: z.url().default("https://api.x.ai/v1"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("grok-4"),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.url().optional(),

  TOKEN_ENCRYPTION_KEY: z.string().optional(),

  /** Comma-separated emails that are always platform admins (bootstraps the first admin). */
  PLATFORM_ADMIN_EMAILS: z.string().optional(),

  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  /** Shared secret the meeting-bot runner sends as `x-runner-secret`. */
  RUNNER_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;

type OptionalKey = {
  [K in keyof Env]-?: undefined extends Env[K] ? K : never;
}[keyof Env];

export function requireEnv<K extends OptionalKey>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`${String(key)} is not configured. Add it to your .env file.`);
  }
  return value as NonNullable<Env[K]>;
}
