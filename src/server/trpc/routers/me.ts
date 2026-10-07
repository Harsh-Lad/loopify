import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, orgProcedure, protectedProcedure } from "@/server/trpc/init";

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const meRouter = createTRPCRouter({
  get: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/me", tags: ["me"], protect: true, summary: "Current user and orgs" } })
    .input(z.void())
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        image: z.string().nullable(),
        timezone: z.string(),
        activeOrgId: z.string().nullable(),
        isPlatformAdmin: z.boolean(),
        orgs: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string(), role: z.string() })),
      }),
    )
    .query(async ({ ctx }) => {
      const memberships = await ctx.db.orgMember.findMany({
        where: { userId: ctx.user.id },
        include: { org: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        ...ctx.user,
        orgs: memberships.map((m) => ({ ...m.org, role: m.role })),
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(80).optional(),
        timezone: z.string().refine(isTimeZone, "Unknown time zone").optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({ where: { id: ctx.user.id }, data: input, select: { id: true, name: true, timezone: true } }),
    ),

  /** Personal board preferences in the active org. */
  personalPrefs: orgProcedure.query(async ({ ctx }) => {
    const member = await ctx.db.orgMember.findUniqueOrThrow({
      where: { orgId_userId: { orgId: ctx.org.id, userId: ctx.user.id } },
      select: { autoMirror: true },
    });
    const board = await ctx.db.board.findUnique({
      where: { orgId_ownerId: { orgId: ctx.org.id, ownerId: ctx.user.id } },
      select: { id: true },
    });
    return { autoMirror: member.autoMirror, boardId: board?.id ?? null };
  }),

  setAutoMirror: orgProcedure.input(z.object({ autoMirror: z.boolean() })).mutation(async ({ ctx, input }) => {
    await ctx.db.orgMember.update({
      where: { orgId_userId: { orgId: ctx.org.id, userId: ctx.user.id } },
      data: { autoMirror: input.autoMirror },
    });
    return input;
  }),

  setActiveOrg: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/me/active-org", tags: ["me"], protect: true } })
    .input(z.object({ orgId: z.string() }))
    .output(z.object({ activeOrgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: input.orgId, userId: ctx.user.id } },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });
      await ctx.db.user.update({ where: { id: ctx.user.id }, data: { activeOrgId: input.orgId } });
      return { activeOrgId: input.orgId };
    }),
});
