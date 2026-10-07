import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COLUMN_COLORS } from "@/lib/workflow-presets";
import { createTRPCRouter, managerProcedure, orgProcedure } from "@/server/trpc/init";

const columnSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(COLUMN_COLORS),
  category: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  wipLimit: z.number().int().positive().max(999).optional(),
});

const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Lowercase letters, numbers and underscores"),
  label: z.string().trim().min(1).max(40),
  type: z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "MULTI_SELECT", "URL", "CHECKBOX", "PERSON"]),
  options: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  required: z.boolean().optional(),
});

const templateInput = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().max(200).optional(),
  category: z.enum(["GENERAL", "TECH", "CREATIVE", "SALES", "INFLUENCER", "OUTREACH"]).default("GENERAL"),
  icon: z.string().max(40).default("layout-kanban"),
  columns: z
    .array(columnSchema)
    .min(2, "A workflow needs at least two steps")
    .max(15)
    .refine((cols) => cols.some((c) => c.category === "DONE"), "Add at least one 'done' step"),
  fields: z
    .array(fieldSchema)
    .max(20)
    .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, "Field keys must be unique")
    .default([]),
});

export const templateRouter = createTRPCRouter({
  list: orgProcedure.query(({ ctx }) =>
    ctx.db.workflowTemplate.findMany({
      where: { OR: [{ orgId: null }, { orgId: ctx.org.id }] },
      orderBy: [{ orgId: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    }),
  ),

  create: managerProcedure
    .input(templateInput)
    .mutation(({ ctx, input }) => ctx.db.workflowTemplate.create({ data: { ...input, orgId: ctx.org.id } })),

  /** Saves a board's current columns and fields as a reusable template. */
  createFromBoard: managerProcedure
    .input(
      z.object({
        boardId: z.string(),
        name: z.string().trim().min(2).max(60),
        description: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await ctx.db.board.findFirst({
        where: { id: input.boardId, orgId: ctx.org.id, OR: [{ ownerId: null }, { ownerId: ctx.user.id }] },
        include: { columns: { orderBy: { position: "asc" } }, fields: { orderBy: { position: "asc" } } },
      });
      if (!board) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.workflowTemplate.create({
        data: {
          orgId: ctx.org.id,
          name: input.name,
          description: input.description,
          icon: board.icon,
          columns: board.columns.map((c) => ({
            name: c.name,
            color: c.color,
            category: c.category,
            ...(c.wipLimit ? { wipLimit: c.wipLimit } : {}),
          })),
          fields: board.fields.map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            options: f.options,
            required: f.required,
          })),
        },
      });
    }),

  update: managerProcedure
    .input(templateInput.partial().extend({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { templateId, ...data } = input;
      const template = await ctx.db.workflowTemplate.findFirst({ where: { id: templateId, orgId: ctx.org.id } });
      if (!template)
        throw new TRPCError({ code: "NOT_FOUND", message: "Built-in templates can't be edited. Duplicate it first." });
      return ctx.db.workflowTemplate.update({ where: { id: template.id }, data });
    }),

  delete: managerProcedure.input(z.object({ templateId: z.string() })).mutation(async ({ ctx, input }) => {
    const deleted = await ctx.db.workflowTemplate.deleteMany({ where: { id: input.templateId, orgId: ctx.org.id } });
    if (!deleted.count) throw new TRPCError({ code: "NOT_FOUND" });
    return { deleted: true };
  }),
});
