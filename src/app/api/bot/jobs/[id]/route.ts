import { NextResponse } from "next/server";
import { prisma } from "@/server/meeting-bot/db";
import { isRunner } from "@/server/meeting-bot/runner-auth";


const RUNNER_STATUSES = ["JOINING", "WAITING_ADMIT", "RECORDING", "TRANSCRIBING", "FAILED"] as const;
type RunnerStatus = (typeof RUNNER_STATUSES)[number];

/** Status update + heartbeat. Responds with { cancel } so the bot can leave when asked. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isRunner(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string; error?: string };

  if (!RUNNER_STATUSES.includes(body.status as RunnerStatus)) {
    return NextResponse.json({ error: "unknown status" }, { status: 400 });
  }
  const job = await prisma.meetingJob.findUnique({ where: { id }, select: { cancelRequested: true, status: true } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (job.status === "DONE") return NextResponse.json({ cancel: true });

  await prisma.meetingJob.update({
    where: { id },
    data: { status: body.status as RunnerStatus, error: body.error?.slice(0, 500) ?? null },
  });
  return NextResponse.json({ cancel: job.cancelRequested });
}
