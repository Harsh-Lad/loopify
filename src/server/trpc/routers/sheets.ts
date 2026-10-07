import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AiNotConfiguredError, getAi, isAiConfigured, type ChatMessage, type ToolCall } from "@/server/ai";
import { GoogleNotConnectedError, isGoogleConfigured } from "@/server/google/oauth";
import { applyOperation, runSheetTool, SHEET_TOOLS, undoOperation } from "@/server/google/sheets";
import {
  addTab,
  appendRows,
  createSpreadsheet,
  deleteRows,
  formatCells,
  freezePanes,
  getSpreadsheetMeta,
  listSpreadsheets,
  readTab,
  sortByColumn,
  writeCells,
} from "@/server/google/workspace";
import { createTRPCRouter, orgProcedure } from "@/server/trpc/init";

const MAX_TOOL_ROUNDS = 6;
const HISTORY = 30;

const SYSTEM_PROMPT = `You are Loopify's spreadsheet helper. You work on the user's Google Sheets through tools.
- When the user tags sheets like [sheet "Name" id=XYZ], use those spreadsheetIds directly. Don't search for them.
- Otherwise find the right spreadsheet first (list_spreadsheets), then look before you change anything (get_spreadsheet, read_range).
- Edits to existing sheets go through a propose_* tool. They are NOT applied until the user taps Approve, so never claim they were changed. After proposing, say in one short sentence what you proposed.
- create_spreadsheet runs immediately, no approval needed. Put the header and rows in it directly, then share the link.
- To move or copy data: read_range on the source, then propose_append or propose_update on the target, or create_spreadsheet with the rows for a brand new sheet.
- When the user asks for a link, call get_share_link and give the URL. People need access in Google Drive to open it.
- Keep replies short and plain. Use small markdown tables when showing data, and **bold** for key numbers. No em dashes.
- If something is ambiguous (which sheet, which rows), ask one short question instead of guessing.`;

/** Mentions are stored in the message text as @[Title](sheet:ID). */
const MENTION = /@\[([^\]]*)\]\(sheet:([\w-]+)\)/g;

function forModel(content: string) {
  return content.replace(MENTION, (_, title: string, id: string) => `[sheet "${title}" id=${id}]`);
}

function plain(content: string) {
  return content.replace(MENTION, (_, title: string) => `@${title}`).trim();
}

function isMissingColumn(error: unknown) {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2022"
  );
}

function friendly(error: unknown) {
  if (error instanceof AiNotConfiguredError || error instanceof GoogleNotConnectedError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid_grant|unauthorized|401/i.test(message))
    return "Google access expired. Reconnect Google in Settings → Connectors.";
  if (/404|not found/i.test(message)) return "I couldn't find that spreadsheet or range.";
  if (/403|permission/i.test(message)) return "Google says you don't have access to that file.";
  return "Something went wrong talking to Google. Try again in a moment.";
}

