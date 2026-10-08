import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { createApi, type Job } from "./api.js";
import { createSink, removeSink, startRecording, type Recorder } from "./audio.js";
import { loadConfig } from "./config.js";
import { attendMeet } from "./meet.js";
import { toUtterances, transcribe } from "./stt.js";

const cfg = loadConfig();
const api = createApi(cfg);
const active = new Set<string>();
let stopping = false;

const log = (job: Job | null, msg: string) =>
  console.log(`${new Date().toISOString()} ${job ? `[${job.id}]` : "[runner]"} ${msg}`);

async function handle(job: Job) {
  const sink = `loop_${job.id.replace(/\W/g, "").slice(-16)}`;
  const file = path.join(cfg.audioDir, `${job.id}.ogg`);
  let moduleId: string | null = null;
  let recorder: Recorder | null = null;

  try {
    log(job, `joining ${job.meetUrl}`);
    moduleId = await createSink(sink);
    await api.setStatus(job.id, "JOINING");

    const reason = await attendMeet(job, cfg, {
      sink,
      status: (s) => api.setStatus(job.id, s),
      onAdmitted: () => {
        log(job, "admitted, recording");
        recorder = startRecording(sink, file);
      },
    });
    log(job, `left the call (${reason})`);
    await (recorder as Recorder | null)?.stop();

    const size = (await stat(file).catch(() => null))?.size ?? 0;
    if (size < 8_000) {
      await api.submitTranscript(job.id, { durationSec: 0, language: null, endReason: reason, text: "", utterances: [] });
      log(job, "no audio captured, submitted empty transcript");
      return;
    }

    await api.setStatus(job.id, "TRANSCRIBING");
    const stt = await transcribe(file, job.keyterms, cfg);
    const utterances = toUtterances(stt.words ?? []);
    await api.submitTranscript(job.id, {
      durationSec: Math.round(stt.duration ?? 0),
      language: stt.language ?? null,
      endReason: reason,
      text: stt.text ?? "",
      utterances,
    });
    log(job, `submitted ${utterances.length} turns, ${Math.round((stt.duration ?? 0) / 60)} min`);
    if (!cfg.keepAudio) await rm(file, { force: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log(job, `failed: ${message}`);
    await (recorder as Recorder | null)?.stop().catch(() => {});
    await api.setStatus(job.id, "FAILED", message.slice(0, 500)).catch(() => {});
  } finally {
    if (moduleId) await removeSink(moduleId);
  }
}

async function poll() {
  if (stopping) return;
  try {
    while (active.size < cfg.maxConcurrent) {
      const job = await api.claimJob();
      if (!job) break;
      active.add(job.id);
      void handle(job).finally(() => active.delete(job.id));
    }
  } catch (e) {
    log(null, `poll error: ${e instanceof Error ? e.message : e}`);
  }
}

await mkdir(cfg.audioDir, { recursive: true });
log(null, `${cfg.runnerId} polling ${cfg.loopifyUrl} every ${cfg.pollMs / 1000}s, up to ${cfg.maxConcurrent} meetings`);
const timer = setInterval(poll, cfg.pollMs);
void poll();

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    stopping = true;
    clearInterval(timer);
    log(null, `${sig}: finishing ${active.size} active meeting(s)`);
    while (active.size) await new Promise((r) => setTimeout(r, 2000));
    process.exit(0);
  });
}
