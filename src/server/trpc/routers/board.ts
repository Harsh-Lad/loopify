import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dayKeyToDate, localDayKey } from "@/lib/dates";
import { COLUMN_COLORS } from "@/lib/workflow-presets";
import { between, createBoardFromTemplate } from "@/server/services/boards";
import { ensurePersonalBoard } from "@/server/services/personal";
import { assertCanManageBoard, assertCanManageTeam, getBoardOrThrow, visibleBoards } from "@/server/trpc/guards";
import { createTRPCRouter, orgProcedure } from "@/server/trpc/init";

const userSelect = { id: true, name: true, image: true } as const;

export const boardRouter = createTRPCRouter({
  /** Team boards, then your own personal board (marked by `ownerId`). */
  list: orgProcedure.query(async ({ ctx }) => {
    const boards = await ctx.db.board.findMany({
      where: { orgId: ctx.org.id, archivedAt: null, ...visibleBoards(ctx) },
      orderBy: { createdAt: "asc" },
      include: { team: { select: { id: true, name: true, color: true, icon: true } } },
    });
    return boards.sort((a, b) => Number(Boolean(b.ownerId)) - Number(Boolean(a.ownerId)));
  }),

  /** Your private board in this org, created on first use. */
  personal: orgProcedure.mutation(async ({ ctx }) => {
    try {
      const board = await ctx.db.$transaction((tx) => ensurePersonalBoard(tx, ctx.org.id, ctx.user));
      return { id: board.id, key: board.key };
    } catch (error) {
      // Two tabs (or a double render) creating it at once: the loser just reads the winner's board.
      const board = await ctx.db.board.findUnique({
        where: { orgId_ownerId: { orgId: ctx.org.id, ownerId: ctx.user.id } },
      });
      if (!board) throw error;
      return { id: board.id, key: board.key };
    }
  }),

  get: orgProcedure.input(z.object({ boardId: z.string() })).query(async ({ ctx, input }) => {
    const board = await ctx.db.board.findFirst({
      where: { id: input.boardId, orgId: ctx.org.id, ...visibleBoards(ctx) },
      include: {
        team: { select: { id: true, name: true, color: true, icon: true } },
        columns: { orderBy: { position: "asc" } },
        fields: { orderBy: { position: "asc" } },
        cards: {
          where: { archivedAt: null, parentId: null },
          orderBy: { position: "asc" },
          include: {
            assignee: { select: userSelect },
            _count: { select: { comments: true, subtasks: true } },
          },
        },
      },
    });
    if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });

    // Personal boards also show team cards mirrored onto them, placed in the owner's own columns.
    const mirrors = board.ownerId
      ? await ctx.db.cardMirror.findMany({
          where: { boardId: board.id, card: { archivedAt: null } },
          include: {
            card: {
              include: {
                assignee: { select: userSelect },
                board: { select: { id: true, key: true, name: true } },
                column: { select: { name: true, category: true } },
                _count: { select: { comments: true, subtasks: true } },
              },
            },
          },
        })
      : [];
    const cards = [
      ...board.cards.map((c) => ({ ...c, mirror: null })),
      ...mirrors.map(({ card: { board: source, column, ...card }, ...m }) => ({
        ...card,
        columnId: m.columnId,
        position: m.position,
        mirror: { id: m.id, boardId: source.id, boardKey: source.key, boardName: source.name, status: column.name },
      })),
    ].sort((a, b) => a.position - b.position);

    const plannedToday = await ctx.db.dayPlanItem.findMany({
      where: {
        cardId: { in: cards.map((c) => c.id) },
        status: "PLANNED",
        dayPlan: { userId: ctx.user.id, orgId: ctx.org.id, date: dayKeyToDate(localDayKey(ctx.user.timezone)) },
      },
      select: { cardId: true },
    });

    return { ...board, cards, plannedCardIds: plannedToday.map((p) => p.cardId) };
  }),

  create: orgProcedure
    .input(
      z.object({
        teamId: z.string(),
        templateId: z.string(),
        name: z.string().trim().min(2).max(60),
        key: z
          .string()
          .regex(/^[A-Za-z0-9]{2,6}$/)
          .optional(),
        icon: z.string().max(40).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findFirst({ where: { id: input.teamId, orgId: ctx.org.id } });
      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
      await assertCanManageTeam(ctx, team.id);
      return ctx.db.$transaction((tx) => createBoardFromTemplate(tx, { orgId: ctx.org.id, ...input }));
    }),

  update: orgProcedure
    .input(
      z.object({
        boardId: z.string(),
        name: z.string().trim().min(2).max(60).optional(),
        icon: z.string().max(40).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await getBoardOrThrow(ctx, input.boardId);
      await assertCanManageBoard(ctx, board);
      return ctx.db.board.update({ where: { id: board.id }, data: { name: input.name, icon: input.icon } });
    }),

  archive: orgProcedure
    .input(z.object({ boardId: z.string(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const board = await getBoardOrThrow(ctx, input.boardId);
      await assertCanManageBoard(ctx, board);
      return ctx.db.board.update({ where: { id: board.id }, data: { archivedAt: input.archived ? new Date() : null } });
    }),

  addColumn: orgProcedure
    .input(
      z.object({
        boardId: z.string(),
        name: z.string().trim().min(1).max(40),
        color: z.enum(COLUMN_COLORS).default("slate"),
        category: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("IN_PROGRESS"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await getBoardOrThrow(ctx, input.boardId);
      await assertCanManageBoard(ctx, board);
      const last = await ctx.db.boardColumn.findFirst({ where: { boardId: board.id }, orderBy: { position: "desc" } });
      return ctx.db.boardColumn.create({
        data: {
          boardId: board.id,
          name: input.name,
          color: input.color,
          category: input.category,
          position: between(last?.position, null),
        },
      });
    }),

  updateColumn: orgProcedure
    .input(
      z.object({
        columnId: z.string(),
        name: z.string().trim().min(1).max(40).optional(),
        color: z.enum(COLUMN_COLORS).optional(),
        category: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
        wipLimit: z.number().int().positive().max(999).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { columnId, ...data } = input;
      const column = await ctx.db.boardColumn.findFirst({
        where: { id: columnId, board: { orgId: ctx.org.id } },
        include: { board: true },
      });
      if (!column) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanManageBoard(ctx, column.board);
      return ctx.db.boardColumn.update({ where: { id: column.id }, data });
    }),

  moveColumn: orgProcedure
    .input(z.object({ columnId: z.string(), beforeId: z.string().nullish(), afterId: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      const column = await ctx.db.boardColumn.findFirst({
        where: { id: input.columnId, board: { orgId: ctx.org.id } },
        include: { board: true },
      });
      if (!column) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanManageBoard(ctx, column.board);
      const [before, after] = await Promise.all([
        input.beforeId
          ? ctx.db.boardColumn.findFirst({ where: { id: input.beforeId, boardId: column.boardId } })
          : null,
        input.afterId ? ctx.db.boardColumn.findFirst({ where: { id: input.afterId, boardId: column.boardId } }) : null,
      ]);
      return ctx.db.boardColumn.update({
        where: { id: column.id },
        data: { position: between(before?.position, after?.position) },
      });
    }),

  /** Deletes a column. Its cards move to `moveCardsTo` first. */
  deleteColumn: orgProcedure
    .input(z.object({ columnId: z.string(), moveCardsTo: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.columnId === input.moveCardsTo)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a different column." });
      const column = await ctx.db.boardColumn.findFirst({
        where: { id: input.columnId, board: { orgId: ctx.org.id } },
        include: { board: true },
      });
      const target = await ctx.db.boardColumn.findFirst({ where: { id: input.moveCardsTo, boardId: column?.boardId } });
      if (!column || !target) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanManageBoard(ctx, column.board);
      const remaining = await ctx.db.boardColumn.count({ where: { boardId: column.boardId } });
      if (remaining <= 2) throw new TRPCError({ code: "BAD_REQUEST", message: "A board needs at least two columns." });
      await ctx.db.$transaction([
        ctx.db.card.updateMany({ where: { columnId: column.id }, data: { columnId: target.id } }),
        ctx.db.cardMirror.updateMany({ where: { columnId: column.id }, data: { columnId: target.id } }),
        ctx.db.boardColumn.delete({ where: { id: column.id } }),
      ]);
      return { deleted: true };
    }),

  addField: orgProcedure
    .input(
      z.object({
        boardId: z.string(),
        key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
        label: z.string().trim().min(1).max(40),
        type: z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "MULTI_SELECT", "URL", "CHECKBOX", "PERSON"]),
        options: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
        required: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await getBoardOrThrow(ctx, input.boardId);
      await assertCanManageBoard(ctx, board);
      const last = await ctx.db.fieldDefinition.findFirst({
        where: { boardId: board.id },
        orderBy: { position: "desc" },
      });
      const { boardId, ...data } = input;
      return ctx.db.fieldDefinition.create({ data: { ...data, boardId, position: between(last?.position, null) } });
    }),

  updateField: orgProcedure
    .input(
      z.object({
        fieldId: z.string(),
        label: z.string().trim().min(1).max(40).optional(),
        options: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
        required: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { fieldId, ...data } = input;
      const field = await ctx.db.fieldDefinition.findFirst({
        where: { id: fieldId, board: { orgId: ctx.org.id } },
        include: { board: true },
      });
      if (!field) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanManageBoard(ctx, field.board);
      return ctx.db.fieldDefinition.update({ where: { id: field.id }, data });
    }),

  deleteField: orgProcedure.input(z.object({ fieldId: z.string() })).mutation(async ({ ctx, input }) => {
    const field = await ctx.db.fieldDefinition.findFirst({
      where: { id: input.fieldId, board: { orgId: ctx.org.id } },
      include: { board: true },
    });
    if (!field) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCanManageBoard(ctx, field.board);
    await ctx.db.fieldDefinition.delete({ where: { id: field.id } });
    return { deleted: true };
  }),
});
