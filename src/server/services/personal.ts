import "server-only";
import type { Card, Prisma, StatusCategory } from "@/generated/prisma/client";
import { uniqueBoardKey } from "@/server/services/boards";
import { recordEvent } from "@/server/services/events";

type Tx = Prisma.TransactionClient;

/** The columns every personal board starts with. People can change them like any board. */
const PERSONAL_COLUMNS: { name: string; color: string; category: StatusCategory }[] = [
  { name: "Inbox", color: "slate", category: "TODO" },
  { name: "This week", color: "sky", category: "TODO" },
  { name: "Doing", color: "amber", category: "IN_PROGRESS" },
  { name: "Done", color: "green", category: "DONE" },
];

/** Finds or creates someone's private board in an org. */
export async function ensurePersonalBoard(tx: Tx, orgId: string, user: { id: string; name: string }) {
  const existing = await tx.board.findUnique({ where: { orgId_ownerId: { orgId, ownerId: user.id } } });
  if (existing) return existing;
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 3);
  return tx.board.create({
    data: {
      orgId,
      ownerId: user.id,
      name: "My board",
      key: await uniqueBoardKey(tx, orgId, "Me", `ME${initials}`),
      icon: "target",
      columns: {
        create: PERSONAL_COLUMNS.map((c, i) => ({ ...c, position: (i + 1) * 1000 })),
      },
    },
  });
}

/** The first column of a category on a board, falling back to the first column. */
async function columnFor(tx: Tx, boardId: string, category: StatusCategory) {
  return (
    (await tx.boardColumn.findFirst({ where: { boardId, category }, orderBy: { position: "asc" } })) ??
    tx.boardColumn.findFirstOrThrow({ where: { boardId }, orderBy: { position: "asc" } })
  );
}

/** Next free position at the bottom of a column, counting both cards and mirrors. */
export async function endOfMixedColumn(tx: Tx, columnId: string) {
  const [card, mirror] = await Promise.all([
    tx.card.findFirst({ where: { columnId }, orderBy: { position: "desc" }, select: { position: true } }),
    tx.cardMirror.findFirst({ where: { columnId }, orderBy: { position: "desc" }, select: { position: true } }),
  ]);
  return Math.max(card?.position ?? 0, mirror?.position ?? 0) + 1000;
}

async function statusOf(tx: Tx, card: Card): Promise<StatusCategory> {
  if (card.completedAt) return "DONE";
  const column = await tx.boardColumn.findUniqueOrThrow({ where: { id: card.columnId }, select: { category: true } });
  return column.category;
}

/** Puts a live mirror of a team card on someone's personal board. Idempotent. */
export async function mirrorCard(tx: Tx, user: { id: string; name: string }, card: Card) {
  const board = await ensurePersonalBoard(tx, card.orgId, user);
  if (card.boardId === board.id) return null; // already a personal card
  const existing = await tx.cardMirror.findUnique({ where: { userId_cardId: { userId: user.id, cardId: card.id } } });
  if (existing) return existing;
  const column = await columnFor(tx, board.id, await statusOf(tx, card));
  return tx.cardMirror.create({
    data: {
      orgId: card.orgId,
      userId: user.id,
      cardId: card.id,
      boardId: board.id,
      columnId: column.id,
      position: await endOfMixedColumn(tx, column.id),
    },
  });
}

/** An independent copy of a card on someone's personal board. */
export async function duplicateToPersonal(tx: Tx, user: { id: string; name: string }, card: Card) {
  const board = await ensurePersonalBoard(tx, card.orgId, user);
  const column = await columnFor(tx, board.id, "TODO");
  const { cardSeq } = await tx.board.update({ where: { id: board.id }, data: { cardSeq: { increment: 1 } } });
  const copy = await tx.card.create({
    data: {
      orgId: card.orgId,
      boardId: board.id,
      columnId: column.id,
      number: cardSeq,
      title: card.title,
      description: card.description ?? undefined,
      descriptionText: card.descriptionText,
      priority: card.priority,
      dueDate: card.dueDate,
      labels: card.labels,
      assigneeId: user.id,
      reporterId: user.id,
      position: await endOfMixedColumn(tx, column.id),
    },
  });
  await recordEvent(tx, {
    orgId: card.orgId,
    boardId: board.id,
    cardId: copy.id,
    actorId: user.id,
    type: "CREATED",
    payload: { duplicatedFrom: card.id },
  });
  return copy;
}

/**
 * Keeps mirrors in step when the real card is finished or reopened anywhere
 * (its own board, Today, the mobile app): they move to Done, or back out of it.
 */
export async function syncMirrorsForStatus(tx: Tx, card: Card, done: boolean) {
  const mirrors = await tx.cardMirror.findMany({ where: { cardId: card.id }, include: { column: true } });
  for (const mirror of mirrors) {
    if ((mirror.column.category === "DONE") === done) continue;
    const target = await columnFor(tx, mirror.boardId, done ? "DONE" : "TODO");
    await tx.cardMirror.update({
      where: { id: mirror.id },
      data: { columnId: target.id, position: await endOfMixedColumn(tx, target.id) },
    });
  }
}

/** For people who turned on auto-mirror: a card just assigned to them lands on their board too. */
export async function autoMirrorOnAssign(tx: Tx, card: Card) {
  if (!card.assigneeId) return;
  const member = await tx.orgMember.findUnique({
    where: { orgId_userId: { orgId: card.orgId, userId: card.assigneeId } },
    select: { autoMirror: true, user: { select: { id: true, name: true } } },
  });
  if (!member?.autoMirror) return;
  const board = await tx.board.findUnique({ where: { id: card.boardId }, select: { ownerId: true } });
  if (board?.ownerId) return;
  await mirrorCard(tx, member.user, card);
}
