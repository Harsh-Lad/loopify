import "server-only";
import { cron } from "inngest";
import { dayKeyToDate, localDayKey, localHour } from "@/lib/dates";
import { db } from "@/server/db";
import { captureCreated, dayClosed, inngest } from "@/server/inngest/client";
import { processCapture } from "@/server/services/capture";
import { generateDaySummary } from "@/server/services/day";

export const processCaptureFn = inngest.createFunction(
  { id: "process-capture", retries: 2, triggers: [captureCreated] },
  async ({ event, step }) => {
    await step.run("extract-action-items", () => processCapture(event.data.captureId));
    return { captureId: event.data.captureId };
  },
);

export const daySummaryFn = inngest.createFunction(
  { id: "day-summary", retries: 2, triggers: [dayClosed] },
  async ({ event, step }) => {
    await step.run("write-summary", () => generateDaySummary(event.data.dayPlanId));
  },
);

/**
 * Hourly sweep. For every user whose local time is 23:00 to 23:59, writes an
 * end-of-day summary for today's plan if they did not close the day themselves.
 */
export const nightlySummariesFn = inngest.createFunction(
  { id: "nightly-summaries", triggers: [cron("5 * * * *")] },
  async ({ step }) => {
    const plans = await step.run("find-open-days", async () => {
      const candidates = await db.dayPlan.findMany({
        where: {
          summaryGeneratedAt: null,
          date: { gte: dayKeyToDate(localDayKey("UTC", new Date(Date.now() - 36e5 * 36))) },
        },
        select: { id: true, date: true, user: { select: { timezone: true } } },
      });
      return candidates
        .filter(
          (p) =>
            localHour(p.user.timezone) === 23 && localDayKey(p.user.timezone) === p.date.toISOString().slice(0, 10),
        )
        .map((p) => p.id);
    });

    for (const id of plans) {
      await step.run(`summary-${id}`, () => generateDaySummary(id));
    }
    return { summarised: plans.length };
  },
);

export const functions = [processCaptureFn, daySummaryFn, nightlySummariesFn];
