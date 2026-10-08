import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { MeetingResult, Utterance } from "@/server/meeting-bot/extract";
import { cancelMeetingBot, queueMeetingBot } from "@/server/meeting-bot/queue";
import { createTRPCRouter, orgProcedure } from "@/server/trpc/init";

export const meetingBotRouter = createTRPCRouter({
  /** Sends the Loop bot into a Google Meet now. Attendees are the team's members, so owners resolve to real people. */
  sendBot: orgProcedure
    .input(
      z.object({
        meetUrl: z.string().trim().min(1, "Paste a Google Meet link"),
        title: z.string().trim().max(120).optional(),
        /** Defaults to the first team you're on. */
        teamId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = input.teamId
        ? await ctx.db.team.findFirst({ where: { id: input.teamId, orgId: ctx.org.id }, select: { id: true } })
        : await ctx.db.team.findFirst({
            where: { orgId: ctx.org.id, members: { some: { userId: ctx.user.id } } },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          });
      if (input.teamId && !team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });

      const people = team
        ? await ctx.db.teamMember.findMany({ where: { teamId: team.id }, select: { user: { select: { name: true } } } })
        : await ctx.db.orgMember.findMany({ where: { orgId: ctx.org.id }, select: { user: { select: { name: true } } } });

      try {
        const job = await queueMeetingBot({
          orgId: ctx.org.id,
          teamId: team?.id ?? null,
          createdById: ctx.user.id,
          meetUrl: input.meetUrl,
          title: input.title || null,
          attendees: people.map((p) => p.user.name),
          keyterms: [],
        });
        return { id: job.id, status: job.status };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Couldn't send the bot.",
        });
      }
    }),

  /** Asks the bot to leave. It notices on its next heartbeat, within about 30 s. */
  cancelBot: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await cancelMeetingBot(input.id, ctx.org.id);
    return { cancelled: true };
  }),

  listJobs: orgProcedure.query(async ({ ctx }) => {
    const jobs = await ctx.db.meetingJob.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        title: true,
        meetUrl: true,
        createdAt: true,
        durationSec: true,
        cancelRequested: true,
        error: true,
        result: true,
      },
    });
    return jobs.map(({ result, ...job }) => ({
      ...job,
      actionItemCount: (result as MeetingResult | null)?.actionItems?.length ?? 0,
    }));
  }),

  /** A finished meeting: notes, action items and the transcript. */
  getJob: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const job = await ctx.db.meetingJob.findFirst({
      where: { id: input.id, orgId: ctx.org.id },
      select: { id: true, title: true, status: true, createdAt: true, durationSec: true, transcript: true, result: true },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found." });
    return {
      ...job,
      transcript: (job.transcript as Utterance[] | null) ?? [],
      result: job.result as MeetingResult | null,
    };
  }),
});
