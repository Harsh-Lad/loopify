import "server-only";
import { after } from "next/server";
import { env } from "@/server/env";
import { dayClosed, inngest } from "@/server/inngest/client";
import { processCapture } from "@/server/services/capture";
import { generateDaySummary } from "@/server/services/day";

/**
 * Sends background work to Inngest. In development, when the Inngest dev
 * server is not running, the job runs inline instead so nothing silently stalls.
 */
async function sendOrRun(send: () => Promise<unknown>, inline: () => Promise<unknown>) {
  try {
    await send();
  } catch (error) {
    if (env.NODE_ENV === "production") throw error;
    console.warn("[inngest] dev server not reachable, running job inline");
    await inline().catch((e) => console.error("[inngest:inline]", e));
  }
}

/**
 * Captures are processed on this server right after the response is sent
 * (`after`), not through the Inngest queue: if Inngest isn't synced with the
 * deployment, queued captures would sit at PENDING forever. Processing claims
 * the capture first, so a retry or a second worker never doubles the work.
 */
export function dispatchCaptureCreated(captureId: string) {
  after(() => processCapture(captureId).catch((e) => console.error("[capture] processing failed", captureId, e)));
  return Promise.resolve();
}

export function dispatchDayClosed(dayPlanId: string) {
  return sendOrRun(
    () => inngest.send(dayClosed.create({ dayPlanId })),
    () => generateDaySummary(dayPlanId),
  );
}
