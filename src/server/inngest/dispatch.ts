import "server-only";
import { env } from "@/server/env";
import { captureCreated, dayClosed, inngest } from "@/server/inngest/client";
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

export function dispatchCaptureCreated(captureId: string) {
  return sendOrRun(
    () => inngest.send(captureCreated.create({ captureId })),
    () => processCapture(captureId),
  );
}

export function dispatchDayClosed(dayPlanId: string) {
  return sendOrRun(
    () => inngest.send(dayClosed.create({ dayPlanId })),
    () => generateDaySummary(dayPlanId),
  );
}
