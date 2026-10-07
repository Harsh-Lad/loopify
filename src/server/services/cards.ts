import "server-only";
import type { Card, Prisma } from "@/generated/prisma/client";
import { dayKeyToDate, localDayKey } from "@/lib/dates";
import { recordEvent, type EventInput } from "@/server/services/events";
import { endOfMixedColumn, syncMirrorsForStatus } from "@/server/services/personal";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; timezone: string };

/**
 * Moves a card to a column and position, keeping completion state, today's
 * plan and the event log in step with the move.
 */
export async function moveCard(tx: Tx, actor: Actor, card: Card, columnId: string, position: number) {
  const [from, to] = await Promise.all([
    tx.boardColumn.findUniqueOrThrow({ where: { id: card.columnId } }),
    tx.boardColumn.findFirstOrThrow({ where: { id: columnId, boardId: card.boardId } }),
  ]);

  const nowDone = to.category === "DONE";
  const wasDone = card.completedAt !== null;

  const updated = await tx.card.update({
    where: { id: card.id },
    data: {
      columnId: to.id,
      position,
      completedAt: nowDone ? (card.completedAt ?? new Date()) : null,
    },
  });

  const base: Omit<EventInput, "type"> = {
    orgId: card.orgId,
    boardId: card.boardId,
    cardId: card.id,
    actorId: actor.id,
  };

  if (from.id !== to.id) {
    await recordEvent(tx, {
      ...base,
      type: "MOVED",
      fromColumnId: from.id,
      toColumnId: to.id,
      payload: { from: from.name, to: to.name },
    });
  }

  if (nowDone && !wasDone) {
    await recordEvent(tx, { ...base, type: "COMPLETED", toColumnId: to.id });
    await setTodayItemStatus(tx, actor, card, "DONE");
    await syncMirrorsForStatus(tx, card, true);
  } else if (!nowDone && wasDone) {
    await recordEvent(tx, { ...base, type: "REOPENED", toColumnId: to.id });
    await setTodayItemStatus(tx, actor, card, "PLANNED");
    await syncMirrorsForStatus(tx, card, false);
  }

  return updated;
}

async function setTodayItemStatus(tx: Tx, actor: Actor, card: Card, status: "DONE" | "PLANNED") {
  const date = dayKeyToDate(localDayKey(actor.timezone));
  await tx.dayPlanItem.updateMany({
    where: {
      cardId: card.id,
      status: status === "DONE" ? "PLANNED" : "DONE",
      dayPlan: { orgId: card.orgId, date },
    },
    data: { status },
  });
}

/** Where a re-opened card goes: the column it came from before done, else the first open column. */
export async function reopenTarget(tx: Tx, card: Card) {
  const lastMove = await tx.cardEvent.findFirst({
    where: { cardId: card.id, type: "MOVED", toColumnId: card.columnId },
    orderBy: { createdAt: "desc" },
  });
  if (lastMove?.fromColumnId) {
    const column = await tx.boardColumn.findFirst({
      where: { id: lastMove.fromColumnId, boardId: card.boardId, category: { not: "DONE" } },
    });
    if (column) return column;
  }
  return tx.boardColumn.findFirstOrThrow({
    where: { boardId: card.boardId, category: { not: "DONE" } },
    orderBy: [{ category: "desc" }, { position: "asc" }],
  });
}

/** Bottom of a column. Personal columns also hold mirrors, so both count. */
export function endOfColumn(tx: Tx, columnId: string) {
  return endOfMixedColumn(tx, columnId);
}
