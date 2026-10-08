import { existsSync } from "node:fs";
import { chromium, type Locator, type Page } from "playwright";
import type { Job, RunnerStatus } from "./api.js";
import type { Config } from "./config.js";

export type EndReason = "ended" | "alone" | "max_duration" | "cancelled" | "closed";

type Hooks = {
  sink: string;
  status: (s: RunnerStatus) => Promise<boolean>; // returns cancel flag
  onAdmitted: () => void;
};

const visible = async (l: Locator, timeout = 0) => {
  try {
    if (timeout) await l.waitFor({ state: "visible", timeout });
    return await l.isVisible();
  } catch {
    return false;
  }
};

const clickIfVisible = async (l: Locator, timeout = 2000) => {
  if (await visible(l, timeout)) await l.click().catch(() => {});
};

const BLOCKED = /you can.t join this video call|not allowed to join|check your meeting code|meeting code has expired|someone in the call denied/i;

async function assertNotBlocked(page: Page) {
  const blocked = page.getByText(BLOCKED).first();
  if (await visible(blocked)) throw new Error(`Meet refused entry: ${(await blocked.textContent())?.trim()}`);
}

/** Joins a Google Meet, records until the call ends, and leaves. Audio goes to `hooks.sink`. */
export async function attendMeet(job: Job, cfg: Config, hooks: Hooks): Promise<EndReason> {
  const browser = await chromium.launch({
    headless: false, // runs under Xvfb; Meet treats headless browsers as bots and often blocks them
    env: { ...process.env, PULSE_SINK: hooks.sink },
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--lang=en-US",
    ],
  });

  try {
    const signedIn = existsSync(cfg.googleState);
    const context = await browser.newContext({
      storageState: signedIn ? cfg.googleState : undefined,
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
    });
    await context.grantPermissions(["microphone", "camera"], { origin: "https://meet.google.com" });
    const page = await context.newPage();

    await page.goto(job.meetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await assertNotBlocked(page);
    await clickIfVisible(page.getByRole("button", { name: /^(got it|dismiss|close)$/i }).first());

    // Guest join asks for a name. A signed-in account skips this.
    const nameBox = page.getByRole("textbox", { name: /your name/i });
    if (await visible(nameBox, 8000)) await nameBox.fill(cfg.botName);

    // The bot never speaks or shows video.
    await clickIfVisible(page.getByRole("button", { name: /turn off microphone/i }).first(), 4000);
    await clickIfVisible(page.getByRole("button", { name: /turn off camera/i }).first(), 2000);

    const join = page.getByRole("button", { name: /join now|ask to join/i }).first();
    await join.waitFor({ state: "visible", timeout: 30_000 });
    await join.click();
    await hooks.status("WAITING_ADMIT");

    const leave = page.getByRole("button", { name: /leave call/i }).first();
    try {
      await leave.waitFor({ state: "visible", timeout: cfg.admitTimeoutMs });
    } catch {
      await assertNotBlocked(page);
      throw new Error("Nobody let the bot in before the admit timeout");
    }

    hooks.onAdmitted();
    await hooks.status("RECORDING");

    const started = Date.now();
    let aloneSince: number | null = null;
    let tick = 0;

    for (;;) {
      await page.waitForTimeout(5000).catch(() => {});
      if (page.isClosed()) return "closed";
      if (!(await visible(leave))) return "ended";

      const alone = await visible(page.getByText(/only one here|no one else is here|you.re the only one/i).first());
      aloneSince = alone ? aloneSince ?? Date.now() : null;
      if (aloneSince && Date.now() - aloneSince > cfg.aloneTimeoutMs) {
        await leave.click().catch(() => {});
        return "alone";
      }
      if (Date.now() - started > cfg.maxMeetingMs) {
        await leave.click().catch(() => {});
        return "max_duration";
      }
      // Heartbeat every 30 s. Keeps the job alive on the server and picks up "leave now".
      if (++tick % 6 === 0 && (await hooks.status("RECORDING").catch(() => false))) {
        await leave.click().catch(() => {});
        return "cancelled";
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
}
