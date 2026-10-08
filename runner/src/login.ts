/**
 * One-time sign-in for the bot's Google account. Run on your own PC (needs a visible window):
 *   npm run login
 * Then copy secrets/google-state.json to the server's runner/secrets folder.
 * If Google says the browser is not secure, run with LOGIN_CHANNEL=chrome to use your installed Chrome.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const out = process.env.GOOGLE_STATE_OUT || "secrets/google-state.json";

const browser = await chromium.launch({
  headless: false,
  channel: process.env.LOGIN_CHANNEL || undefined,
  args: ["--disable-blink-features=AutomationControlled"],
});
const context = await browser.newContext();
const page = await context.newPage();
await page.goto("https://accounts.google.com/");

console.log("Sign in with the bot's Google account in the browser window.");
console.log("When you can see the account page, come back here and press Enter.");
await new Promise((resolve) => process.stdin.once("data", resolve));

await page.goto("https://meet.google.com/");
await page.waitForTimeout(3000);
await mkdir(path.dirname(out), { recursive: true });
await context.storageState({ path: out });
await browser.close();
console.log(`Saved ${out}. Keep it private: it is a signed-in session.`);
process.exit(0);
