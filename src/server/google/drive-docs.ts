import "server-only";
import { drive } from "@googleapis/drive";
import { stripCaptions } from "@/lib/transcripts";
import { getGoogleClient } from "@/server/google/oauth";

/**
 * Meeting transcripts and notes from Google Drive, for Capture. Google Meet
 * saves transcripts as Google Docs (usually named "… - Transcript" in the
 * "Meet Recordings" folder); people also keep notes in Docs, Sheets or plain
 * text/caption files. drive.readonly is enough to list and export all of them.
 */

const DOC = "application/vnd.google-apps.document";
const SHEET = "application/vnd.google-apps.spreadsheet";
const TEXT_TYPES = ["text/plain", "text/vtt", "application/x-subrip", "text/markdown", "text/csv"];
const MAX_CHARS = 60_000;

export type DriveFileKind = "transcript" | "doc" | "sheet" | "text";

function kindOf(name: string, mimeType: string): DriveFileKind {
  if (mimeType === SHEET) return "sheet";
  if (/transcript|meeting notes|notes by gemini/i.test(name)) return "transcript";
  if (mimeType === DOC) return "doc";
  return "text";
}

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function listCaptureFiles(
  orgId: string,
  userId: string,
  opts: { query?: string; kind: "meetings" | "all"; pageToken?: string },
) {
  const auth = (await getGoogleClient(orgId, userId)) as never;
  const api = drive({ version: "v3", auth });
  const types = opts.kind === "meetings" ? [DOC, ...TEXT_TYPES] : [DOC, SHEET, ...TEXT_TYPES];
  const clauses = [`trashed=false`, `(${types.map((t) => `mimeType='${t}'`).join(" or ")})`];
  if (opts.kind === "meetings") {
    clauses.push(
      `(name contains 'Transcript' or name contains 'transcript' or name contains 'Meeting' or name contains 'meeting' or name contains 'Notes by Gemini' or mimeType='text/vtt' or mimeType='application/x-subrip')`,
    );
  }
  const q = opts.query?.trim();
  if (q) clauses.push(`(name contains '${escape(q)}' or fullText contains '${escape(q)}')`);

  const res = await api.files.list({
    q: clauses.join(" and "),
    orderBy: q ? undefined : "modifiedTime desc",
    pageSize: 30,
    pageToken: opts.pageToken,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)",
  });
  return {
    files: (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name ?? "Untitled",
      mimeType: f.mimeType ?? "",
      modifiedTime: f.modifiedTime ?? null,
      url: f.webViewLink ?? null,
      kind: kindOf(f.name ?? "", f.mimeType ?? ""),
    })),
    nextPageToken: res.data.nextPageToken ?? null,
  };
}

export async function readCaptureFile(orgId: string, userId: string, fileId: string) {
  const auth = (await getGoogleClient(orgId, userId)) as never;
  const api = drive({ version: "v3", auth });
  const meta = await api.files.get({ fileId, fields: "id, name, mimeType" });
  const mimeType = meta.data.mimeType ?? "";
  const name = meta.data.name ?? "Imported file";

  let text: string;
  if (mimeType === DOC) {
    const res = await api.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
    text = String(res.data);
  } else if (mimeType === SHEET) {
    // Exports the first tab as CSV, which reads fine as meeting notes or a task list.
    const res = await api.files.export({ fileId, mimeType: "text/csv" }, { responseType: "text" });
    text = String(res.data);
  } else if (TEXT_TYPES.includes(mimeType)) {
    const res = await api.files.get({ fileId, alt: "media" }, { responseType: "text" });
    text = String(res.data);
    if (mimeType === "text/vtt" || mimeType === "application/x-subrip") text = stripCaptions(text);
  } else {
    throw new Error("That file type can't be imported. Pick a Google Doc, Sheet or a text/caption file.");
  }

  text = text.replace(/﻿/g, "").trim();
  return { name, kind: kindOf(name, mimeType), text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS };
}
