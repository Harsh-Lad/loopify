import "server-only";
import { eventType, Inngest } from "inngest";
import { z } from "zod";
import { env } from "@/server/env";

export const inngest = new Inngest({
  id: "loopify",
  isDev: env.NODE_ENV !== "production",
  eventKey: env.INNGEST_EVENT_KEY,
});

export const captureCreated = eventType("capture/created", {
  schema: z.object({ captureId: z.string() }),
});

export const dayClosed = eventType("day/closed", {
  schema: z.object({ dayPlanId: z.string() }),
});
