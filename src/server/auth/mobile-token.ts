import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/server/env";

/**
 * Bearer tokens for the mobile app (REST at /api/v1). The web app uses the
 * NextAuth session cookie instead. Both resolve to the same user id.
 */
const ISSUER = "loopify";
const AUDIENCE = "loopify-mobile";
const key = new TextEncoder().encode(`${env.AUTH_SECRET}:mobile`);

export async function issueMobileToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifyMobileToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
