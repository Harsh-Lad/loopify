import { NextResponse } from "next/server";
import { createCardsFromMeeting } from "@/server/meeting-bot/cards";
import { prisma } from "@/server/meeting-bot/db";
import { extractMeeting, type Utterance } from "@/server/meeting-bot/extract";
import { isRunner } from "@/server/meeting-bot/runner-auth";

export const maxDuration = 60; // Grok extraction for a long call can take 20-40 s

type Body = {
  durationSec: number;
  language: string | null;
  endReason: string;
  text: string;
  utterances: Utterance[];
};

/** Runner posts the finished transcript. We extract action items and create cards. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isRunner(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Body;

  const job = await prisma.meetingJob.update({
    where: { id },
    data: {
      status: "EXTRACTING",
      durationSec: body.durationSec,
      language: body.language,
      transcript: body.utterances,
    },
  });

  if (!body.utterances.length) {
    await prisma.meetingJob.update({
      where: { id },
      data: { status: "DONE", result: { title: job.title ?? "", summary: "", decisions: [], actionItems: [], translations: [] } },
    });
    return NextResponse.json({ ok: true, actionItems: 0 });
  }

  try {
    const result = await extractMeeting({
      orgId: job.orgId,
      title: job.title,
      attendees: job.attendees,
      meetingDate: job.startAt,
      utterances: body.utterances,
    });
    await prisma.meetingJob.update({ where: { id }, data: { status: "DONE", result } });
    await createCardsFromMeeting(job, result.actionItems);
    return NextResponse.json({ ok: true, actionItems: result.actionItems.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // The transcript is already saved, so extraction can be re-run later without re-recording.
    await prisma.meetingJob.update({ where: { id }, data: { status: "FAILED", error: `Extraction: ${message}`.slice(0, 500) } });
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
