// Phase 6c ($0): legacy Stickman routes redirect to the real step, and the
// stepper highlights that step. Internal test account projects only.
//   node --env-file=.env.local scripts/phase6cRoutesCheck.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, w, r]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

const E2E = "7850557d-bff5-4a35-b7dc-f01f93510502", MYTH = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const out = [];
for (const [pid, legacy] of [[E2E, ["visuals", "story", "research", "script", "look", "visual-world", "generate", "writing"]], [MYTH, ["generate", "visuals", "story"]]]) {
  for (const p of legacy) {
    await page.goto(`http://localhost:5173/long-form/project/${pid}/${p}`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/(scenes|narration|script-review|writing)(\?|$)/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const landed = page.url().split("/").pop();
    // The stepper's highlighted (white) step label.
    const current = await page.locator(".text-white.text-\\[11\\.5px\\]").first().textContent().catch(() => null);
    out.push(`${pid.slice(0, 8)} /${p} -> /${landed} · stepper: ${current}`);
  }
}
await page.goto(`http://localhost:5173/long-form/project/${E2E}/scenes`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await page.screenshot({ path: "docs/phase6c/e2e/5-scenes-failed-retry.png" });
out.push(`retry button visible: ${await page.getByRole("button", { name: "Retry (free)" }).count()}`);
console.log(out.join("\n"));
console.log("errors:", JSON.stringify(errors));
await browser.close();
