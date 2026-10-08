import os from "node:os";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export function loadConfig() {
  return {
    loopifyUrl: required("LOOPIFY_URL").replace(/\/$/, ""),
    runnerSecret: required("RUNNER_SECRET"),
    xaiKey: required("XAI_API_KEY"),
    sttModel: process.env.XAI_STT_MODEL ?? "",
    runnerId: process.env.RUNNER_ID || os.hostname(),
    maxConcurrent: num("MAX_CONCURRENT", 2),
    pollMs: num("POLL_SECONDS", 20) * 1000,
    botName: process.env.BOT_NAME || "Loopify Notetaker",
    googleState: process.env.GOOGLE_STATE || "/secrets/google-state.json",
    audioDir: process.env.AUDIO_DIR || "/data/audio",
    keepAudio: process.env.KEEP_AUDIO === "true",
    admitTimeoutMs: num("ADMIT_TIMEOUT_MIN", 10) * 60_000,
    aloneTimeoutMs: num("ALONE_TIMEOUT_MIN", 3) * 60_000,
    maxMeetingMs: num("MAX_MEETING_MIN", 180) * 60_000,
  };
}

export type Config = ReturnType<typeof loadConfig>;
