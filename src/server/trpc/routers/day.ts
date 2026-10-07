import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, dateToDayKey, dayKeyToDate, greeting, localDayKey } from "@/lib/dates";
import { dispatchDayClosed } from "@/server/inngest/dispatch";
import { between } from "@/server/services/boards";
import { dayActivity, getOrCreateDayPlan, pendingFromYesterday } from "@/server/services/day";
import { recordEvent, recordEvents } from "@/server/services/events";
import { getCardOrThrow } from "@/server/trpc/guards";
import { createTRPCRouter, orgProcedure } from "@/server/trpc/init";

const cardSummary = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  priority: z.string(),
  dueDate: z.string().nullable(),
  completed: z.boolean(),
  rolloverCount: z.number(),
  boardId: z.string(),
  boardName: z.string(),
  columnName: z.string(),
  columnColor: z.string(),
});

const itemSchema = z.object({
  id: z.string(),
  status: z.enum(["PLANNED", "DONE", "ROLLED", "DROPPED"]),
  position: z.number(),
  rolled: z.boolean(),
  card: cardSummary,
});

const todayOutput = z.object({
  dayKey: z.string(),
  greeting: z.string(),
  plan: z.object({
    id: z.string(),
    note: z.unknown().nullable(),
    mood: z.string().nullable(),
    closedAt: z.string().nullable(),
    summary: z.string().nullable(),
  }),
  items: z.array(itemSchema),
  yesterday: z
    .object({
      dayKey: z.string(),
      planId: z.string(),
      summary: z.string().nullable(),
      left: z.array(itemSchema),
      done: z.array(z.object({ id: z.string(), key: z.string(), title: z.string() })),
    })
    .nullable(),
});

type CardWithRefs = Prisma.CardGetPayload<{
  include: { board: { select: { id: true; key: true; name: true } }; column: true };
}>;

function toCardSummary(card: CardWithRefs): z.infer<typeof cardSummary> {
  return {
    id: card.id,
    key: `${card.board.key}-${card.number}`,
    title: card.title,
    priority: card.priority,
    dueDate: card.dueDate?.toISOString() ?? null,
    completed: Boolean(card.completedAt),
    rolloverCount: card.rolloverCount,
    boardId: card.board.id,
    boardName: card.board.name,
    columnName: card.column.name,
    columnColor: card.column.color,
  };
}

const cardInclude = { board: { select: { id: true, key: true, name: true } }, column: true } as const;

