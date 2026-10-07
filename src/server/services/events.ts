import "server-only";
import type { CardEventType, Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type EventInput = {
  orgId: string;
  boardId: string;
  cardId: string;
  actorId: string;
  type: CardEventType;
  fromColumnId?: string | null;
  toColumnId?: string | null;
  payload?: Prisma.InputJsonValue;
};

/**
 * Appends to the card event log. Call inside the same transaction as the
 * change it describes, so the log can never disagree with the data.
 */
export function recordEvent(tx: Tx, event: EventInput) {
  return tx.cardEvent.create({
    data: {
      orgId: event.orgId,
      boardId: event.boardId,
      cardId: event.cardId,
      actorId: event.actorId,
      type: event.type,
      fromColumnId: event.fromColumnId ?? null,
      toColumnId: event.toColumnId ?? null,
      payload: event.payload ?? {},
    },
  });
}

export function recordEvents(tx: Tx, events: EventInput[]) {
  if (!events.length) return Promise.resolve({ count: 0 });
  return tx.cardEvent.createMany({
    data: events.map((event) => ({
      orgId: event.orgId,
      boardId: event.boardId,
      cardId: event.cardId,
      actorId: event.actorId,
      type: event.type,
      fromColumnId: event.fromColumnId ?? null,
      toColumnId: event.toColumnId ?? null,
      payload: event.payload ?? {},
    })),
  });
}
