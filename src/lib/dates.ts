/**
 * Day plans are keyed by the user's local calendar day, stored as a Postgres
 * DATE (represented in JS as UTC midnight of that day).
 */

/** "YYYY-MM-DD" for the given instant in the given IANA time zone. */
export function localDayKey(timeZone: string, at: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function dayKeyToDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateToDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number) {
  const date = dayKeyToDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToDayKey(date);
}

/** Local hour (0-23) in a time zone. */
export function localHour(timeZone: string, at: Date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(at));
}

/**
 * The UTC instants that bound a local calendar day. Used to query the event
 * log for "what happened yesterday" in the user's own time zone.
 */
export function localDayBounds(timeZone: string, key: string) {
  const startGuess = dayKeyToDate(key);
  const offset = (instant: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(instant);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return asUtc - instant.getTime();
  };
  const start = new Date(startGuess.getTime() - offset(startGuess));
  const endGuess = dayKeyToDate(addDays(key, 1));
  const end = new Date(endGuess.getTime() - offset(endGuess));
  return { start, end };
}

export function greeting(timeZone: string) {
  const hour = localHour(timeZone);
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
