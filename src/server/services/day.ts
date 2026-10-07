import "server-only";
import { addDays, dayKeyToDate, localDayBounds, localDayKey } from "@/lib/dates";
import { getAi, isAiConfigured } from "@/server/ai";
import { db } from "@/server/db";

export async function getOrCreateDayPlan(orgId: string, userId: string, dayKey: string) {
  const date = dayKeyToDate(dayKey);
  return db.dayPlan.upsert({
    where: { orgId_userId_date: { orgId, userId, date } },
    create: { orgId, userId, date },
    update: {},
  });
}

/** What a person actually did in a local day, read from the event log. */
export async function dayActivity(orgId: string, userId: string, timeZone: string, dayKey: string) {
  const { start, end } = localDayBounds(timeZone, dayKey);
  const events = await db.cardEvent.findMany({
    where: { orgId, actorId: userId, createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      createdAt: true,
      payload: true,
      card: { select: { id: true, number: true, title: true, board: { select: { key: true } } } },
    },
  });

  const completed = new Map<string, (typeof events)[number]["card"]>();
  for (const event of events) {
    if (event.type === "COMPLETED") completed.set(event.card.id, event.card);
    if (event.type === "REOPENED") completed.delete(event.card.id);
  }

  return {
    events,
    completed: [...completed.values()],
    counts: {
      created: events.filter((e) => e.type === "CREATED").length,
      moved: events.filter((e) => e.type === "MOVED").length,
      completed: completed.size,
      commented: events.filter((e) => e.type === "COMMENTED").length,
    },
  };
}

/**
 * Yesterday's leftovers: planned items that were not done, still open, and not
 * already carried into today.
 */
export async function pendingFromYesterday(orgId: string, userId: string, timeZone: string) {
  const todayKey = localDayKey(timeZone);
  const yesterday = await db.dayPlan.findFirst({
    where: { orgId, userId, date: { lt: dayKeyToDate(todayKey) } },
    orderBy: { date: "desc" },
    include: {
      items: {
        where: { status: "PLANNED", card: { completedAt: null, archivedAt: null } },
        orderBy: { position: "asc" },
        include: { card: { include: { column: true, board: { select: { id: true, key: true, name: true } } } } },
      },
    },
  });
  return yesterday;
}

export async function generateDaySummary(dayPlanId: string) {
  const plan = await db.dayPlan.findUniqueOrThrow({
    where: { id: dayPlanId },
    include: {
      user: { select: { name: true, timezone: true } },
      items: { include: { card: { select: { title: true, completedAt: true } } } },
    },
  });

  const key = plan.date.toISOString().slice(0, 10);
  const activity = await dayActivity(plan.orgId, plan.userId, plan.user.timezone, key);
  const done = activity.completed.map((c) => c.title);
  const left = plan.items.filter((i) => !i.card.completedAt).map((i) => i.card.title);

  let summary: string;
  if (isAiConfigured()) {
    const ai = await getAi(plan.orgId);
    const reply = await ai.chat({
      temperature: 0.5,
      maxTokens: 400,
      messages: [
        {
          role: "system",
          content:
            "Write a short end-of-day standup in plain, friendly English. Three short sections with these exact headings: Done, Left for tomorrow, Notes. Use '-' bullets. No fluff, no emojis, no em dashes. If a section is empty, write '- Nothing'.",
        },
        {
          role: "user",
          content: JSON.stringify({
            person: plan.user.name,
            done,
            left,
            diary: plan.noteText?.slice(0, 4000) ?? "",
            mood: plan.mood,
          }),
        },
      ],
    });
    summary = reply.content?.trim() || "";
  } else {
    const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- Nothing");
    summary = `Done\n${list(done)}\n\nLeft for tomorrow\n${list(left)}\n\nNotes\n${plan.noteText?.trim() ? `- ${plan.noteText.trim().slice(0, 300)}` : "- Nothing"}`;
  }

  await db.dayPlan.update({
    where: { id: dayPlanId },
    data: { summary, summaryGeneratedAt: new Date() },
  });

  return summary;
}

export { addDays };
