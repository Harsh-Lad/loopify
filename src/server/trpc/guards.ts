import "server-only";
import { TRPCError } from "@trpc/server";
import type { OrgRole, Prisma, PrismaClient } from "@/generated/prisma/client";
import { hasRole } from "@/server/trpc/init";

type Ctx = { db: PrismaClient; org: { id: string }; user: { id: string }; role: OrgRole };

/**
 * Team boards plus your own personal board. Personal boards are private: not
 * even admins or managers see someone else's, in boards, search or reports.
 */
export function visibleBoards(ctx: { user: { id: string } }): Prisma.BoardWhereInput {
  return { OR: [{ ownerId: null }, { ownerId: ctx.user.id }] };
}

export async function getBoardOrThrow(ctx: Ctx, boardId: string) {
  const board = await ctx.db.board.findFirst({ where: { id: boardId, orgId: ctx.org.id, ...visibleBoards(ctx) } });
  if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });
  return board;
}

export async function getCardOrThrow(ctx: Ctx, cardId: string) {
  const card = await ctx.db.card.findFirst({ where: { id: cardId, orgId: ctx.org.id, board: visibleBoards(ctx) } });
  if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found." });
  return card;
}

/** Org managers and above, or the lead of the team that owns the board. */
export async function assertCanManageTeam(ctx: Ctx, teamId: string) {
  if (hasRole(ctx.role, "MANAGER")) return;
  const lead = await ctx.db.teamMember.findFirst({ where: { teamId, userId: ctx.user.id, role: "LEAD" } });
  if (!lead) throw new TRPCError({ code: "FORBIDDEN", message: "Only team leads and managers can change this." });
}

/** A personal board is managed by its owner alone; a team board by its leads and managers. */
export async function assertCanManageBoard(ctx: Ctx, board: { teamId: string | null; ownerId: string | null }) {
  if (board.ownerId) {
    if (board.ownerId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });
    return;
  }
  await assertCanManageTeam(ctx, board.teamId!);
}

export async function assertOrgUser(ctx: Ctx, userId: string) {
  const member = await ctx.db.orgMember.findUnique({ where: { orgId_userId: { orgId: ctx.org.id, userId } } });
  if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "That person isn't in this organization." });
}

/** Cards on a personal board can only be assigned to its owner. */
export function assertAssignable(board: { ownerId: string | null }, assigneeId: string | null | undefined) {
  if (board.ownerId && assigneeId && assigneeId !== board.ownerId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Personal tasks can only be assigned to you." });
  }
}
