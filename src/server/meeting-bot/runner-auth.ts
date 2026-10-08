import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/** The runner authenticates with a shared secret header. Set RUNNER_SECRET in the app's env. */
export function isRunner(req: Request): boolean {
  const want = env.RUNNER_SECRET ?? "";
  const got = req.headers.get("x-runner-secret") ?? "";
  if (!want || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
