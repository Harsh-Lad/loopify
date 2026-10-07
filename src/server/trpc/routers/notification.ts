import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "@/server/trpc/init";

export const notificationRouter = createTRPCRouter({
  list: orgProcedure.query(async ({ ctx }) => {
    const [items, unread] = await Promise.all([
      ctx.db.notification.findMany({
        where: { orgId: ctx.org.id, userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      ctx.db.notification.count({ where: { orgId: ctx.org.id, userId: ctx.user.id, readAt: null } }),
    ]);
    return { items, unread };
  }),

  markRead: orgProcedure.input(z.object({ ids: z.array(z.string()).optional() })).mutation(async ({ ctx, input }) => {
    await ctx.db.notification.updateMany({
      where: { orgId: ctx.org.id, userId: ctx.user.id, readAt: null, ...(input.ids ? { id: { in: input.ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }),
});