export const dayRouter = createTRPCRouter({
  today: orgProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/day/today",
        tags: ["day"],
        protect: true,
        summary: "Today's plan and yesterday's recap",
      },
    })
    .input(z.void())
    .output(todayOutput)
    .query(async ({ ctx }) => {
      const tz = ctx.user.timezone;
      const dayKey = localDayKey(tz);
      const plan = await getOrCreateDayPlan(ctx.org.id, ctx.user.id, dayKey);

      const [items, yesterday] = await Promise.all([
        ctx.db.dayPlanItem.findMany({
          where: { dayPlanId: plan.id, status: { in: ["PLANNED", "DONE"] }, card: { archivedAt: null } },
          orderBy: { position: "asc" },
          include: { card: { include: cardInclude } },
        }),
        pendingFromYesterday(ctx.org.id, ctx.user.id, tz),
      ]);

      let yesterdayOut: z.infer<typeof todayOutput>["yesterday"] = null;
      if (yesterday) {
        const yKey = dateToDayKey(yesterday.date);
        const activity = await dayActivity(ctx.org.id, ctx.user.id, tz, yKey);
        yesterdayOut = {
          dayKey: yKey,
          planId: yesterday.id,
          summary: yesterday.summary,
          left: yesterday.items.map((i) => ({
            id: i.id,
            status: i.status,
            position: i.position,
            rolled: Boolean(i.rolledFromId),
            card: toCardSummary(i.card),
          })),
          done: activity.completed.map((c) => ({ id: c.id, key: `${c.board.key}-${c.number}`, title: c.title })),
        };
      }

      return {
        dayKey,
        greeting: greeting(tz),
        plan: {
          id: plan.id,
          note: plan.note,
          mood: plan.mood,
          closedAt: plan.closedAt?.toISOString() ?? null,
          summary: plan.summary,
        },
        items: items.map((i) => ({
          id: i.id,
          status: i.status,
          position: i.position,
          rolled: Boolean(i.rolledFromId),
          card: toCardSummary(i.card),
        })),
        yesterday: yesterdayOut,
      };
    }),

  plan: orgProcedure
    .meta({
      openapi: { method: "POST", path: "/day/plan", tags: ["day"], protect: true, summary: "Add a card to today" },
    })
    .input(z.object({ cardId: z.string() }))
    .output(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const card = await getCardOrThrow(ctx, input.cardId);
      const plan = await getOrCreateDayPlan(ctx.org.id, ctx.user.id, localDayKey(ctx.user.timezone));
      return ctx.db.$transaction(async (tx) => {
        const last = await tx.dayPlanItem.findFirst({ where: { dayPlanId: plan.id }, orderBy: { position: "desc" } });
        const item = await tx.dayPlanItem.upsert({
          where: { dayPlanId_cardId: { dayPlanId: plan.id, cardId: card.id } },
          create: {
            dayPlanId: plan.id,
            cardId: card.id,
            position: between(last?.position, null),
            status: card.completedAt ? "DONE" : "PLANNED",
          },
          update: { status: card.completedAt ? "DONE" : "PLANNED" },
        });
        await recordEvent(tx, {
          orgId: card.orgId,
          boardId: card.boardId,
          cardId: card.id,
          actorId: ctx.user.id,
          type: "PLANNED",
        });
        return { itemId: item.id };
      });
    }),

  unplan: orgProcedure.input(z.object({ itemId: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await ctx.db.dayPlanItem.findFirst({
      where: { id: input.itemId, dayPlan: { userId: ctx.user.id, orgId: ctx.org.id } },
      include: { card: true },
    });
    if (!item) throw new TRPCError({ code: "NOT_FOUND" });
    await ctx.db.$transaction(async (tx) => {
      await tx.dayPlanItem.delete({ where: { id: item.id } });
      await recordEvent(tx, {
        orgId: item.card.orgId,
        boardId: item.card.boardId,
        cardId: item.card.id,
        actorId: ctx.user.id,
        type: "UNPLANNED",
      });
    });
    return { removed: true };
  }),

  reorder: orgProcedure
    .input(z.object({ itemId: z.string(), beforeId: z.string().nullish(), afterId: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.dayPlanItem.findFirst({
        where: { id: input.itemId, dayPlan: { userId: ctx.user.id, orgId: ctx.org.id } },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      const [before, after] = await Promise.all([
        input.beforeId
          ? ctx.db.dayPlanItem.findFirst({ where: { id: input.beforeId, dayPlanId: item.dayPlanId } })
          : null,
        input.afterId
          ? ctx.db.dayPlanItem.findFirst({ where: { id: input.afterId, dayPlanId: item.dayPlanId } })
          : null,
      ]);
      return ctx.db.dayPlanItem.update({
        where: { id: item.id },
        data: { position: between(before?.position, after?.position) },
      });
    }),

  /** Carries yesterday's unfinished items into today. Omit itemIds to roll everything. */
  rollover: orgProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/day/rollover",
        tags: ["day"],
        protect: true,
        summary: "Roll yesterday's leftovers into today",
      },
    })
    .input(z.object({ itemIds: z.array(z.string()).optional() }))
    .output(z.object({ rolled: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tz = ctx.user.timezone;
      const yesterday = await pendingFromYesterday(ctx.org.id, ctx.user.id, tz);
      if (!yesterday) return { rolled: 0 };
      const pick = input.itemIds ? new Set(input.itemIds) : null;
      const items = yesterday.items.filter((i) => !pick || pick.has(i.id));
      if (!items.length) return { rolled: 0 };

      const today = await getOrCreateDayPlan(ctx.org.id, ctx.user.id, localDayKey(tz));

      await ctx.db.$transaction(async (tx) => {
        const existing = new Set(
          (await tx.dayPlanItem.findMany({ where: { dayPlanId: today.id }, select: { cardId: true } })).map(
            (i) => i.cardId,
          ),
        );
        const first = await tx.dayPlanItem.findFirst({ where: { dayPlanId: today.id }, orderBy: { position: "asc" } });
        let position = (first?.position ?? 1000) - items.length * 10;

        for (const item of items) {
          if (!existing.has(item.cardId)) {
            await tx.dayPlanItem.create({
              data: { dayPlanId: today.id, cardId: item.cardId, position: (position += 10), rolledFromId: item.id },
            });
          }
        }
        await tx.dayPlanItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { status: "ROLLED" } });
        await tx.card.updateMany({
          where: { id: { in: items.map((i) => i.cardId) } },
          data: { rolloverCount: { increment: 1 } },
        });
        await recordEvents(
          tx,
          items.map((i) => ({
            orgId: i.card.orgId,
            boardId: i.card.boardId,
            cardId: i.cardId,
            actorId: ctx.user.id,
            type: "ROLLED_OVER" as const,
            payload: { from: dateToDayKey(yesterday.date), to: localDayKey(tz) },
          })),
        );
      });

      return { rolled: items.length };
    }),

  /** Lets a leftover go without carrying it forward. The card itself stays on its board. */
  dropLeftover: orgProcedure.input(z.object({ itemId: z.string() })).mutation(async ({ ctx, input }) => {
    const updated = await ctx.db.dayPlanItem.updateMany({
      where: { id: input.itemId, status: "PLANNED", dayPlan: { userId: ctx.user.id, orgId: ctx.org.id } },
      data: { status: "DROPPED" },
    });
    if (!updated.count) throw new TRPCError({ code: "NOT_FOUND" });
    return { dropped: true };
  }),

  saveNote: orgProcedure
    .input(z.object({ planId: z.string(), note: z.json(), noteText: z.string().max(50_000) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.dayPlan.updateMany({
        where: { id: input.planId, userId: ctx.user.id, orgId: ctx.org.id },
        data: { note: input.note as Prisma.InputJsonValue, noteText: input.noteText },
      });
      if (!updated.count) throw new TRPCError({ code: "NOT_FOUND" });
      return { savedAt: new Date() };
    }),

  setMood: orgProcedure
    .input(z.object({ planId: z.string(), mood: z.string().max(16).nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.dayPlan.updateMany({
        where: { id: input.planId, userId: ctx.user.id, orgId: ctx.org.id },
        data: { mood: input.mood },
      });
      return { mood: input.mood };
    }),

  /** End-of-day shutdown. Writes the summary in the background. */
  close: orgProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/day/close",
        tags: ["day"],
        protect: true,
        summary: "Close the day and write the summary",
      },
    })
    .input(z.object({ planId: z.string() }))
    .output(z.object({ closedAt: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.dayPlan.findFirst({
        where: { id: input.planId, userId: ctx.user.id, orgId: ctx.org.id },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      const closedAt = new Date();
      await ctx.db.dayPlan.update({ where: { id: plan.id }, data: { closedAt } });
      await dispatchDayClosed(plan.id);
      return { closedAt: closedAt.toISOString() };
    }),

  reopen: orgProcedure.input(z.object({ planId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.dayPlan.updateMany({
      where: { id: input.planId, userId: ctx.user.id, orgId: ctx.org.id },
      data: { closedAt: null },
    });
    return { reopened: true };
  }),

  /** Past days for the diary timeline. */
  history: orgProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(14) }))
    .query(async ({ ctx, input }) => {
      const today = localDayKey(ctx.user.timezone);
      const plans = await ctx.db.dayPlan.findMany({
        where: {
          orgId: ctx.org.id,
          userId: ctx.user.id,
          date: { gte: dayKeyToDate(addDays(today, -input.days)), lt: dayKeyToDate(today) },
        },
        orderBy: { date: "desc" },
        include: { items: { select: { status: true } } },
      });
      return plans.map((p) => ({
        id: p.id,
        dayKey: dateToDayKey(p.date),
        mood: p.mood,
        summary: p.summary,
        noteText: p.noteText?.slice(0, 280) ?? null,
        done: p.items.filter((i) => i.status === "DONE").length,
        rolled: p.items.filter((i) => i.status === "ROLLED").length,
        planned: p.items.length,
      }));
    }),
});
