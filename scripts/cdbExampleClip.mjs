// ONE Cartoon Drive By example clip through the real template pipeline
// (page -> image job -> video job), internal test account, V2 (2K image +
// 10 s 720p Seedance 1.5 Pro, silent). Est. provider cost ~$0.59. The test
// account is on "free" (V2 needs "starter" in the page), so its plan is set
// to "starter" for this run and restored to "free" afterwards. One attempt.
//   node --env-file=.env.local scripts/cdbExampleClip.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const WORLD = "A candy-coloured seaside village of pastel cottages and striped lighthouses, with a giant spiral seashell tower rising behind it";
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: before } = await admin.from("profiles").select("plan_code, credit_balance").eq("id", TEST_USER).single();
const since = new Date().toISOString();
await admin.from("profiles").update({ plan_code: "starter" }).eq("id", TEST_USER);
let result = null;
try {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  const c = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: sess } = await c.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/workspace/cartoon-drive-by", { waitUntil: "domcontentloaded" });
  await page.locator("#cartoon-drive-world:visible").first().waitFor({ timeout: 60000 });
  await page.locator("#cartoon-drive-world:visible").first().fill(WORLD);
  const gen = page.locator("button:visible").filter({ hasText: /^Generate/ }).first();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Generate/.test(b.textContent.trim()) && !b.disabled), null, { timeout: 60000 });
  await gen.click();
  // Wait (max 12 min) for the generation row to have a video.
  for (let i = 0; i < 144; i++) {
    const { data: row } = await admin.from("cartoon_drive_by_generations").select("id, status, image_url, video_url, quality_id, created_at").eq("user_id", TEST_USER).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (row?.video_url || row?.status === "failed") { result = row; break; }
    await page.waitForTimeout(5000);
  }
  await browser.close();
} finally {
  await admin.from("profiles").update({ plan_code: before.plan_code }).eq("id", TEST_USER);
}
const { data: after } = await admin.from("profiles").select("plan_code, credit_balance").eq("id", TEST_USER).single();
console.log(JSON.stringify({ result, planRestored: after.plan_code === before.plan_code, creditsBefore: before.credit_balance, creditsAfter: after.credit_balance }, null, 1));
