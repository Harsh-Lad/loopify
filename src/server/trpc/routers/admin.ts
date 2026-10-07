import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, dateToDayKey } from "@/lib/dates";
import { createTRPCRouter, isPlatformAdmin, platformAdminProcedure } from "@/server/trpc/init";

const page = z.object({
  query: z.string().trim().max(100).default(""),
  cursor: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(25),
});

const DAY = 24 * 60 * 60 * 1000;

/** Daily counts of rows created in the last `days` days (UTC days). */
function growth(rows: { createdAt: Date }[], days: number) {
  const today = dateToDayKey(new Date());
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(addDays(today, -i), 0);
  for (const r of rows) {
    const key = dateToDayKey(r.createdAt);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
  }
  return [...buckets.entries()].map(([dayKey, count]) => ({ dayKey, count }));
}

/**
 * The platform console. Cross-tenant on purpose, so every procedure here is
 * gated by platformAdminProcedure and nothing here is exposed over /api/v1.
 */
export const adminRouter = createTRPCRouter({
  overview: platformAdminProcedure.query(async ({ ctx }) => {
    const since30 = new Date(Date.now() - 30 * DAY);
    const since7 = new Date(Date.now() - 7 * DAY);
    const [
      users,
      orgs,
      cards,
      events30,
      activeUsers7,
      suspendedUsers,
      suspendedOrgs,
      newUsers,
      newOrgs,
      activity,
      topOrgs,
    ] = await Promise.all([
      ctx.db.user.count(),
      ctx.db.organization.count(),
      ctx.db.card.count({ where: { archivedAt: null } }),
      ctx.db.cardEvent.count({ where: { createdAt: { gte: since30 } } }),
      ctx.db.user.count({ where: { lastSeenAt: { gte: since7 } } }),
      ctx.db.user.count({ where: { suspendedAt: { not: null } } }),
      ctx.db.organization.count({ where: { suspendedAt: { not: null } } }),
      ctx.db.user.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
      ctx.db.organization.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
      ctx.db.cardEvent.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
      ctx.db.cardEvent.groupBy({
        by: ["orgId"],
        where: { createdAt: { gte: since30 } },
        _count: { _all: true },
        orderBy: { _count: { orgId: "desc" } },
        take: 5,
      }),
    ]);

    const orgNames = await ctx.db.organization.findMany({
      where: { id: { in: topOrgs.map((o) => o.orgId) } },
      select: { id: true, name: true },
    });

    const signups = growth(newUsers, 30);
    const orgGrowth = growth(newOrgs, 30);
    const events = growth(activity, 30);

    return {
      totals: { users, orgs, cards, events30, activeUsers7, suspendedUsers, suspendedOrgs },
      series: signups.map((s, i) => ({
        dayKey: s.dayKey,
        signups: s.count,
        orgs: orgGrowth[i]!.count,
        events: events[i]!.count,
      })),
      topOrgs: topOrgs.map((o) => ({
        id: o.orgId,
        name: orgNames.find((n) => n.id === o.orgId)?.name ?? "Deleted org",
        events: o._count._all,
      })),
    };
  }),

  orgs: platformAdminProcedure.input(page).query(async ({ ctx, input }) => {
    const where: Prisma.OrganizationWhereInput = input.query
      ? {
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { slug: { contains: input.query, mode: "insensitive" } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      ctx.db.organization.count({ where }),
      ctx.db.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: input.cursor,
        take: input.limit,
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          suspendedAt: true,
          _count: { select: { members: true, teams: true, boards: true, cards: true } },
          members: {
            where: { role: "OWNER" },
            take: 1,
            select: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
    ]);
    const lastActivity = await ctx.db.cardEvent.groupBy({
      by: ["orgId"],
      where: { orgId: { in: rows.map((r) => r.id) } },
      _max: { createdAt: true },
    });
    return {
      total,
      nextCursor: input.cursor + rows.length < total ? input.cursor + rows.length : null,
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        createdAt: r.createdAt,
        suspendedAt: r.suspendedAt,
        counts: r._count,
        owner: r.members[0]?.user ?? null,
        lastActiveAt: lastActivity.find((l) => l.orgId === r.id)?._max.createdAt ?? null,
      })),
    };
  }),

  org: platformAdminProcedure.input(z.object({ orgId: z.string() })).query(async ({ ctx, input }) => {
    const org = await ctx.db.organization.findUnique({
      where: { id: input.orgId },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, email: true, image: true, lastSeenAt: true, suspendedAt: true } },
          },
        },
        teams: { select: { id: true, name: true, _count: { select: { members: true, boards: true } } } },
        _count: { select: { cards: true, captures: true, events: true } },
      },
    });
    if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });
    const since = new Date(Date.now() - 30 * DAY);
    const activity = await ctx.db.cardEvent.findMany({
      where: { orgId: org.id, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    return { ...org, activity: growth(activity, 30) };
  }),

  users: platformAdminProcedure.input(page).query(async ({ ctx, input }) => {
    const where: Prisma.UserWhereInput = input.query
      ? {
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { email: { contains: input.query, mode: "insensitive" } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      ctx.db.user.count({ where }),
      ctx.db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: input.cursor,
        take: input.limit,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          isPlatformAdmin: true,
          suspendedAt: true,
          lastSeenAt: true,
          createdAt: true,
          memberships: { select: { role: true, org: { select: { id: true, name: true } } } },
        },
      }),
    ]);
    return {
      total,
      nextCursor: input.cursor + rows.length < total ? input.cursor + rows.length : null,
      rows: rows.map((r) => ({ ...r, bootstrapAdmin: isPlatformAdmin({ ...r, isPlatformAdmin: false }) })),
    };
  }),

  setUserSuspended: platformAdminProcedure
    .input(z.object({ userId: z.string(), suspended: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't suspend yourself." });
      }
      return ctx.db.user.update({
        where: { id: input.userId },
        data: { suspendedAt: input.suspended ? new Date() : null },
        select: { id: true, suspendedAt: true },
      });
    }),

  setPlatformAdmin: platformAdminProcedure
    .input(z.object({ userId: z.string(), admin: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && !input.admin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ask another admin to remove your access." });
      }
      return ctx.db.user.update({
        where: { id: input.userId },
        data: { isPlatformAdmin: input.admin },
        select: { id: true, isPlatformAdmin: true },
      });
    }),

  setOrgSuspended: platformAdminProcedure
    .input(z.object({ orgId: z.string(), suspended: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.organization.update({
        where: { id: input.orgId },
        data: { suspendedAt: input.suspended ? new Date() : null },
        select: { id: true, suspendedAt: true },
      }),
    ),
});
