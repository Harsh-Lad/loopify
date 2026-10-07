import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addDays, localDayBounds, localDayKey } from "@/lib/dates";
import { assertCanManageTeam, visibleBoards } from "@/server/trpc/guards";
import { createTRPCRouter, hasRole, orgProcedure } from "@/server/trpc/init";

const range = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)]).default(14) });

type Row = { type: string; createdAt: Date; actorId: string; cardId: string };

function series(events: Row[], tz: string, from: string, days: number) {
  const buckets = new Map<
    string,
    { dayKey: string; completed: number; created: number; moved: number; rolled: number }
  >();
  for (let i = 0; i < days; i++) {
    const key = addDays(from, i);
    buckets.set(key, { dayKey: key, completed: 0, created: 0, moved: 0, rolled: 0 });
  }
  for (const e of events) {
    const bucket = buckets.get(localDayKey(tz, e.createdAt));
    if (!bucket) continue;
    if (e.type === "COMPLETED") bucket.completed++;
    else if (e.type === "CREATED") bucket.created++;
    else if (e.type === "MOVED") bucket.moved++;
    else if (e.type === "ROLLED_OVER") bucket.rolled++;
  }
  return [...buckets.values()];
}

function streak(points: { completed: number }[]) {
  let count = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]!.completed > 0) count++;
    else if (i === points.length - 1)
      continue; // today isn't over yet
    else break;
  }
  return count;
}

export const reportRouter = createTRPCRouter({
  /** A person's own progress. Managers can pass someone else's userId. */
  personal: orgProcedure.input(range.extend({ userId: z.string().optional() })).query(async ({ ctx, input }) => {
    const userId = input.userId ?? ctx.user.id;
    if (userId !== ctx.user.id && !hasRole(ctx.role, "MANAGER")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only managers can see other people's reports." });
    }
    const tz = ctx.user.timezone;
    const today = localDayKey(tz);
    const from = addDays(today, -(input.days - 1));
    const { start } = localDayBounds(tz, from);

    const [person, events, open, completedCards] = await Promise.all([
      ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, image: true } }),
      ctx.db.cardEvent.findMany({
        where: { orgId: ctx.org.id, board: visibleBoards(ctx), actorId: userId, createdAt: { gte: start } },
        select: { type: true, createdAt: true, actorId: true, cardId: true },
      }),
      ctx.db.card.findMany({
        where: {
          orgId: ctx.org.id,
          board: visibleBoards(ctx),
          assigneeId: userId,
          completedAt: null,
          archivedAt: null,
        },
        select: { id: true, dueDate: true, rolloverCount: true },
      }),
      ctx.db.card.findMany({
        where: { orgId: ctx.org.id, board: visibleBoards(ctx), assigneeId: userId, completedAt: { gte: start } },
        select: { createdAt: true, completedAt: true, board: { select: { id: true, name: true } } },
      }),
    ]);

    const points = series(events, tz, from, input.days);
    const cycleHours = completedCards.map((c) => (c.completedAt!.getTime() - c.createdAt.getTime()) / 36e5);
    const byBoard = new Map<string, { name: string; count: number }>();
    for (const c of completedCards) {
      const entry = byBoard.get(c.board.id) ?? { name: c.board.name, count: 0 };
      entry.count++;
      byBoard.set(c.board.id, entry);
    }

    return {
      person,
      series: points,
      totals: {
        completed: points.reduce((s, p) => s + p.completed, 0),
        created: points.reduce((s, p) => s + p.created, 0),
        rolled: points.reduce((s, p) => s + p.rolled, 0),
        open: open.length,
        overdue: open.filter((c) => c.dueDate && c.dueDate < new Date()).length,
        stale: open.filter((c) => c.rolloverCount >= 3).length,
        avgCycleHours: cycleHours.length ? cycleHours.reduce((a, b) => a + b, 0) / cycleHours.length : null,
        streak: streak(points),
      },
      boards: [...byBoard.values()].sort((a, b) => b.count - a.count),
    };
  }),

  /** One row per person. Managers see any team, team leads see their own. */
  team: orgProcedure.input(range.extend({ teamId: z.string().optional() })).query(async ({ ctx, input }) => {
    if (input.teamId) await assertCanManageTeam(ctx, input.teamId);
    else if (!hasRole(ctx.role, "MANAGER")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only managers can see the whole org." });
    }

    const tz = ctx.user.timezone;
    const today = localDayKey(tz);
    const from = addDays(today, -(input.days - 1));
    const { start } = localDayBounds(tz, from);

    const people = input.teamId
      ? (
          await ctx.db.teamMember.findMany({
            where: { teamId: input.teamId },
            include: { user: { select: { id: true, name: true, image: true } } },
          })
        ).map((m) => m.user)
      : (
          await ctx.db.orgMember.findMany({
            where: { orgId: ctx.org.id },
            include: { user: { select: { id: true, name: true, image: true } } },
          })
        ).map((m) => m.user);
    const ids = people.map((p) => p.id);

    const [events, open, lastSeen, closedDays] = await Promise.all([
      ctx.db.cardEvent.findMany({
        where: { orgId: ctx.org.id, board: visibleBoards(ctx), actorId: { in: ids }, createdAt: { gte: start } },
        select: { type: true, createdAt: true, actorId: true, cardId: true },
      }),
      ctx.db.card.findMany({
        where: {
          orgId: ctx.org.id,
          board: visibleBoards(ctx),
          assigneeId: { in: ids },
          completedAt: null,
          archivedAt: null,
        },
        select: { assigneeId: true, dueDate: true, rolloverCount: true },
      }),
      ctx.db.cardEvent.groupBy({
        by: ["actorId"],
        where: { orgId: ctx.org.id, board: visibleBoards(ctx), actorId: { in: ids } },
        _max: { createdAt: true },
      }),
      ctx.db.dayPlan.groupBy({
        by: ["userId"],
        where: { orgId: ctx.org.id, userId: { in: ids }, closedAt: { not: null }, createdAt: { gte: start } },
        _count: { _all: true },
      }),
    ]);

    const rows = people.map((person) => {
      const mine = events.filter((e) => e.actorId === person.id);
      const openMine = open.filter((c) => c.assigneeId === person.id);
      return {
        person,
        completed: mine.filter((e) => e.type === "COMPLETED").length,
        created: mine.filter((e) => e.type === "CREATED").length,
        rolled: mine.filter((e) => e.type === "ROLLED_OVER").length,
        open: openMine.length,
        overdue: openMine.filter((c) => c.dueDate && c.dueDate < new Date()).length,
        stale: openMine.filter((c) => c.rolloverCount >= 3).length,
        daysClosed: closedDays.find((d) => d.userId === person.id)?._count._all ?? 0,
        lastActiveAt: lastSeen.find((l) => l.actorId === person.id)?._max.createdAt ?? null,
        series: series(mine, tz, from, input.days).map((p) => p.completed),
      };
    });

    return {
      series: series(events, tz, from, input.days),
      rows: rows.sort((a, b) => b.completed - a.completed),
    };
  }),
});
