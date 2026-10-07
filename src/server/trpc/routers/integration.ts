import { z } from "zod";
import { isAiConfigured } from "@/server/ai";
import { env } from "@/server/env";
import { isGoogleConfigured } from "@/server/google/oauth";
import { signConnectTicket } from "@/server/google/oauth-state";
import { createTRPCRouter, orgProcedure } from "@/server/trpc/init";

export const integrationRouter = createTRPCRouter({
  list: orgProcedure.query(async ({ ctx }) => {
    const integrations = await ctx.db.integration.findMany({
      where: { orgId: ctx.org.id, userId: ctx.user.id },
      select: { provider: true, accountEmail: true, createdAt: true, scopes: true },
    });
    return {
      ai: { configured: isAiConfigured() },
      google: {
        configured: isGoogleConfigured(),
        connection: integrations.find((i) => i.provider === "GOOGLE") ?? null,
      },
    };
  }),

  /** For the mobile app: a URL to open in an auth browser that connects Google, then returns to `returnTo`. */
  googleConnectUrl: orgProcedure
    .input(z.object({ returnTo: z.string().regex(/^anton:\/\/[\w/?=&.-]*$/, "Unsupported return link") }))
    .query(async ({ ctx, input }) => {
      const ticket = await signConnectTicket(ctx.user.id);
      const url = new URL("/api/integrations/google/connect", env.APP_URL);
      url.searchParams.set("ticket", ticket);
      url.searchParams.set("returnTo", input.returnTo);
      return { url: url.toString() };
    }),

  disconnect: orgProcedure.input(z.object({ provider: z.enum(["GOOGLE"]) })).mutation(async ({ ctx, input }) => {
    await ctx.db.integration.deleteMany({
      where: { orgId: ctx.org.id, userId: ctx.user.id, provider: input.provider },
    });
    return { disconnected: true };
  }),
});
