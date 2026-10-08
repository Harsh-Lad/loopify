import { prisma } from "./db";

const MEET_URL = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?.*)?$/i;

export type QueueInput = {
  orgId: string;
  teamId?: string | null;
  createdById: string;
  meetUrl: string;
  title?: string | null;
  attendees?: string[];
  keyterms?: string[];
  startAt?: Date; // defaults to now (join immediately)
};

/** Call from your tRPC router ("Send Loop bot") or from calendar sync. */
export async function queueMeetingBot(input: QueueInput) {
  const meetUrl = input.meetUrl.trim();
  if (!MEET_URL.test(meetUrl)) throw new Error("Paste a Google Meet link like https://meet.google.com/abc-defg-hij");

  // Don't send two bots to the same call.
  const existing = await prisma.meetingJob.findFirst({
    where: {
      orgId: input.orgId,
      meetUrl,
      status: { in: ["QUEUED", "CLAIMED", "JOINING", "WAITING_ADMIT", "RECORDING"] },
    },
  });
  if (existing) return existing;

  return prisma.meetingJob.create({
    data: {
      orgId: input.orgId,
      teamId: input.teamId ?? null,
      createdById: input.createdById,
      meetUrl,
      title: input.title ?? null,
      attendees: input.attendees ?? [],
      keyterms: input.keyterms ?? [],
      startAt: input.startAt ?? new Date(),
    },
  });
}

/** "Make the bot leave". The runner sees this on its next heartbeat (within 30 s). */
export async function cancelMeetingBot(id: string, orgId: string) {
  await prisma.meetingJob.updateMany({ where: { id, orgId }, data: { cancelRequested: true } });
}
