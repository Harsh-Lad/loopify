import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth";
import { env } from "@/server/env";
import { saveTokensFromCode } from "@/server/google/oauth";
import { verifyOAuthState } from "@/server/google/oauth-state";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/settings/connectors?google=${reason}`, env.APP_URL));

  if (params.get("error")) return fail("denied");
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("invalid");

  let payload: Awaited<ReturnType<typeof verifyOAuthState>>;
  try {
    payload = await verifyOAuthState(state);
  } catch {
    return fail("expired");
  }

  // The web flow must finish in the same browser session that started it. The mobile flow runs in
  // a separate auth browser, so the signed, 10-minute state is what binds it to the user.
  const back = (status: string) =>
    payload.mobile
      ? NextResponse.redirect(`${payload.returnTo}${payload.returnTo.includes("?") ? "&" : "?"}google=${status}`)
      : NextResponse.redirect(new URL(`${payload.returnTo}?google=${status}`, env.APP_URL));

  if (!payload.mobile) {
    const session = await auth();
    if (session?.user?.id !== payload.userId) return fail("mismatch");
  }

  try {
    await saveTokensFromCode(code, payload.orgId, payload.userId);
  } catch (error) {
    console.error("[google] token exchange failed", error);
    return payload.mobile ? back("failed") : fail("failed");
  }

  return back("connected");
}
