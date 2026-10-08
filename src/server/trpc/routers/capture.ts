import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { localDayKey } from "@/lib/dates";
import { isAiConfigured } from "@/server/ai";
import { listCaptureFiles, readCaptureFile } from "@/server/google/drive-docs";
import { GoogleNotConnectedError, isGoogleConfigured } from "@/server/google/oauth";
import { dispatchCaptureCreated } from "@/server/inngest/dispatch";
import { STALE_CLAIM_MS } from "@/server/services/capture";
import { between } from "@/server/services/boards";
import { endOfColumn } from "@/server/services/cards";
import { getOrCreateDayPlan } from "@/server/services/day";
import { recordEvent } from "@/server/services/events";
import { addCaptureToPersonalBoard, autoMirrorOnAssign } from "@/server/services/personal";
import { assertAssignable, assertOrgUser, getBoardOrThrow } from "@/server/trpc/guards";
import { createTRPCRouter, orgProcedure } from "@/server/trpc/init";

/** Google errors reach the client as readable messages instead of a 500. */
function googleError(error: unknown): never {
  if (error instanceof GoogleNotConnectedError) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
  }
  const message = error instanceof Error ? error.message : "Google didn't answer. Try again.";
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/**
 * Self-healing: anything still waiting long after it should have finished
 * (a worker that timed out, an old queued job) is processed again. The claim
 * inside processCapture makes this safe to call on every poll.
 */
function rescueStuck(captures: { id: string; status: string; createdAt: Date; processingAt: Date | null }[]) {
  const cutoff = Date.now() - STALE_CLAIM_MS;
  for (const c of captures) {
    if (c.status !== "PENDING" && c.status !== "PROCESSING") continue;
    const since = (c.processingAt ?? c.createdAt).getTime();
    if (since < cutoff || (c.status === "PENDING" && !c.processingAt && c.createdAt.getTime() < Date.now() - 20_000)) {
      void dispatchCaptureCreated(c.id);
    }
  }
}

