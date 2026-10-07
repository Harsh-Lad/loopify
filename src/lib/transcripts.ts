/** Caption files (.vtt, .srt): drop cue numbers, timestamps and headers, keep "Speaker: line" text. */
export function stripCaptions(raw: string) {
  return raw
    .replace(/^WEBVTT.*$/m, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^\d+$/.test(line.trim()) && !/-->/.test(line) && !/^NOTE\b/.test(line))
    .map((line) => line.replace(/<v ([^>]+)>/g, "$1: ").replace(/<[^>]+>/g, ""))
    .join("\n");
}
