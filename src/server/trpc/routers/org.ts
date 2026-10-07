import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { slugify } from "@/lib/slug";
import { env } from "@/server/env";
import { randomToken, sha256 } from "@/server/crypto";
import { sendMail } from "@/server/mail/mailer";
import { inviteMessage } from "@/server/mail/templates";
import { createBoardFromTemplate } from "@/server/services/boards";
import { acceptInviteFor, findOpenInvite } from "@/server/services/invites";
import {
  adminProcedure,
  createTRPCRouter,
  hasRole,
  orgProcedure,
  protectedProcedure,
  publicProcedure,
} from "@/server/trpc/init";

const roleSchema = z.enum(["OWNER", "ADMIN", "MANAGER", "MEMBER"]);

export const orgRouter = createTRPCRouter({
  current: orgProcedure.query(({ ctx }) => ({ ...ctx.org, role: ctx.role })),

  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2, "Give it at least 2 characters").max(60) }))
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.name) || "org";
      let slug = base;
      for (let i = 2; await ctx.db.organization.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

      const org = await ctx.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: input.name, slug, members: { create: { userId: ctx.user.id, role: "OWNER" } } },
        });
        const team = await tx.team.create({
          data: {
            orgId: org.id,
            name: "General",
            slug: "general",
            icon: "sparkles",
            color: "violet",
            members: { create: { userId: ctx.user.id, role: "LEAD" } },
          },
        });
        await createBoardFromTemplate(tx, {
          orgId: org.id,
          teamId: team.id,
          templateId: "tpl_general",
          name: "General",
          key: "GEN",
        });
        await tx.user.update({ where: { id: ctx.user.id }, data: { activeOrgId: org.id } });
        return org;
      });

      return org;
    }),

  update: adminProcedure
    .input(z.object({ name: z.string().trim().min(2).max(60) }))
    .mutation(({ ctx, input }) =>
      ctx.db.organization.update({ where: { id: ctx.org.id }, data: { name: input.name } }),
    ),

  members: orgProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.orgMember.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            teamMemberships: {
              where: { team: { orgId: ctx.org.id } },
              select: { team: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    return members.map((m) => ({
      id: m.id,
      role: m.role,
      title: m.title,
      joinedAt: m.createdAt,
      user: { id: m.user.id, name: m.user.name, email: m.user.email, image: m.user.image },
      teams: m.user.teamMemberships.map((t) => t.team),
    }));
  }),

  invites: adminProcedure.query(({ ctx }) =>
    ctx.db.orgInvite.findMany({
      where: { orgId: ctx.org.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    }),
  ),

  invite: adminProcedure
    .input(z.object({ email: z.email().transform((v) => v.trim().toLowerCase()), role: roleSchema.default("MEMBER") }))
    .mutation(async ({ ctx, input }) => {
      if (input.role === "OWNER" && ctx.role !== "OWNER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can invite owners." });
      }
      const already = await ctx.db.orgMember.findFirst({ where: { orgId: ctx.org.id, user: { email: input.email } } });
      if (already) throw new TRPCError({ code: "CONFLICT", message: "They're already in this organization." });

      const token = randomToken();
      // A fresh invite replaces any earlier pending one for the same person.
      await ctx.db.orgInvite.deleteMany({ where: { orgId: ctx.org.id, email: input.email, acceptedAt: null } });
      await ctx.db.orgInvite.create({
        data: {
          orgId: ctx.org.id,
          email: input.email,
          role: input.role,
          tokenHash: sha256(token),
          invitedById: ctx.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      const link = `${env.APP_URL}/invite/${token}`;
      let emailed = true;
      try {
        await sendMail(inviteMessage(input.email, ctx.user.name, ctx.org.name, link));
      } catch (error) {
        // The invite still works: the admin can share the link by hand.
        console.error("[invite] email failed", error);
        emailed = false;
      }
      return { emailed, link, email: input.email };
    }),

  revokeInvite: adminProcedure.input(z.object({ inviteId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.orgInvite.deleteMany({ where: { id: input.inviteId, orgId: ctx.org.id } });
    return { revoked: true };
  }),

  /** Public: the invite page shows this before anyone signs in. */
  inviteInfo: publicProcedure.input(z.object({ token: z.string() })).query(async ({ ctx, input }) => {
    const invite = await ctx.db.orgInvite.findUnique({
      where: { tokenHash: sha256(input.token) },
      include: { org: { select: { name: true } }, invitedBy: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new TRPCError({ code: "NOT_FOUND", message: "This invite has expired or was already used." });
    }
    const account = await ctx.db.user.findUnique({
      where: { email: invite.email },
      select: { emailVerified: true },
    });
    const signedIn = ctx.userId
      ? await ctx.db.user.findUnique({ where: { id: ctx.userId }, select: { email: true } })
      : null;
    return {
      orgName: invite.org.name,
      invitedBy: invite.invitedBy.name,
      email: invite.email,
      role: invite.role,
      hasAccount: Boolean(account?.emailVerified),
      signedInEmail: signedIn?.email ?? null,
    };
  }),

  acceptInvite: protectedProcedure.input(z.object({ token: z.string() })).mutation(async ({ ctx, input }) => {
    const invite = await findOpenInvite(input.token);
    if (invite.email !== ctx.user.email) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This invite is for ${invite.email}. Sign in with that email.`,
      });
    }
    await acceptInviteFor(invite.id, invite.orgId, invite.role, ctx.user.id);
    return { orgId: invite.orgId };
  }),

  updateMember: adminProcedure
    .input(z.object({ memberId: z.string(), role: roleSchema.optional(), title: z.string().max(60).nullish() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.orgMember.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      if ((member.role === "OWNER" || input.role === "OWNER") && ctx.role !== "OWNER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can change owners." });
      }
      if (member.role === "OWNER" && input.role && input.role !== "OWNER") {
        const owners = await ctx.db.orgMember.count({ where: { orgId: ctx.org.id, role: "OWNER" } });
        if (owners <= 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Every org needs at least one owner." });
      }
      return ctx.db.orgMember.update({
        where: { id: member.id },
        data: { role: input.role, title: input.title ?? undefined },
      });
    }),

  removeMember: orgProcedure.input(z.object({ memberId: z.string() })).mutation(async ({ ctx, input }) => {
    const member = await ctx.db.orgMember.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } });
    if (!member) throw new TRPCError({ code: "NOT_FOUND" });
    const leavingSelf = member.userId === ctx.user.id;
    if (!leavingSelf && !hasRole(ctx.role, "ADMIN")) throw new TRPCError({ code: "FORBIDDEN" });
    if (member.role === "OWNER") {
      const owners = await ctx.db.orgMember.count({ where: { orgId: ctx.org.id, role: "OWNER" } });
      if (owners <= 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Hand ownership to someone else first." });
    }
    await ctx.db.$transaction([
      ctx.db.teamMember.deleteMany({ where: { userId: member.userId, team: { orgId: ctx.org.id } } }),
      ctx.db.orgMember.delete({ where: { id: member.id } }),
      ctx.db.user.updateMany({ where: { id: member.userId, activeOrgId: ctx.org.id }, data: { activeOrgId: null } }),
    ]);
    return { removed: true };
  }),
});
