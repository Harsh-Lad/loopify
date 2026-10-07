import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { OpenApiMeta } from "trpc-to-openapi";
import { ZodError } from "zod";
import type { OrgRole } from "@/generated/prisma/client";
import { auth } from "@/server/auth";
import { verifyMobileToken } from "@/server/auth/mobile-token";
import { db } from "@/server/db";
import { env } from "@/server/env";

/**
 * Request context. The web app authenticates with the NextAuth session cookie,
 * the mobile app with `Authorization: Bearer <token>` from POST /api/v1/auth/token.
 */
export async function createContext({ req }: { req: Request }) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  let userId: string | null = null;

  if (bearer) {
    userId = await verifyMobileToken(bearer);
  } else {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }

  return { db, userId, req };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in." });
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      timezone: true,
      activeOrgId: true,
      isPlatformAdmin: true,
      suspendedAt: true,
      lastSeenAt: true,
    },
  });
  if (!user || user.suspendedAt) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in." });
  // Presence for the admin console, written at most every 5 minutes.
  if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 5 * 60_000) {
    void ctx.db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  const { id, name, email, image, timezone, activeOrgId } = user;
  return next({
    ctx: { ...ctx, user: { id, name, email, image, timezone, activeOrgId, isPlatformAdmin: isPlatformAdmin(user) } },
  });
});

const bootstrapAdmins = new Set(
  (env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isPlatformAdmin(user: { email: string; isPlatformAdmin: boolean }) {
  return user.isPlatformAdmin || bootstrapAdmins.has(user.email.toLowerCase());
}

/** Platform staff only: cross-tenant reads and writes for /admin. */
export const platformAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.isPlatformAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admins only." });
  }
  return next();
});

/**
 * Scopes a procedure to the user's active org. Every query inside must filter
 * by `ctx.org.id`, which is what keeps tenants apart.
 */
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const orgId = ctx.user.activeOrgId;
  const membership = orgId
    ? await ctx.db.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId: ctx.user.id } },
        include: { org: { select: { id: true, name: true, slug: true, suspendedAt: true } } },
      })
    : null;

  if (!membership) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NO_ACTIVE_ORG" });
  }
  if (membership.org.suspendedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "ORG_SUSPENDED" });
  }

  const { id, name, slug } = membership.org;
  return next({ ctx: { ...ctx, org: { id, name, slug }, role: membership.role } });
});

const rank: Record<OrgRole, number> = { MEMBER: 0, MANAGER: 1, ADMIN: 2, OWNER: 3 };

export function hasRole(role: OrgRole, atLeast: OrgRole) {
  return rank[role] >= rank[atLeast];
}

function requireRole(atLeast: OrgRole) {
  return orgProcedure.use(({ ctx, next }) => {
    if (!hasRole(ctx.role, atLeast)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to do that." });
    }
    return next();
  });
}

export const managerProcedure = requireRole("MANAGER");
export const adminProcedure = requireRole("ADMIN");
