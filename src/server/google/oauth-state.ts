import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/server/env";

/** Signed, short-lived OAuth `state` that binds the callback to the user and org who started it. */
const key = new TextEncoder().encode(`${env.AUTH_SECRET}:google-oauth`);

/** `mobile` flows return to an app deep link and have no browser session to check against. */
export async function signOAuthState(payload: { userId: string; orgId: string; returnTo: string; mobile?: boolean }) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(key);
}

export async function verifyOAuthState(state: string) {
  const { payload } = await jwtVerify(state, key);
  return payload as unknown as { userId: string; orgId: string; returnTo: string; mobile?: boolean };
}

const ticketKey = new TextEncoder().encode(`${env.AUTH_SECRET}:google-connect-ticket`);

/** A 2-minute ticket the mobile app puts in the connect URL instead of its long-lived bearer token. */
export async function signConnectTicket(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(ticketKey);
}

export async function verifyConnectTicket(ticket: string) {
  try {
    const { payload } = await jwtVerify(ticket, ticketKey);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
