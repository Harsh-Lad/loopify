import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** One virtual speaker per meeting, so parallel meetings never mix audio. Returns the module id. */
export async function createSink(name: string): Promise<string> {
  const { stdout } = await exec("pactl", [
    "load-module",
    "module-null-sink",
    `sink_name=${name}`,
    `sink_properties=device.description=${name}`,
  ]);
  return stdout.trim();
}

export async function removeSink(moduleId: string) {
  await exec("pactl", ["unload-module", moduleId]).catch(() => {});
}

export type Recorder = { stop: () => Promise<void> };

/** Records the sink's monitor to mono 16 kHz Opus (about 11 MB per hour). */
export function startRecording(sink: string, file: string): Recorder {
  const ff = spawn(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "pulse", "-i", `${sink}.monitor`,
      "-ac", "1", "-ar", "16000",
      "-c:a", "libopus", "-b:a", "24k", "-application", "voip",
      file,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  ff.stderr.on("data", (d) => console.error(`[ffmpeg ${sink}] ${String(d).trim()}`));

  let exited = false;
  const done = new Promise<void>((resolve) => ff.once("exit", () => { exited = true; resolve(); }));

  return {
    async stop() {
      if (exited) return;
      ff.stdin.write("q");
      ff.stdin.end();
      const timer = setTimeout(() => ff.kill("SIGINT"), 5000);
      await done;
      clearTimeout(timer);
    },
  };
}
