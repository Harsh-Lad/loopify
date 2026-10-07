import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth check: redirects based on the presence of the session cookie.
 * Real verification happens in every API call (tRPC context), so this only
 * keeps signed-out visitors away from app pages and signed-in users away from
 * auth pages.
 */
const AUTH_PAGES = ["/sign-in", "/sign-up", "/verify-email", "/forgot-password", "/reset-password"];
/** Marketing and legal pages anyone can read, signed in or out. */
const PUBLIC_PAGES = ["/privacy", "/terms"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/** Large sessions are split into `.0`, `.1` chunks, so match by prefix. */
function hasSession(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((c) => SESSION_COOKIES.some((name) => c.name === name || c.name.startsWith(`${name}.`)));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = hasSession(request);
  const onAuthPage = AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  // The landing page is public; signed-in users go straight to their dashboard.
  if (pathname === "/") {
    return signedIn ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }

  if (PUBLIC_PAGES.includes(pathname)) return NextResponse.next();

  // Invite links work signed in or out; the page handles both.
  if (pathname.startsWith("/invite/")) return NextResponse.next();

  if (onAuthPage) {
    // A cookie only *looks* like a session. When the app sent someone here with ?next= (because the
    // API rejected that cookie), bouncing them back would ping-pong forever, so let the form render.
    const bounced = request.nextUrl.searchParams.has("next");
    return signedIn && pathname === "/sign-in" && !bounced
      ? NextResponse.redirect(new URL("/today", request.url))
      : NextResponse.next();
  }

  if (!signedIn) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
