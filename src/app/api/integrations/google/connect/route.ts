import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { buildConsentUrl, isGoogleConfigured } from "@/server/google/oauth";
import { signOAuthState, verifyConnectTicket } from "@/server/google/oauth-state";

/** Deep links the mobile app may ask to return to. Anything else could be an open redirect. */
const MOBILE_RETURN = /^anton:\/\/[\w/?=&.-]*$/;

/**
 * Starts Google OAuth. The web app is identified by its session cookie; the
 * mobile app opens the URL from `integration.googleConnectUrl` (a short-lived `ticket`) in an auth browser.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ticket = params.get("ticket");
  const returnTo = params.get("returnTo") ?? "/settings/connectors";
  const mobile = Boolean(ticket) && MOBILE_RETURN.test(returnTo);

  const userId = mobile ? await verifyConnectTicket(ticket!) : (await auth())?.user?.id;
  if (!userId) {
    return mobile
      ? NextResponse.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}google=expired`)
      : NextResponse.redirect(new URL("/sign-in", env.APP_URL));
  }

  const safeReturn = mobile
    ? returnTo
    : returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/settings/connectors";

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      mobile ? `${safeReturn}?google=not_configured` : new URL(`${safeReturn}?google=not_configured`, env.APP_URL),
    );
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { activeOrgId: true } });
  if (!user?.activeOrgId) return NextResponse.redirect(new URL("/onboarding", env.APP_URL));

  const state = await signOAuthState({ userId, orgId: user.activeOrgId, returnTo: safeReturn, mobile });
  return NextResponse.redirect(buildConsentUrl(state));
}
