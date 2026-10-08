import type { Config } from "./config.js";

export type Job = {
  id: string;
  meetUrl: string;
  title: string | null;
  attendees: string[];
  keyterms: string[];
};

export type RunnerStatus = "JOINING" | "WAITING_ADMIT" | "RECORDING" | "TRANSCRIBING" | "FAILED";

export type Utterance = { speaker: number; start: number; end: number; text: string };

export type TranscriptPayload = {
  durationSec: number;
  language: string | null;
  endReason: string;
  text: string;
  utterances: Utterance[];
};

export function createApi(cfg: Config) {
  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(cfg.loopifyUrl + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-runner-secret": cfg.runnerSecret,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`Loopify ${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return res;
  }

  return {
    /** Claims the next queued meeting that starts within 2 minutes, or null. */
    async claimJob(): Promise<Job | null> {
      const res = await call(`/api/bot/jobs/next?runner=${encodeURIComponent(cfg.runnerId)}`, { method: "POST" });
      if (res.status === 204) return null;
      return (await res.json()) as Job;
    },

    /** Updates status. Doubles as a heartbeat; returns true when someone asked the bot to leave. */
    async setStatus(id: string, status: RunnerStatus, error?: string): Promise<boolean> {
      const res = await call(`/api/bot/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, error }),
      });
      const body = (await res.json().catch(() => ({}))) as { cancel?: boolean };
      return Boolean(body.cancel);
    },

    async submitTranscript(id: string, payload: TranscriptPayload) {
      await call(`/api/bot/jobs/${id}/transcript`, { method: "POST", body: JSON.stringify(payload) });
    },
  };
}

export type Api = ReturnType<typeof createApi>;
