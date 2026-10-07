import "server-only";
import { TRPCError } from "@trpc/server";
import { sha256 } from "@/server/crypto";
import { db } from "@/server/db";

/** Finds a usable invite by its raw token, or throws a friendly error. */
export async function findOpenInvite(token: string) {
  const invite = await db.orgInvite.findUnique({
    where: { tokenHash: sha256(token) },
    include: { org: { select: { id: true, name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new TRPCError({ code: "NOT_FOUND", message: "This invite has expired or was already used." });
  }
  return invite;
}

/** Adds the user to the invite's org, marks the invite used and makes that org their active one. */
export async function acceptInviteFor(
  inviteId: string,
  orgId: string,
  role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER",
  userId: string,
) {
  await db.$transaction([
    db.orgMember.upsert({
      where: { orgId_userId: { orgId, userId } },
      create: { orgId, userId, role },
      update: {},
    }),
    db.orgInvite.update({ where: { id: inviteId }, data: { acceptedAt: new Date() } }),
    db.user.update({ where: { id: userId }, data: { activeOrgId: orgId } }),
  ]);
}
