import { NextResponse } from "next/server";
import { prisma } from "@/server/meeting-bot/db";
import { isRunner } from "@/server/meeting-bot/runner-auth";


/** Runner polls this. Atomically hands out the next meeting starting within 2 minutes. */
export async function POST(req: Request) {
  if (!isRunner(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const runnerId = new URL(req.url).searchParams.get("runner") ?? "runner";

  // A runner that went silent for 30 minutes (crash, PC off) won't come back for that job.
  await prisma.meetingJob.updateMany({
    where: {
      status: { in: ["CLAIMED", "JOINING", "WAITING_ADMIT", "RECORDING", "TRANSCRIBING"] },
      updatedAt: { lt: new Date(Date.now() - 30 * 60_000) },
    },
    data: { status: "FAILED", error: "The bot stopped responding" },
  });

  const soon = new Date(Date.now() + 2 * 60_000);
  for (let i = 0; i < 3; i++) {
    const job = await prisma.meetingJob.findFirst({
      where: { status: "QUEUED", cancelRequested: false, startAt: { lte: soon } },
      orderBy: { startAt: "asc" },
    });
    if (!job) break;
    const { count } = await prisma.meetingJob.updateMany({
      where: { id: job.id, status: "QUEUED" },
      data: { status: "CLAIMED", runnerId },
    });
    if (count === 1) {
      return NextResponse.json({
        id: job.id,
        meetUrl: job.meetUrl,
        title: job.title,
        attendees: job.attendees,
        keyterms: job.keyterms,
      });
    }
  }
  return new NextResponse(null, { status: 204 });
}
