import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { OrgRole, PrismaClient } from "@/generated/prisma/client";
import { addDays, dateToDayKey, dayKeyToDate, localDayBounds, localDayKey, localHour } from "@/lib/dates";
import { assertOrgUser, visibleBoards } from "@/server/trpc/guards";
import { createTRPCRouter, hasRole, orgProcedure } from "@/server/trpc/init";

type Ctx = { db: PrismaClient; org: { id: string }; user: { id: string; timezone: string }; role: OrgRole };

/** Your own numbers, or anyone's in the org if you're a manager. */
async function resolveSubject(ctx: Ctx, userId?: string) {
  const id = userId ?? ctx.user.id;
  if (id !== ctx.user.id) {
    if (!hasRole(ctx.role, "MANAGER")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only managers can see other people's reports." });
    }
    await assertOrgUser(ctx, id);
  }
  return id;
}

const HEATMAP_DAYS = 53 * 7;

/** Weekday of a "YYYY-MM-DD" key, 0 = Sunday. */
const weekday = (key: string) => dayKeyToDate(key).getUTCDay();

function streaks(days: { dayKey: string; count: number }[]) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // The current streak may end yesterday: today isn't over yet.
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.count > 0) current++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return { current, longest };
}

export const insightsRouter = createTRPCRouter({
  /** Everything the dashboard needs in one round trip. */
  overview: orgProcedure.input(z.object({ userId: z.string().optional() })).query(async ({ ctx, input }) => {
    const userId = await resolveSubject(ctx, input.userId);
    const tz = ctx.user.timezone;
    const today = localDayKey(tz);
    // Start the heatmap on a Sunday so columns are whole weeks, like GitHub.
    let from = addDays(today, -(HEATMAP_DAYS - 1));
    from = addDays(from, -weekday(from));
    const { start: yearStart } = localDayBounds(tz, from);
    const { start: todayStart, end: todayEnd } = localDayBounds(tz, today);
    const { start: weekStart } = localDayBounds(tz, addDays(today, -6));
    const { start: prevWeekStart } = localDayBounds(tz, addDays(today, -13));
    const { start: monthStart } = localDayBounds(tz, addDays(today, -29));
    const { end: weekAhead } = localDayBounds(tz, addDays(today, 7));

    const [person, membership, events, open, completed30, planItems, closedDays, recent] = await Promise.all([
      ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, name: true, image: true, email: true },
      }),
      ctx.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: ctx.org.id, userId } },
        select: { role: true, title: true, createdAt: true },
      }),
      ctx.db.cardEvent.findMany({
        where: { orgId: ctx.org.id, board: visibleBoards(ctx), actorId: userId, createdAt: { gte: yearStart } },
        select: { type: true, createdAt: true },
      }),
      ctx.db.card.findMany({
        where: {
          orgId: ctx.org.id,
          board: visibleBoards(ctx),
          assigneeId: userId,
          completedAt: null,
          archivedAt: null,
        },
        select: {
          id: true,
          number: true,
          title: true,
          priority: true,
          dueDate: true,
          rolloverCount: true,
          board: { select: { id: true, name: true, key: true } },
          column: { select: { name: true, category: true } },
        },
      }),
      ctx.db.card.findMany({
        where: { orgId: ctx.org.id, board: visibleBoards(ctx), assigneeId: userId, completedAt: { gte: monthStart } },
        select: { createdAt: true, completedAt: true, board: { select: { id: true, name: true } } },
      }),
      ctx.db.dayPlanItem.findMany({
        where: { dayPlan: { orgId: ctx.org.id, userId, date: { gte: dayKeyToDate(addDays(today, -29)) } } },
        select: { status: true },
      }),
      ctx.db.dayPlan.count({
        where: { orgId: ctx.org.id, userId, closedAt: { not: null }, date: { gte: dayKeyToDate(addDays(today, -29)) } },
      }),
      ctx.db.cardEvent.findMany({
        where: { orgId: ctx.org.id, board: visibleBoards(ctx), actorId: userId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          type: true,
          createdAt: true,
          card: { select: { id: true, number: true, title: true, board: { select: { id: true, key: true } } } },
        },
      }),
    ]);

    // Heatmap: every event counts as a contribution, like commits.
    const days = new Map<string, { dayKey: string; count: number; completed: number }>();
    for (let key = from; key <= today; key = addDays(key, 1)) days.set(key, { dayKey: key, count: 0, completed: 0 });
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    const weekdays = Array.from({ length: 7 }, (_, day) => ({ day, count: 0 }));
    let thisWeek = 0;
    let lastWeek = 0;
    for (const e of events) {
      const bucket = days.get(localDayKey(tz, e.createdAt));
      if (bucket) {
        bucket.count++;
        if (e.type === "COMPLETED") bucket.completed++;
      }
      if (e.createdAt >= monthStart) {
        hours[localHour(tz, e.createdAt)]!.count++;
        if (bucket) weekdays[weekday(bucket.dayKey)]!.count++;
      }
      if (e.type === "COMPLETED") {
        if (e.createdAt >= weekStart) thisWeek++;
        else if (e.createdAt >= prevWeekStart) lastWeek++;
      }
    }
    const heatmap = [...days.values()];
    const last30 = heatmap.slice(-30);

    const now = new Date();
    const priorities = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"].map((p) => ({
      priority: p,
      count: open.filter((c) => c.priority === p).length,
    }));
    const status = (["TODO", "IN_PROGRESS"] as const).map((category) => ({
      category,
      count: open.filter((c) => c.column.category === category).length,
    }));

    const focus = new Map<string, { board: string; open: number; done: number }>();
    for (const c of open) {
      const entry = focus.get(c.board.id) ?? { board: c.board.name, open: 0, done: 0 };
      entry.open++;
      focus.set(c.board.id, entry);
    }
    for (const c of completed30) {
      const entry = focus.get(c.board.id) ?? { board: c.board.name, open: 0, done: 0 };
      entry.done++;
      focus.set(c.board.id, entry);
    }

    const cycleHours = completed30.map((c) => Math.max(0, c.completedAt!.getTime() - c.createdAt.getTime()) / 36e5);
    const planned = planItems.filter((i) => i.status !== "DROPPED").length;
    const plannedDone = planItems.filter((i) => i.status === "DONE").length;

    const upcoming = open
      .filter((c) => c.dueDate && c.dueDate < weekAhead)
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        key: `${c.board.key}-${c.number}`,
        title: c.title,
        priority: c.priority,
        dueDate: c.dueDate,
        overdue: c.dueDate! < todayStart,
        board: { id: c.board.id, name: c.board.name },
        column: c.column.name,
      }));

    return {
      person: {
        ...person,
        role: membership?.role ?? null,
        title: membership?.title ?? null,
        joinedAt: membership?.createdAt ?? null,
      },
      today,
      kpis: {
        completedThisWeek: thisWeek,
        completedLastWeek: lastWeek,
        open: open.length,
        inProgress: status[1]!.count,
        overdue: open.filter((c) => c.dueDate && c.dueDate < todayStart).length,
        dueToday: open.filter((c) => c.dueDate && c.dueDate >= todayStart && c.dueDate < todayEnd).length,
        stuck: open.filter((c) => c.rolloverCount >= 3).length,
        planHitRate: planned ? plannedDone / planned : null,
        daysClosed: closedDays,
        avgCycleHours: cycleHours.length ? cycleHours.reduce((a, b) => a + b, 0) / cycleHours.length : null,
        contributions: heatmap.reduce((s, d) => s + d.count, 0),
        activeDays30: last30.filter((d) => d.count > 0).length,
        ...(() => {
          const s = streaks(heatmap);
          return { streak: s.current, longestStreak: s.longest };
        })(),
      },
      heatmap,
      trend: last30,
      hours,
      weekdays,
      priorities,
      status,
      focus: [...focus.values()].sort((a, b) => b.open + b.done - (a.open + a.done)).slice(0, 6),
      upcoming,
      recent: recent.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt,
        card: {
          id: e.card.id,
          key: `${e.card.board.key}-${e.card.number}`,
          title: e.card.title,
          boardId: e.card.board.id,
        },
      })),
      generatedAt: now,
    };
  }),

  /** One month of due dates, finished cards and day plans, keyed by local day. */
  calendar: orgProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = await resolveSubject(ctx, input.userId);
      const tz = ctx.user.timezone;
      const first = `${input.month}-01`;
      const next = new Date(`${first}T00:00:00Z`);
      next.setUTCMonth(next.getUTCMonth() + 1);
      const last = addDays(dateToDayKey(next), -1);
      // Pad to whole weeks so the grid's leading and trailing days have data too.
      const gridFrom = addDays(first, -weekday(first));
      const gridTo = addDays(last, 6 - weekday(last));
      const { start } = localDayBounds(tz, gridFrom);
      const { end } = localDayBounds(tz, gridTo);

      const cardSelect = {
        id: true,
        number: true,
        title: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        board: { select: { id: true, key: true, name: true } },
      } as const;

      const [due, done, plans] = await Promise.all([
        ctx.db.card.findMany({
          where: {
            orgId: ctx.org.id,
            board: visibleBoards(ctx),
            assigneeId: userId,
            archivedAt: null,
            dueDate: { gte: start, lt: end },
          },
          select: cardSelect,
        }),
        ctx.db.card.findMany({
          where: {
            orgId: ctx.org.id,
            board: visibleBoards(ctx),
            assigneeId: userId,
            completedAt: { gte: start, lt: end },
          },
          select: cardSelect,
        }),
        ctx.db.dayPlan.findMany({
          where: { orgId: ctx.org.id, userId, date: { gte: dayKeyToDate(gridFrom), lte: dayKeyToDate(gridTo) } },
          select: { date: true, mood: true, closedAt: true, items: { select: { status: true } } },
        }),
      ]);

      type Item = {
        id: string;
        key: string;
        title: string;
        priority: string;
        boardId: string;
        board: string;
        kind: "due" | "done";
        overdue: boolean;
      };
      const byDay = new Map<
        string,
        { dayKey: string; items: Item[]; planned: number; planDone: number; mood: string | null; closed: boolean }
      >();
      for (let key = gridFrom; key <= gridTo; key = addDays(key, 1)) {
        byDay.set(key, { dayKey: key, items: [], planned: 0, planDone: 0, mood: null, closed: false });
      }
      const now = new Date();
      const toItem = (c: (typeof due)[number], kind: Item["kind"]): Item => ({
        id: c.id,
        key: `${c.board.key}-${c.number}`,
        title: c.title,
        priority: c.priority,
        boardId: c.board.id,
        board: c.board.name,
        kind,
        overdue: kind === "due" && !c.completedAt && c.dueDate! < now,
      });
      const doneIds = new Set(done.map((c) => c.id));
      for (const c of due) {
        if (doneIds.has(c.id)) continue; // shown once, on the day it was finished
        byDay.get(localDayKey(tz, c.dueDate!))?.items.push(toItem(c, "due"));
      }
      for (const c of done) byDay.get(localDayKey(tz, c.completedAt!))?.items.push(toItem(c, "done"));
      for (const p of plans) {
        const day = byDay.get(dateToDayKey(p.date));
        if (!day) continue;
        day.planned = p.items.filter((i) => i.status !== "DROPPED").length;
        day.planDone = p.items.filter((i) => i.status === "DONE").length;
        day.mood = p.mood;
        day.closed = Boolean(p.closedAt);
      }

      return {
        month: input.month,
        today: localDayKey(tz),
        days: [...byDay.values()],
        totals: { due: due.length, done: done.length },
      };
    }),
});
