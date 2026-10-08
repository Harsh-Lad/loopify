import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { between } from "@/server/services/boards";
import { recordEvent } from "@/server/services/events";
import { autoMirrorOnAssign } from "@/server/services/personal";
import { prisma } from "./db";
import type { ActionItem } from "./extract";

type Tx = Prisma.TransactionClient;
type Job = { id: string; orgId: string; teamId: string | null; createdById: string; title: string | null };

const firstName = (name: string) => name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

/** item.due is a calendar day; the card is due at 18:00 India time that day. */
const dueAt = (day: string | null) => (day ? new Date(`${day}T18:00:00+05:30`) : null);

/**
 * Org member for a spoken owner name: an exact full-name match, else the only
 * member with that first name. Two people sharing a first name stay unassigned.
 */
function matchOwner(owner: string | null, members: { id: string; name: string }[]) {
  if (!owner) return null;
  const exact = members.find((m) => m.name.trim().toLowerCase() === owner.trim().toLowerCase());
  if (exact) return exact.id;
  const byFirst = members.filter((m) => firstName(m.name) === firstName(owner));
  return byFirst.length === 1 ? byFirst[0]!.id : null;
}

/** The team board a meeting item lands on: the team its topic names, else the meeting's team, else the first team. */
async function boardsByTeam(tx: Tx, orgId: string) {
  const teams = await tx.team.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      boards: {
        where: { archivedAt: null, ownerId: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, columns: { orderBy: { position: "asc" }, select: { id: true, name: true, category: true } } },
      },
    },
  });
  return teams.filter((t) => t.boards.length > 0).map((t) => ({ ...t, board: t.boards[0]! }));
}

/** The "To do" column, else the first not-started column, else the first column. */
function todoColumn(columns: { id: string; name: string; category: string }[]) {
  return (
    columns.find((c) => c.name.trim().toLowerCase() === "to do") ??
    columns.find((c) => c.category === "TODO") ??
    columns[0] ??
    null
  );
}

/**
 * Turns a processed meeting's action items into cards at the top of the matching
 * team board's To do column. Runs once per job: a second call is a no-op.
 */
export async function createCardsFromMeeting(job: Job, items: ActionItem[]): Promise<void> {
  if (!items.length) return;

  const created = await prisma.$transaction(
    async (tx) => {
      const teams = await boardsByTeam(tx, job.orgId);
      const fallback = teams.find((t) => t.id === job.teamId) ?? teams[0];
      if (!fallback) {
        console.warn(`[meeting-bot] org ${job.orgId} has no team board; ${items.length} items left on job ${job.id}`);
        return [];
      }

      // Claim the job. A concurrent call blocks on this row, then sees it taken.
      const { count } = await tx.meetingJob.updateMany({
        where: { id: job.id, cardsCreatedAt: null },
        data: { cardsCreatedAt: new Date() },
      });
      if (count === 0) return [];

      const members = await tx.orgMember.findMany({
        where: { orgId: job.orgId },
        select: { user: { select: { id: true, name: true } } },
      });
      const people = members.map((m) => m.user);

      const out: { id: string; title: string; boardId: string; assigneeId: string | null }[] = [];
      // Each card goes on top, so walk backwards to keep the meeting's order top to bottom.
      for (const item of [...items].reverse()) {
        const topic = item.team === "other" ? null : item.team;
        const team =
          (topic && teams.find((t) => t.slug.toLowerCase().includes(topic) || t.name.toLowerCase().includes(topic))) ||
          fallback;
        const column = todoColumn(team.board.columns);
        if (!column) continue;

        const top = await tx.card.findFirst({
          where: { columnId: column.id },
          orderBy: { position: "asc" },
          select: { position: true },
        });
        const { cardSeq } = await tx.board.update({
          where: { id: team.board.id },
          data: { cardSeq: { increment: 1 } },
        });
        const assigneeId = matchOwner(item.owner, people);

        const card = await tx.card.create({
          data: {
            orgId: job.orgId,
            boardId: team.board.id,
            columnId: column.id,
            number: cardSeq,
            title: item.title.slice(0, 200),
            descriptionText: [`"${item.quote}"`, `From meeting: ${job.title ?? "Untitled meeting"}`].join("\n\n"),
            assigneeId,
            reporterId: job.createdById,
            dueDate: dueAt(item.due),
            position: between(null, top?.position),
            labels: topic ? [topic] : [],
            source: "MEETING",
            meetingJobId: job.id,
          },
        });
        await autoMirrorOnAssign(tx, card);
        await recordEvent(tx, {
          orgId: job.orgId,
          boardId: team.board.id,
          cardId: card.id,
          actorId: job.createdById,
          type: "CREATED",
          toColumnId: column.id,
          payload: { title: card.title, source: "meeting" },
        });
        out.push({ id: card.id, title: card.title, boardId: team.board.id, assigneeId });
      }
      return out;
    },
    { timeout: 30_000 },
  );

  const notify = created.filter((c) => c.assigneeId && c.assigneeId !== job.createdById);
  if (notify.length) {
    await prisma.notification
      .createMany({
        data: notify.map((c) => ({
          orgId: job.orgId,
          userId: c.assigneeId!,
          type: "assigned",
          title: `From "${job.title ?? "a meeting"}": ${c.title}`,
          link: `/boards/${c.boardId}?card=${c.id}`,
        })),
      })
      .catch(() => undefined);
  }
}