export const sheetsRouter = createTRPCRouter({
  status: orgProcedure.query(async ({ ctx }) => {
    const integration = await ctx.db.integration.findUnique({
      where: { orgId_userId_provider: { orgId: ctx.org.id, userId: ctx.user.id, provider: "GOOGLE" } },
      select: { accountEmail: true, createdAt: true },
    });
    return {
      aiConfigured: isAiConfigured(),
      googleConfigured: isGoogleConfigured(),
      connected: Boolean(integration),
      accountEmail: integration?.accountEmail ?? null,
    };
  }),

  sessions: orgProcedure.query(({ ctx }) =>
    ctx.db.chatSession.findMany({
      where: { orgId: ctx.org.id, userId: ctx.user.id, kind: "SHEETS" },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, updatedAt: true, spreadsheetId: true },
    }),
  ),

  createSession: orgProcedure.mutation(({ ctx }) =>
    ctx.db.chatSession.create({ data: { orgId: ctx.org.id, userId: ctx.user.id, kind: "SHEETS" } }),
  ),

  deleteSession: orgProcedure.input(z.object({ sessionId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.chatSession.deleteMany({ where: { id: input.sessionId, userId: ctx.user.id, orgId: ctx.org.id } });
    return { deleted: true };
  }),

  session: orgProcedure.input(z.object({ sessionId: z.string() })).query(async ({ ctx, input }) => {
    const session = await ctx.db.chatSession.findFirst({
      where: { id: input.sessionId, userId: ctx.user.id, orgId: ctx.org.id },
      include: {
        messages: { where: { role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "asc" } },
        operations: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!session) throw new TRPCError({ code: "NOT_FOUND" });
    return session;
  }),

  send: orgProcedure
    .input(
      z.object({
        sessionId: z.string(),
        message: z.string().trim().max(4000),
        mentions: z
          .array(z.object({ id: z.string().max(200), title: z.string().max(200) }))
          .max(10)
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.message && !input.mentions.length)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Say something" });
      const tags = input.mentions.map((m) => `@[${m.title.replace(/[\[\]]/g, "")}](sheet:${m.id})`).join(" ");
      const content = [tags, input.message].filter(Boolean).join(" ");
      const session = await ctx.db.chatSession.findFirst({
        where: { id: input.sessionId, userId: ctx.user.id, orgId: ctx.org.id },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.chatMessage.create({ data: { sessionId: session.id, role: "USER", content } });
      if (session.title === "New chat") {
        await ctx.db.chatSession.update({ where: { id: session.id }, data: { title: plain(content).slice(0, 60) } });
      }

      const history = (
        await ctx.db.chatMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: "desc" },
          take: HISTORY,
        })
      ).reverse();

      const context = session.spreadsheetId
        ? `\nThe user has this spreadsheet open: "${session.spreadsheetTitle ?? "Untitled"}" (spreadsheetId ${session.spreadsheetId}). Assume requests are about it unless they name another sheet.`
        : "";
      const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT + context }];
      for (const m of history) {
        if (m.role === "USER") messages.push({ role: "user", content: forModel(m.content) });
        else if (m.role === "ASSISTANT") {
          messages.push({
            role: "assistant",
            content: m.content || null,
            toolCalls: (m.toolCalls as ToolCall[] | null) ?? undefined,
          });
        } else if (m.toolCallId) messages.push({ role: "tool", content: m.content, toolCallId: m.toolCallId });
      }
      // A history window can start mid tool-exchange; drop orphaned tool results.
      while (messages[1]?.role === "tool") messages.splice(1, 1);

      let reply = "";
      try {
        const ai = await getAi(ctx.org.id);
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await ai.chat({ messages, tools: SHEET_TOOLS, temperature: 0.2 });
          messages.push({ role: "assistant", content: response.content, toolCalls: response.toolCalls });
          await ctx.db.chatMessage.create({
            data: {
              sessionId: session.id,
              role: "ASSISTANT",
              content: response.content ?? "",
              toolCalls: response.toolCalls.length
                ? (response.toolCalls as unknown as Prisma.InputJsonValue)
                : undefined,
            },
          });

          if (!response.toolCalls.length) {
            reply = response.content ?? "";
            break;
          }

          for (const call of response.toolCalls) {
            let result: unknown;
            try {
              result = await runSheetTool(
                { orgId: ctx.org.id, userId: ctx.user.id, sessionId: session.id },
                call.name,
                JSON.parse(call.arguments || "{}"),
              );
            } catch (error) {
              if (error instanceof GoogleNotConnectedError) throw error;
              result = { error: friendly(error) };
            }
            const content = JSON.stringify(result).slice(0, 20_000);
            messages.push({ role: "tool", content, toolCallId: call.id });
            await ctx.db.chatMessage.create({
              data: { sessionId: session.id, role: "TOOL", content, toolCallId: call.id },
            });
          }
        }
      } catch (error) {
        reply = friendly(error);
        await ctx.db.chatMessage.create({ data: { sessionId: session.id, role: "ASSISTANT", content: reply } });
      }

      await ctx.db.chatSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });
      return { reply };
    }),

  approve: orgProcedure.input(z.object({ operationId: z.string() })).mutation(async ({ ctx, input }) => {
    const op = await ctx.db.sheetOperation.findFirst({
      where: { id: input.operationId, userId: ctx.user.id, status: "PROPOSED", session: { orgId: ctx.org.id } },
    });
    if (!op) throw new TRPCError({ code: "NOT_FOUND", message: "This change was already handled." });
    try {
      const result = await applyOperation(ctx.org.id, op);
      return ctx.db.sheetOperation.update({
        where: { id: op.id },
        data: { status: "APPLIED", appliedAt: new Date(), result: (result ?? {}) as Prisma.InputJsonValue },
      });
    } catch (error) {
      await ctx.db.sheetOperation.update({ where: { id: op.id }, data: { status: "FAILED", error: friendly(error) } });
      throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
    }
  }),

  reject: orgProcedure.input(z.object({ operationId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.sheetOperation.updateMany({
      where: { id: input.operationId, userId: ctx.user.id, status: "PROPOSED", session: { orgId: ctx.org.id } },
      data: { status: "REJECTED" },
    });
    return { rejected: true };
  }),

  undo: orgProcedure.input(z.object({ operationId: z.string() })).mutation(async ({ ctx, input }) => {
    const op = await ctx.db.sheetOperation.findFirst({
      where: { id: input.operationId, userId: ctx.user.id, status: "APPLIED", session: { orgId: ctx.org.id } },
    });
    if (!op) throw new TRPCError({ code: "NOT_FOUND" });
    try {
      await undoOperation(ctx.org.id, op);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : friendly(error) });
    }
    return ctx.db.sheetOperation.update({ where: { id: op.id }, data: { status: "UNDONE" } });
  }),

  // ── In-app editor: these run immediately because the user makes the change by hand ──

  browse: orgProcedure
    .input(z.object({ query: z.string().max(100).optional(), pageToken: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        return await listSpreadsheets(ctx.org.id, ctx.user.id, input.query, input.pageToken);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),

  spreadsheet: orgProcedure.input(z.object({ spreadsheetId: z.string() })).query(async ({ ctx, input }) => {
    try {
      return await getSpreadsheetMeta(ctx.org.id, ctx.user.id, input.spreadsheetId);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
    }
  }),

  tab: orgProcedure.input(z.object({ spreadsheetId: z.string(), tab: z.string() })).query(async ({ ctx, input }) => {
    try {
      return await readTab(ctx.org.id, ctx.user.id, input.spreadsheetId, input.tab);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
    }
  }),

  saveCells: orgProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        tab: z.string(),
        edits: z
          .array(
            z.object({
              row: z.number().int().min(0),
              col: z.number().int().min(0).max(701),
              value: z.string().max(50_000),
            }),
          )
          .max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await writeCells(ctx.org.id, ctx.user.id, input.spreadsheetId, input.tab, input.edits);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),

  deleteRows: orgProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        sheetId: z.number().int(),
        rows: z.array(z.number().int().min(0)).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteRows(ctx.org.id, ctx.user.id, input.spreadsheetId, input.sheetId, input.rows);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),

  addTab: orgProcedure
    .input(z.object({ spreadsheetId: z.string(), title: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await addTab(ctx.org.id, ctx.user.id, input.spreadsheetId, input.title);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),

  createSpreadsheet: orgProcedure
    .input(z.object({ title: z.string().trim().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await createSpreadsheet(ctx.org.id, ctx.user.id, input.title);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),

  /** Sends picked rows to another spreadsheet's tab, or into a brand new spreadsheet. */
  sendRows: orgProcedure
    .input(
      z.object({
        rows: z
          .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
          .min(1)
          .max(5000),
        header: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
        target: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("existing"), spreadsheetId: z.string(), tab: z.string() }),
          z.object({ kind: z.literal("new"), title: z.string().trim().min(1).max(200) }),
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.target.kind === "new") {
          const rows = input.header ? [input.header, ...input.rows] : input.rows;
          const created = await createSpreadsheet(ctx.org.id, ctx.user.id, input.target.title, rows);
          return { spreadsheetId: created.id, url: created.url, rows: input.rows.length };
        }
        await appendRows(ctx.org.id, ctx.user.id, input.target.spreadsheetId, input.target.tab, input.rows);
        const meta = await getSpreadsheetMeta(ctx.org.id, ctx.user.id, input.target.spreadsheetId);
        return { spreadsheetId: meta.id, url: meta.url, rows: input.rows.length };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),

  /** The chat thread that belongs to one spreadsheet. Reuses the latest one, or starts it. */
  sheetSession: orgProcedure
    .input(z.object({ spreadsheetId: z.string(), title: z.string().max(200) }))
    .query(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.chatSession.findFirst({
          where: { orgId: ctx.org.id, userId: ctx.user.id, kind: "SHEETS", spreadsheetId: input.spreadsheetId },
          orderBy: { updatedAt: "desc" },
          select: { id: true, spreadsheetTitle: true },
        });
        if (existing) {
          if (existing.spreadsheetTitle !== input.title) {
            await ctx.db.chatSession.update({ where: { id: existing.id }, data: { spreadsheetTitle: input.title } });
          }
          return { id: existing.id };
        }
        return await ctx.db.chatSession.create({
          data: {
            orgId: ctx.org.id,
            userId: ctx.user.id,
            kind: "SHEETS",
            spreadsheetId: input.spreadsheetId,
            spreadsheetTitle: input.title,
            title: input.title,
          },
          select: { id: true },
        });
      } catch (error) {
        if (isMissingColumn(error)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "The database is behind the code. Run `npm run db:migrate` and restart the dev server.",
          });
        }
        throw error;
      }
    }),

  formatCells: orgProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        sheetId: z.number().int(),
        range: z.object({
          row: z.number().int().min(0),
          col: z.number().int().min(0),
          rows: z.number().int().min(1).max(5000),
          cols: z.number().int().min(1).max(200),
        }),
        format: z.object({
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          strike: z.boolean().optional(),
          underline: z.boolean().optional(),
          color: z
            .string()
            .regex(/^#[0-9a-f]{6}$/i)
            .nullable()
            .optional(),
          fill: z
            .string()
            .regex(/^#[0-9a-f]{6}$/i)
            .nullable()
            .optional(),
          align: z.enum(["LEFT", "CENTER", "RIGHT"]).optional(),
          wrap: z.boolean().optional(),
          clear: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await formatCells(
          ctx.org.id,
          ctx.user.id,
          input.spreadsheetId,
          input.sheetId,
          input.range,
          input.format,
        );
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),

  freeze: orgProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        sheetId: z.number().int(),
        rows: z.number().int().min(0).max(50),
        columns: z.number().int().min(0).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await freezePanes(
          ctx.org.id,
          ctx.user.id,
          input.spreadsheetId,
          input.sheetId,
          input.rows,
          input.columns,
        );
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),

  sort: orgProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        sheetId: z.number().int(),
        column: z.number().int().min(0),
        ascending: z.boolean(),
        headerRows: z.number().int().min(0).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await sortByColumn(
          ctx.org.id,
          ctx.user.id,
          input.spreadsheetId,
          input.sheetId,
          input.column,
          input.ascending,
          input.headerRows,
        );
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: friendly(error) });
      }
    }),
});