export const captureRouter = createTRPCRouter({
  status: orgProcedure.query(() => ({ aiConfigured: isAiConfigured() })),

  /** Which connectors can feed Capture right now. */
  sources: orgProcedure.query(async ({ ctx }) => {
    const google = await ctx.db.integration.findUnique({
      where: { orgId_userId_provider: { orgId: ctx.org.id, userId: ctx.user.id, provider: "GOOGLE" } },
      select: { accountEmail: true },
    });
    return {
      ai: { configured: isAiConfigured() },
      google: {
        configured: isGoogleConfigured(),
        connected: Boolean(google),
        accountEmail: google?.accountEmail ?? null,
      },
    };
  }),

  /** Google Meet transcripts, Docs, Sheets and caption files to import. */
  driveFiles: orgProcedure
    .input(
      z.object({
        query: z.string().trim().max(100).optional(),
        kind: z.enum(["meetings", "all"]).default("meetings"),
        pageToken: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) => listCaptureFiles(ctx.org.id, ctx.user.id, input).catch(googleError)),

  /** Reads a Drive file and captures it as a meeting. */
  importDriveFile: orgProcedure
    .input(z.object({ fileId: z.string().min(1), toMyBoard: z.boolean().default(false) }))
    .output(z.object({ id: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await readCaptureFile(ctx.org.id, ctx.user.id, input.fileId).catch(googleError);
      if (file.text.length < 3) throw new TRPCError({ code: "BAD_REQUEST", message: "That file is empty." });
      const capture = await ctx.db.capture.create({
        data: {
          orgId: ctx.org.id,
          userId: ctx.user.id,
          rawText: file.text,
          title: file.name.slice(0, 120),
          source: file.kind === "transcript" ? "MEETING" : "TEXT",
          toMyBoard: input.toMyBoard,
        },
      });
      await dispatchCaptureCreated(capture.id);
      return ctx.db.capture.findUniqueOrThrow({ where: { id: capture.id }, select: { id: true, status: true } });
    }),

  /** Text from anywhere: pasted notes, a call recap, a transcript from the mobile app. */
  create: orgProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/captures",
        tags: ["capture"],
        protect: true,
        summary: "Capture text and extract action items",
      },
    })
    .input(
      z.object({
        text: z.string().trim().min(3, "Write a little more").max(60_000),
        title: z.string().trim().max(120).optional(),
        source: z.enum(["TEXT", "VOICE", "MEETING", "EMAIL", "MOBILE"]).default("TEXT"),
        /** Skip review: action items go straight to your personal board as to-dos. */
        toMyBoard: z.boolean().default(false),
      }),
    )
    .output(z.object({ id: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const capture = await ctx.db.capture.create({
        data: {
          orgId: ctx.org.id,
          userId: ctx.user.id,
          rawText: input.text,
          title: input.title,
          source: input.source,
          toMyBoard: input.toMyBoard,
        },
      });
      await dispatchCaptureCreated(capture.id);
      const fresh = await ctx.db.capture.findUniqueOrThrow({
        where: { id: capture.id },
        select: { id: true, status: true },
      });
      return fresh;
    }),

  list: orgProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const captures = await ctx.db.capture.findMany({
        where: { orgId: ctx.org.id, userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          title: true,
          source: true,
          status: true,
          createdAt: true,
          processingAt: true,
          rawText: true,
          _count: { select: { suggestions: { where: { status: "PENDING" } } } },
        },
      });
      rescueStuck(captures);
      return captures;
    }),

  get: orgProcedure.input(z.object({ captureId: z.string() })).query(async ({ ctx, input }) => {
    const capture = await ctx.db.capture.findFirst({
      where: { id: input.captureId, orgId: ctx.org.id, userId: ctx.user.id },
      include: { suggestions: { orderBy: [{ status: "asc" }, { confidence: "desc" }] } },
    });
    if (!capture) throw new TRPCError({ code: "NOT_FOUND" });
    rescueStuck([capture]);
    return capture;
  }),

  retry: orgProcedure.input(z.object({ captureId: z.string() })).mutation(async ({ ctx, input }) => {
    const capture = await ctx.db.capture.findFirst({
      where: { id: input.captureId, orgId: ctx.org.id, userId: ctx.user.id },
    });
    if (!capture) throw new TRPCError({ code: "NOT_FOUND" });
    await ctx.db.capture.update({
      where: { id: capture.id },
      data: { status: "PENDING", processingAt: null, error: null },
    });
    await dispatchCaptureCreated(capture.id);
    return { retried: true };
  }),

  /** Turns a suggestion into a real card, optionally straight onto today's plan. */
  accept: orgProcedure
    .input(
      z.object({
        suggestionId: z.string(),
        boardId: z.string(),
        columnId: z.string().optional(),
        title: z.string().trim().min(1).max(200).optional(),
        assigneeId: z.string().nullish(),
        planToday: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const suggestion = await ctx.db.suggestedCard.findFirst({
        where: { id: input.suggestionId, status: "PENDING", capture: { orgId: ctx.org.id, userId: ctx.user.id } },
      });
      if (!suggestion) throw new TRPCError({ code: "NOT_FOUND", message: "This suggestion was already handled." });
      const board = await getBoardOrThrow(ctx, input.boardId);
      const assigneeId =
        input.assigneeId === undefined ? (suggestion.suggestedUserId ?? ctx.user.id) : input.assigneeId;
      if (assigneeId) await assertOrgUser(ctx, assigneeId);
      assertAssignable(board, assigneeId);

      const plan =
        input.planToday && assigneeId === ctx.user.id
          ? await getOrCreateDayPlan(ctx.org.id, ctx.user.id, localDayKey(ctx.user.timezone))
          : null;

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
            title: input.title ?? suggestion.title,
            descriptionText: suggestion.description,
            assigneeId: assigneeId ?? null,
            reporterId: ctx.user.id,
            priority: suggestion.priority,
            dueDate: suggestion.dueDate,
            position: await endOfColumn(tx, column.id),
            source: "CAPTURE",
            captureId: suggestion.captureId,
          },
        });
        await autoMirrorOnAssign(tx, card);
        await recordEvent(tx, {
          orgId: ctx.org.id,
          boardId: board.id,
          cardId: card.id,
          actorId: ctx.user.id,
          type: "CREATED",
          toColumnId: column.id,
          payload: { title: card.title, source: "capture" },
        });
        await tx.suggestedCard.update({ where: { id: suggestion.id }, data: { status: "ACCEPTED", cardId: card.id } });

        if (plan) {
          const last = await tx.dayPlanItem.findFirst({ where: { dayPlanId: plan.id }, orderBy: { position: "desc" } });
          await tx.dayPlanItem.create({
            data: { dayPlanId: plan.id, cardId: card.id, position: between(last?.position, null) },
          });
          await recordEvent(tx, {
            orgId: ctx.org.id,
            boardId: board.id,
            cardId: card.id,
            actorId: ctx.user.id,
            type: "PLANNED",
          });
        }

        if (assigneeId && assigneeId !== ctx.user.id) {
          await tx.notification.create({
            data: {
              orgId: ctx.org.id,
              userId: assigneeId,
              type: "assigned",
              title: `${ctx.user.name} gave you "${card.title}"`,
              link: `/boards/${board.id}?card=${card.id}`,
            },
          });
        }

        return { cardId: card.id, key: `${board.key}-${card.number}` };
      });
    }),

  /** Every pending suggestion of a capture becomes a to-do on your personal board. */
  addAllToMyBoard: orgProcedure.input(z.object({ captureId: z.string() })).mutation(async ({ ctx, input }) => {
    const capture = await ctx.db.capture.findFirst({
      where: { id: input.captureId, orgId: ctx.org.id, userId: ctx.user.id },
      select: { id: true },
    });
    if (!capture) throw new TRPCError({ code: "NOT_FOUND", message: "Capture not found." });
    return ctx.db.$transaction((tx) => addCaptureToPersonalBoard(tx, capture.id));
  }),

  dismiss: orgProcedure.input(z.object({ suggestionId: z.string() })).mutation(async ({ ctx, input }) => {
    const updated = await ctx.db.suggestedCard.updateMany({
      where: { id: input.suggestionId, status: "PENDING", capture: { orgId: ctx.org.id, userId: ctx.user.id } },
      data: { status: "DISMISSED" },
    });
    if (!updated.count) throw new TRPCError({ code: "NOT_FOUND" });
    return { dismissed: true };
  }),
});
