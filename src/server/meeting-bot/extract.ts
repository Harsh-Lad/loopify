/**
 * Turns a diarized Hindi/English transcript into English notes and action items, in one Grok call.
 * Goes through our AI adapter, so it uses the org's configured model (Grok by default).
 */

import { getAi } from "@/server/ai";

export type Utterance = { speaker: number; start: number; end: number; text: string };

export type ActionItem = {
  title: string;
  owner: string | null;
  due: string | null; // YYYY-MM-DD
  team: "tech" | "video" | "influencer" | "other";
  quote: string;
};

export type MeetingResult = {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: ActionItem[];
  translations: { i: number; en: string }[];
};

const SYSTEM = `You turn meeting transcripts from an Indian agency into English notes and work items.
Speakers mix Hindi (Devanagari or romanised) and English, often inside one sentence.

Rules:
- translations: for every utterance that contains any Hindi, give a natural English translation keyed by its index. Skip utterances already fully in English.
- title: a short meeting title if the given one is missing or generic.
- summary: two or three plain English sentences.
- decisions: things the group agreed on, in English. Empty list if none.
- actionItems: only concrete tasks someone committed to or was asked to do. Do not invent tasks. Merge duplicates.
  - title: starts with a verb, under 80 characters, English. Keep brand, product and creator names exactly as spoken.
  - owner: an attendee name, chosen from what people say ("main kar dunga" means the speaker; "Priya, tum bhej dena" means Priya). S0, S1 are speaker numbers, not names. Use null when unclear.
  - due: resolve "aaj", "kal" (tomorrow when talking about future work), "parso", "Friday tak", "EOD", "next week" against the meeting date, as YYYY-MM-DD. null if no date was said.
  - team: tech (product, engineering), video (editing, shoots, social content), influencer (creators, sheets, campaign execution), otherwise other.
  - quote: the shortest original phrase that supports the task, in the language it was spoken.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "decisions", "actionItems", "translations"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "owner", "due", "team", "quote"],
        properties: {
          title: { type: "string" },
          owner: { type: ["string", "null"] },
          due: { type: ["string", "null"] },
          team: { type: "string", enum: ["tech", "video", "influencer", "other"] },
          quote: { type: "string" },
        },
      },
    },
    translations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["i", "en"],
        properties: { i: { type: "integer" }, en: { type: "string" } },
      },
    },
  },
} as const;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

async function callGrok(orgId: string, system: string, user: string): Promise<string> {
  const ai = await getAi(orgId);
  const reply = await ai.chat({
    temperature: 0.2,
    jsonSchema: { name: "meeting_notes", schema: SCHEMA },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return reply.content ?? "";
}

export async function extractMeeting(input: {
  orgId: string;
  title: string | null;
  attendees: string[];
  meetingDate: Date;
  utterances: Utterance[];
}): Promise<MeetingResult> {
  const date = input.meetingDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const weekday = input.meetingDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long" });
  const lines = input.utterances.map((u, i) => `[${i}] S${u.speaker} ${mmss(u.start)}: ${u.text}`).join("\n");

  const user = [
    `Meeting title: ${input.title ?? "(none)"}`,
    `Meeting date: ${date} (${weekday}), Asia/Kolkata`,
    `Attendees: ${input.attendees.length ? input.attendees.join(", ") : "unknown"}`,
    "",
    "Transcript:",
    lines,
  ].join("\n");

  const raw = await callGrok(input.orgId, SYSTEM, user);
  const parsed = JSON.parse(raw) as MeetingResult;
  // Only keep owners we actually know, so cards never get assigned to a hallucinated name.
  const known = new Map(input.attendees.map((a) => [a.toLowerCase(), a]));
  parsed.actionItems = parsed.actionItems.map((a) => ({
    ...a,
    owner: a.owner ? known.get(a.owner.toLowerCase()) ?? matchFirstName(a.owner, input.attendees) : null,
    due: a.due && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : null,
  }));
  return parsed;
}

function matchFirstName(name: string, attendees: string[]): string | null {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase();
  return attendees.find((a) => a.trim().split(/\s+/)[0]?.toLowerCase() === first) ?? null;
}
