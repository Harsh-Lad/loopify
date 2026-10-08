import "server-only";
import { adminRouter } from "@/server/trpc/routers/admin";
import { authRouter } from "@/server/trpc/routers/auth";
import { boardRouter } from "@/server/trpc/routers/board";
import { captureRouter } from "@/server/trpc/routers/capture";
import { cardRouter } from "@/server/trpc/routers/card";
import { dayRouter } from "@/server/trpc/routers/day";
import { insightsRouter } from "@/server/trpc/routers/insights";
import { integrationRouter } from "@/server/trpc/routers/integration";
import { meRouter } from "@/server/trpc/routers/me";
import { meetingBotRouter } from "@/server/trpc/routers/meeting-bot";
import { notificationRouter } from "@/server/trpc/routers/notification";
import { orgRouter } from "@/server/trpc/routers/org";
import { reportRouter } from "@/server/trpc/routers/report";
import { sheetsRouter } from "@/server/trpc/routers/sheets";
import { teamRouter } from "@/server/trpc/routers/team";
import { templateRouter } from "@/server/trpc/routers/template";
import { createCallerFactory, createTRPCRouter } from "@/server/trpc/init";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  me: meRouter,
  org: orgRouter,
  team: teamRouter,
  template: templateRouter,
  board: boardRouter,
  card: cardRouter,
  day: dayRouter,
  capture: captureRouter,
  meetingBot: meetingBotRouter,
  report: reportRouter,
  insights: insightsRouter,
  admin: adminRouter,
  sheets: sheetsRouter,
  integration: integrationRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
