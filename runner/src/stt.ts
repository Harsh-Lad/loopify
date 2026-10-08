import { openAsBlob } from "node:fs";
import type { Utterance } from "./api.js";
import type { Config } from "./config.js";

type Word = { text: string; start: number; end: number; speaker?: number };
export type SttResult = { text: string; language?: string; duration?: number; words?: Word[] };

/**
 * Batch transcription after the call ($0.10/hr, half the streaming price).
 * No `language` is sent: auto-detect copes with Hindi and English in the same sentence.
 */
export async function transcribe(file: string, keyterms: string[], cfg: Config): Promise<SttResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const form = new FormData();
      if (cfg.sttModel) form.append("model", cfg.sttModel);
      form.append("diarize", "true");
      for (const k of keyterms.slice(0, 100)) form.append("keyterm", k.slice(0, 50));
      // `file` must be the last field.
      form.append("file", await openAsBlob(file, { type: "audio/ogg" }), "meeting.ogg");

      const res = await fetch("https://api.x.ai/v1/stt", {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.xaiKey}` },
        body: form,
        signal: AbortSignal.timeout(20 * 60_000),
      });
      if (res.ok) return (await res.json()) as SttResult;
      const err = new Error(`Grok STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
      // Bad key, bad file and similar won't fix themselves; only retry rate limits and server errors.
      if (res.status < 500 && res.status !== 429) throw Object.assign(err, { fatal: true });
      lastError = err;
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      lastError = e; // network error or timeout
    }
    await new Promise((r) => setTimeout(r, attempt * 10_000));
  }
  throw lastError;
}

/** Groups diarized words into speaker turns. Breaks on speaker change or a pause over `gapSec`. */
export function toUtterances(words: Word[], gapSec = 1.5): Utterance[] {
  const out: Utterance[] = [];
  for (const w of words) {
    const speaker = w.speaker ?? 0;
    const last = out[out.length - 1];
    if (last && last.speaker === speaker && w.start - last.end <= gapSec) {
      last.text += (/^[.,!?।]/.test(w.text) ? "" : " ") + w.text;
      last.end = w.end;
    } else {
      out.push({ speaker, start: w.start, end: w.end, text: w.text });
    }
  }
  return out;
}
