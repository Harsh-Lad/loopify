import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { slugify } from "@/lib/slug";
import { createBoardFromTemplate } from "@/server/services/boards";
import { assertCanManageTeam, assertOrgUser } from "@/server/trpc/guards";
import { createTRPCRouter, managerProcedure, orgProcedure } from "@/server/trpc/init";

export const teamRouter = createTRPCRouter({
  list: orgProcedure.query(async ({ ctx }) => {
    const teams = await ctx.db.team.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "asc" },
      include: {
        members: { select: { userId: true, role: true } },
        boards: {
          where: { archivedAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, key: true, icon: true },
        },
      },
    });
    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      icon: team.icon,
      color: team.color,
      description: team.description,
      memberCount: team.members.length,
      isMember: team.members.some((m) => m.userId === ctx.user.id),
      isLead: team.members.some((m) => m.userId === ctx.user.id && m.role === "LEAD"),
      boards: team.boards,
    }));
  }),

  get: orgProcedure.input(z.object({ teamId: z.string() })).query(async ({ ctx, input }) => {
    const team = await ctx.db.team.findFirst({
      where: { id: input.teamId, orgId: ctx.org.id },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
        boards: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
    return team;
  }),

  create: managerProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(40),
        description: z.string().max(200).optional(),
        icon: z.string().max(40).default("users"),
        color: z.string().max(20).default("violet"),
        templateId: z.string().default("tpl_general"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.name) || "team";
      let slug = base;
      for (let i = 2; await ctx.db.team.findUnique({ where: { orgId_slug: { orgId: ctx.org.id, slug } } }); i++) {
        slug = `${base}-${i}`;
      }
      return ctx.db.$transaction(async (tx) => {
        const team = await tx.team.create({
          data: {
            orgId: ctx.org.id,
            name: input.name,
            slug,
            description: input.description,
            icon: input.icon,
            color: input.color,
            members: { create: { userId: ctx.user.id, role: "LEAD" } },
          },
        });
        const board = await createBoardFromTemplate(tx, {
          orgId: ctx.org.id,
          teamId: team.id,
          templateId: input.templateId,
          name: input.name,
        });
        return { team, boardId: board.id };
      });
    }),

  update: orgProcedure
    .input(
      z.object({
        teamId: z.string(),
        name: z.string().trim().min(2).max(40).optional(),
        description: z.string().max(200).nullish(),
        icon: z.string().max(40).optional(),
        color: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { teamId, ...data } = input;
      const team = await ctx.db.team.findFirst({ where: { id: teamId, orgId: ctx.org.id } });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanManageTeam(ctx, team.id);
      return ctx.db.team.update({ where: { id: team.id }, data });
    }),

  addMember: orgProcedure
    .input(z.object({ teamId: z.string(), userId: z.string(), role: z.enum(["LEAD", "MEMBER"]).default("MEMBER") }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findFirst({ where: { id: input.teamId, orgId: ctx.org.id } });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanManageTeam(ctx, team.id);
      await assertOrgUser(ctx, input.userId);
      return ctx.db.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: input.userId } },
        create: { teamId: team.id, userId: input.userId, role: input.role },
        update: { role: input.role },
      });
    }),

  removeMember: orgProcedure
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findFirst({ where: { id: input.teamId, orgId: ctx.org.id } });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.userId !== ctx.user.id) await assertCanManageTeam(ctx, team.id);
      await ctx.db.teamMember.deleteMany({ where: { teamId: team.id, userId: input.userId } });
      return { removed: true };
    }),

  join: orgProcedure.input(z.object({ teamId: z.string() })).mutation(async ({ ctx, input }) => {
    const team = await ctx.db.team.findFirst({ where: { id: input.teamId, orgId: ctx.org.id } });
    if (!team) throw new TRPCError({ code: "NOT_FOUND" });
    return ctx.db.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: ctx.user.id } },
      create: { teamId: team.id, userId: ctx.user.id },
      update: {},
    });
  }),
});
