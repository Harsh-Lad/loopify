import "server-only";
import { OAuth2Client } from "google-auth-library";
import { db } from "@/server/db";
import { decrypt, encrypt } from "@/server/crypto";
import { env, requireEnv } from "@/server/env";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
];

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Google isn't connected yet. Connect it in Settings → Connectors.");
    this.name = "GoogleNotConnectedError";
  }
}

export function isGoogleConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.TOKEN_ENCRYPTION_KEY);
}

function redirectUri() {
  return env.GOOGLE_REDIRECT_URI ?? `${env.APP_URL}/api/integrations/google/callback`;
}

export function createOAuthClient() {
  return new OAuth2Client({
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: redirectUri(),
  });
}

export function buildConsentUrl(state: string) {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  });
}

export async function saveTokensFromCode(code: string, orgId: string, userId: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error("Google did not return an access token.");

  let accountEmail: string | null = null;
  if (tokens.id_token) {
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: requireEnv("GOOGLE_CLIENT_ID") });
    accountEmail = ticket.getPayload()?.email ?? null;
  }

  const data = {
    accountEmail,
    accessTokenEnc: encrypt(tokens.access_token),
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes: tokens.scope?.split(" ") ?? GOOGLE_SCOPES,
    ...(tokens.refresh_token ? { refreshTokenEnc: encrypt(tokens.refresh_token) } : {}),
  };

  await db.integration.upsert({
    where: { orgId_userId_provider: { orgId, userId, provider: "GOOGLE" } },
    create: { orgId, userId, provider: "GOOGLE", ...data },
    update: data,
  });
}

/** An OAuth client for this user that refreshes itself and saves new tokens. */
export async function getGoogleClient(orgId: string, userId: string) {
  const integration = await db.integration.findUnique({
    where: { orgId_userId_provider: { orgId, userId, provider: "GOOGLE" } },
  });
  if (!integration) throw new GoogleNotConnectedError();

  const client = createOAuthClient();
  client.setCredentials({
    access_token: decrypt(integration.accessTokenEnc),
    refresh_token: integration.refreshTokenEnc ? decrypt(integration.refreshTokenEnc) : undefined,
    expiry_date: integration.expiresAt?.getTime(),
  });

  client.on("tokens", (tokens) => {
    void db.integration
      .update({
        where: { id: integration.id },
        data: {
          ...(tokens.access_token ? { accessTokenEnc: encrypt(tokens.access_token) } : {}),
          ...(tokens.refresh_token ? { refreshTokenEnc: encrypt(tokens.refresh_token) } : {}),
          ...(tokens.expiry_date ? { expiresAt: new Date(tokens.expiry_date) } : {}),
        },
      })
      .catch((error) => console.error("[google] failed to persist refreshed tokens", error));
  });

  return client;
}
