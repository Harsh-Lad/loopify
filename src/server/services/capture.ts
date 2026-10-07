import "server-only";
import { z } from "zod";
import type { Priority } from "@/generated/prisma/client";
import { localDayKey } from "@/lib/dates";
import { getAi, isAiConfigured, parseJsonReply } from "@/server/ai";
import { db } from "@/server/db";

const extractionSchema = z.object({
  title: z.string().max(120).optional(),
  suggestions: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).nullish(),
        assignee: z.string().nullish(),
        board: z.string().nullish(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
        priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).default("NONE"),
        confidence: z.number().min(0).max(1).default(0.6),
      }),
    )
    .max(25),
});

type Extraction = z.infer<typeof extractionSchema>;

const SYSTEM_PROMPT = `You turn everyday work conversations, notes and meeting transcripts into action items.
Return ONLY a JSON object: {"title": string, "suggestions": [{"title", "description", "assignee", "board", "dueDate", "priority", "confidence"}]}.
Rules:
- One suggestion per concrete, doable action. Skip chit-chat, opinions and things already done.
- "title" starts with a verb and is under 80 characters.
- "assignee" is the exact name from the provided member list, or null when nobody was clearly named. "me" or "I" means the speaker.
- "board" is the exact board key from the provided list when the topic clearly fits, else null.
- "dueDate" is YYYY-MM-DD resolved against today's date, or null when no date was said.
- "priority" is one of NONE, LOW, MEDIUM, HIGH, URGENT. Use HIGH or URGENT only when urgency was explicit.
- "confidence" is 0 to 1: how sure you are this is a real action item.
- "title" at the top level is a 3 to 6 word name for the whole conversation.`;

/** Works without an AI key: picks bullet points and action-sounding sentences. */
function heuristicExtract(text: string): Extraction {
  const actionWords =
    /\b(need to|needs to|will|should|must|todo|to-do|follow up|send|share|fix|review|prepare|update|schedule|book|create|finish)\b/i;
  const lines = text
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\s*([-*•]|\d+[.)]|\[ \])\s*/, "").trim())
    .filter((line) => line.length > 3 && line.length < 200);

  const picked = lines.filter((line) => actionWords.test(line)).slice(0, 15);

  return {
    title: (text.trim().split("\n")[0] ?? "")
      .replace(/[.:,-]+$/, "")
      .split(/\s+/)
      .slice(0, 6)
      .join(" "),
    suggestions: picked.map((line) => ({
      title: line.charAt(0).toUpperCase() + line.slice(1),
      description: null,
      assignee: null,
      board: null,
      dueDate: null,
      priority: "NONE" as const,
      confidence: 0.4,
    })),
  };
}

function matchMember(hint: string | null | undefined, members: { id: string; name: string }[], speakerId: string) {
  if (!hint) return null;
  const needle = hint.trim().toLowerCase();
  if (["me", "i", "myself"].includes(needle)) return speakerId;
  const exact = members.find((m) => m.name.toLowerCase() === needle);
  if (exact) return exact.id;
  const partial = members.find(
    (m) => m.name.toLowerCase().split(/\s+/).includes(needle) || m.name.toLowerCase().startsWith(needle),
  );
  return partial?.id ?? null;
}

export async function processCapture(captureId: string) {
  const capture = await db.capture.update({
    where: { id: captureId },
    data: { status: "PROCESSING", error: null },
    include: { user: { select: { id: true, name: true, timezone: true } } },
  });

  try {
    const [members, boards] = await Promise.all([
      db.orgMember.findMany({
        where: { orgId: capture.orgId },
        select: { user: { select: { id: true, name: true } } },
      }),
      db.board.findMany({
        where: { orgId: capture.orgId, archivedAt: null, OR: [{ ownerId: null }, { ownerId: capture.userId }] },
        select: { id: true, key: true, name: true },
      }),
    ]);
    const people = members.map((m) => m.user);

    let extraction: Extraction;
    if (isAiConfigured()) {
      const ai = await getAi(capture.orgId);
      const reply = await ai.chat({
        json: true,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              today: localDayKey(capture.user.timezone),
              speaker: capture.user.name,
              members: people.map((p) => p.name),
              boards: boards.map((b) => ({ key: b.key, name: b.name })),
              text: capture.rawText.slice(0, 30_000),
            }),
          },
        ],
      });
      extraction = extractionSchema.parse(parseJsonReply(reply.content));
    } else {
      extraction = heuristicExtract(capture.rawText);
    }

    await db.$transaction([
      db.suggestedCard.deleteMany({ where: { captureId, status: "PENDING" } }),
      db.suggestedCard.createMany({
        data: extraction.suggestions.map((s) => ({
          captureId,
          title: s.title,
          description: s.description ?? null,
          assigneeHint: s.assignee ?? null,
          suggestedUserId: matchMember(s.assignee, people, capture.user.id),
          suggestedBoardId: boards.find((b) => b.key === s.board)?.id ?? null,
          dueDate: s.dueDate ? new Date(`${s.dueDate}T00:00:00.000Z`) : null,
          priority: s.priority as Priority,
          confidence: s.confidence,
        })),
      }),
      db.capture.update({
        where: { id: captureId },
        data: {
          status: "READY",
          processedAt: new Date(),
          title: capture.title ?? extraction.title ?? null,
        },
      }),
    ]);
  } catch (error) {
    await db.capture.update({
      where: { id: captureId },
      data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" },
    });
    throw error;
  }
}
