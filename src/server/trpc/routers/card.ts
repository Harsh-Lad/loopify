import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { between } from "@/server/services/boards";
import { endOfColumn, moveCard, reopenTarget } from "@/server/services/cards";
import { recordEvent } from "@/server/services/events";
import {
  autoMirrorOnAssign,
  duplicateToPersonal,
  endOfMixedColumn,
  ensurePersonalBoard,
  mirrorCard,
} from "@/server/services/personal";
import { assertAssignable, assertOrgUser, getBoardOrThrow, getCardOrThrow, visibleBoards } from "@/server/trpc/guards";
import { createTRPCRouter, orgProcedure } from "@/server/trpc/init";

const priority = z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]);
const userSelect = { id: true, name: true, image: true } as const;

const cardOutput = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  priority: z.string(),
  dueDate: z.string().nullable(),
  completed: z.boolean(),
  board: z.object({ id: z.string(), name: z.string() }),
  column: z.object({ id: z.string(), name: z.string(), category: z.string() }),
});

export const cardRouter = createTRPCRouter({
  get: orgProcedure.input(z.object({ cardId: z.string() })).query(async ({ ctx, input }) => {
    const card = await ctx.db.card.findFirst({
      where: { id: input.cardId, orgId: ctx.org.id, board: visibleBoards(ctx) },
      include: {
        board: { include: { columns: { orderBy: { position: "asc" } }, fields: { orderBy: { position: "asc" } } } },
        column: true,
        assignee: { select: userSelect },
        reporter: { select: userSelect },
        subtasks: { where: { archivedAt: null }, orderBy: { position: "asc" }, include: { column: true } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: userSelect } } },
        events: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: userSelect } } },
        mirrors: { where: { userId: ctx.user.id }, select: { id: true, boardId: true } },
      },
    });
    if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
    const { mirrors, ...rest } = card;
    return {
      ...rest,
      /** Where this card stands relative to your personal board. */
      personal: {
        isPersonal: card.board.ownerId === ctx.user.id,
        mirrored: mirrors.length > 0,
        boardId: card.board.ownerId === ctx.user.id ? card.boardId : (mirrors[0]?.boardId ?? null),
      },
    };
  }),

  create: orgProcedure
    .input(
      z.object({
        boardId: z.string(),
        columnId: z.string().optional(),
        title: z.string().trim().min(1, "Give it a title").max(200),
        descriptionText: z.string().max(10_000).optional(),
        assigneeId: z.string().nullish(),
        priority: priority.default("NONE"),
        dueDate: z.coerce.date().nullish(),
        labels: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
        parentId: z.string().optional(),
        planToday: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await getBoardOrThrow(ctx, input.boardId);
      if (input.assigneeId) await assertOrgUser(ctx, input.assigneeId);
      assertAssignable(board, input.assigneeId);

      return ctx.db.$transaction(async (tx) => {
        const column = input.columnId
          ? await tx.boardColumn.findFirst({ where: { id: input.columnId, boardId: board.id } })
          : await tx.boardColumn.findFirst({ where: { boardId: board.id }, orderBy: { position: "asc" } });
        if (!column) throw new TRPCError({ code: "BAD_REQUEST", message: "Column not found." });

        const { cardSeq } = await tx.board.update({ where: { id: board.id }, data: { cardSeq: { increment: 1 } } });

        const card = await tx.card.create({
          data: {
            orgId: ctx.org.id,
            boardId: board.id,
            columnId: column.id,
            number: cardSeq,
            title: input.title,
            descriptionText: input.descriptionText,
            // Personal tasks are always yours.
            assigneeId: input.assigneeId ?? board.ownerId ?? null,
            reporterId: ctx.user.id,
            priority: input.priority,
            dueDate: input.dueDate ?? null,
            labels: input.labels,
            parentId: input.parentId,
            position: await endOfColumn(tx, column.id),
            completedAt: column.category === "DONE" ? new Date() : null,
          },
        });

        await recordEvent(tx, {
          orgId: ctx.org.id,
          boardId: board.id,
          cardId: card.id,
          actorId: ctx.user.id,
          type: "CREATED",
          toColumnId: column.id,
          payload: { title: card.title },
        });
        await autoMirrorOnAssign(tx, card);

        return { ...card, key: `${board.key}-${card.number}` };
      });
    }),

  update: orgProcedure
    .input(
      z.object({
        cardId: z.string(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.json().optional(),
        descriptionText: z.string().max(10_000).nullable().optional(),
        assigneeId: z.string().nullable().optional(),
        priority: priority.optional(),
        dueDate: z.coerce.date().nullable().optional(),
        labels: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
        customFields: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const card = await getCardOrThrow(ctx, input.cardId);
      if (input.assigneeId) await assertOrgUser(ctx, input.assigneeId);
      const board = await ctx.db.board.findUniqueOrThrow({ where: { id: card.boardId }, select: { ownerId: true } });
      assertAssignable(board, input.assigneeId);
      const { cardId, customFields, description, ...rest } = input;

      return ctx.db.$transaction(async (tx) => {
        const data: Prisma.CardUncheckedUpdateInput = { ...rest };
        if (description !== undefined) data.description = description as Prisma.InputJsonValue;
        if (customFields) {
          data.customFields = {
            ...(card.customFields as Record<string, unknown>),
            ...customFields,
          } as Prisma.InputJsonValue;
        }
        const updated = await tx.card.update({ where: { id: cardId }, data });

        const changed = Object.keys(input).filter((k) => k !== "cardId");
        const base = { orgId: card.orgId, boardId: card.boardId, cardId, actorId: ctx.user.id };
        if (input.assigneeId !== undefined && input.assigneeId !== card.assigneeId) {
          await recordEvent(tx, {
            ...base,
            type: "ASSIGNED",
            payload: { from: card.assigneeId, to: input.assigneeId },
          });
          await autoMirrorOnAssign(tx, updated);
        }
        const other = changed.filter((k) => k !== "assigneeId");
        if (other.length) await recordEvent(tx, { ...base, type: "UPDATED", payload: { fields: other } });
        return updated;
      });
    }),

  move: orgProcedure
    .meta({ openapi: { method: "POST", path: "/cards/{cardId}/move", tags: ["cards"], protect: true } })
    .input(
      z.object({
        cardId: z.string(),
        columnId: z.string(),
        beforeId: z.string().nullish(),
        afterId: z.string().nullish(),
      }),
    )
    .output(z.object({ id: z.string(), columnId: z.string(), position: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const card = await getCardOrThrow(ctx, input.cardId);
      return ctx.db.$transaction(async (tx) => {
        // Neighbours can be cards or (on a personal board) mirrors of team cards.
        const positionOf = async (id: string | null | undefined) => {
          if (!id) return null;
          const [c, m] = await Promise.all([
            tx.card.findFirst({ where: { id, columnId: input.columnId }, select: { position: true } }),
            tx.cardMirror.findFirst({
              where: { cardId: id, userId: ctx.user.id, columnId: input.columnId },
              select: { position: true },
            }),
          ]);
          return c ?? m;
        };
        const [before, after] = await Promise.all([positionOf(input.beforeId), positionOf(input.afterId)]);
        const position =
          before || after ? between(before?.position, after?.position) : await endOfMixedColumn(tx, input.columnId);

        // Dragging a mirrored team card around your personal board moves the mirror. Dropping it
        // in a Done column finishes the real card; dragging it out of Done reopens it.
        const mirror = await tx.cardMirror.findUnique({
          where: { userId_cardId: { userId: ctx.user.id, cardId: card.id } },
        });
        const target = await tx.boardColumn.findUnique({ where: { id: input.columnId } });
        if (mirror && target && target.boardId === mirror.boardId) {
          await tx.cardMirror.update({ where: { id: mirror.id }, data: { columnId: target.id, position } });
          const nowDone = target.category === "DONE";
          if (nowDone !== Boolean(card.completedAt)) {
            const real = nowDone
              ? await tx.boardColumn.findFirstOrThrow({
                  where: { boardId: card.boardId, category: "DONE" },
                  orderBy: { position: "asc" },
                })
              : await reopenTarget(tx, card);
            await moveCard(tx, ctx.user, card, real.id, await endOfColumn(tx, real.id));
            // moveCard re-files mirrors by status; keep this one exactly where it was dropped.
            await tx.cardMirror.update({ where: { id: mirror.id }, data: { columnId: target.id, position } });
          }
          return { id: card.id, columnId: target.id, position };
        }

        const moved = await moveCard(tx, ctx.user, card, input.columnId, position);
        return { id: moved.id, columnId: moved.columnId, position: moved.position };
      });
    }),

  /** One-tap done / undo from the Today view. */
  setDone: orgProcedure
    .meta({ openapi: { method: "POST", path: "/cards/{cardId}/done", tags: ["cards"], protect: true } })
    .input(z.object({ cardId: z.string(), done: z.boolean() }))
    .output(z.object({ id: z.string(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const card = await getCardOrThrow(ctx, input.cardId);
      if (Boolean(card.completedAt) === input.done) return { id: card.id, completed: input.done };
      return ctx.db.$transaction(async (tx) => {
        const target = input.done
          ? await tx.boardColumn.findFirstOrThrow({
              where: { boardId: card.boardId, category: "DONE" },
              orderBy: { position: "asc" },
            })
          : await reopenTarget(tx, card);
        await moveCard(tx, ctx.user, card, target.id, await endOfColumn(tx, target.id));
        return { id: card.id, completed: input.done };
      });
    }),

  archive: orgProcedure
    .input(z.object({ cardId: z.string(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const card = await getCardOrThrow(ctx, input.cardId);
      return ctx.db.$transaction(async (tx) => {
        await tx.card.update({ where: { id: card.id }, data: { archivedAt: input.archived ? new Date() : null } });
        if (input.archived) {
          await tx.dayPlanItem.updateMany({
            where: { cardId: card.id, status: "PLANNED" },
            data: { status: "DROPPED" },
          });
        }
        await recordEvent(tx, {
          orgId: card.orgId,
          boardId: card.boardId,
          cardId: card.id,
          actorId: ctx.user.id,
          type: input.archived ? "ARCHIVED" : "RESTORED",
        });
        return { archived: input.archived };
      });
    }),

  comment: orgProcedure
    .input(z.object({ cardId: z.string(), body: z.string().trim().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const card = await getCardOrThrow(ctx, input.cardId);
      return ctx.db.$transaction(async (tx) => {
        const comment = await tx.cardComment.create({
          data: { cardId: card.id, authorId: ctx.user.id, body: input.body },
          include: { author: { select: userSelect } },
        });
        await recordEvent(tx, {
          orgId: card.orgId,
          boardId: card.boardId,
          cardId: card.id,
          actorId: ctx.user.id,
          type: "COMMENTED",
          payload: { commentId: comment.id },
        });
        if (card.assigneeId && card.assigneeId !== ctx.user.id) {
          await tx.notification.create({
            data: {
              orgId: card.orgId,
              userId: card.assigneeId,
              type: "comment",
              title: `${ctx.user.name} commented on "${card.title}"`,
              body: input.body.slice(0, 140),
              link: `/boards/${card.boardId}?card=${card.id}`,
            },
          });
        }
        return comment;
      });
    }),

  /** Open cards assigned to me, for planning the day. */
  mine: orgProcedure
    .meta({ openapi: { method: "GET", path: "/cards/mine", tags: ["cards"], protect: true } })
    .input(z.object({ includeDone: z.boolean().default(false) }))
    .output(z.array(cardOutput))
    .query(async ({ ctx, input }) => {
      const cards = await ctx.db.card.findMany({
        where: {
          orgId: ctx.org.id,
          assigneeId: ctx.user.id,
          archivedAt: null,
          ...(input.includeDone ? {} : { completedAt: null }),
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
        take: 200,
        include: {
          board: { select: { id: true, name: true, key: true } },
          column: { select: { id: true, name: true, category: true } },
        },
      });
      return cards.map((c) => ({
        id: c.id,
        key: `${c.board.key}-${c.number}`,
        title: c.title,
        priority: c.priority,
        dueDate: c.dueDate?.toISOString() ?? null,
        completed: Boolean(c.completedAt),
        board: { id: c.board.id, name: c.board.name },
        column: c.column,
      }));
    }),

  /**
   * Put a card on your personal board: "mirror" shows the live team card there,
   * "duplicate" makes an independent personal copy.
   */
  toPersonal: orgProcedure
    .input(z.object({ cardId: z.string(), mode: z.enum(["mirror", "duplicate"]) }))
    .mutation(async ({ ctx, input }) => {
      const card = await getCardOrThrow(ctx, input.cardId);
      return ctx.db.$transaction(async (tx) => {
        const board = await ensurePersonalBoard(tx, ctx.org.id, ctx.user);
        if (card.boardId === board.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That card is already on your board." });
        }
        if (input.mode === "mirror") {
          await mirrorCard(tx, ctx.user, card);
          return { mode: "mirror" as const, boardId: board.id, cardId: card.id };
        }
        const copy = await duplicateToPersonal(tx, ctx.user, card);
        return { mode: "duplicate" as const, boardId: board.id, cardId: copy.id };
      });
    }),

  /** Take a mirrored card off your personal board. The team card is untouched. */
  unmirror: orgProcedure.input(z.object({ cardId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.cardMirror.deleteMany({ where: { cardId: input.cardId, userId: ctx.user.id, orgId: ctx.org.id } });
    return { removed: true };
  }),

  /** Mirror every open team card assigned to you that is not on your board yet. */
  mirrorAssigned: orgProcedure.mutation(async ({ ctx }) => {
    return ctx.db.$transaction(async (tx) => {
      const board = await ensurePersonalBoard(tx, ctx.org.id, ctx.user);
      const cards = await tx.card.findMany({
        where: {
          orgId: ctx.org.id,
          assigneeId: ctx.user.id,
          archivedAt: null,
          completedAt: null,
          parentId: null,
          boardId: { not: board.id },
          board: { ownerId: null, archivedAt: null },
          mirrors: { none: { userId: ctx.user.id } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      });
      for (const card of cards) await mirrorCard(tx, ctx.user, card);
      return { mirrored: cards.length, boardId: board.id };
    });
  }),

  search: orgProcedure.input(z.object({ query: z.string().trim().min(1).max(100) })).query(({ ctx, input }) =>
    ctx.db.card.findMany({
      where: {
        orgId: ctx.org.id,
        archivedAt: null,
        board: visibleBoards(ctx),
        OR: [
          { title: { contains: input.query, mode: "insensitive" } },
          { descriptionText: { contains: input.query, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        number: true,
        title: true,
        completedAt: true,
        board: { select: { id: true, key: true, name: true } },
      },
    }),
  ),
});
