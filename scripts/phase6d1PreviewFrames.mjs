// Phase 6d-1 ($0): the editor preview's frames at given times (the Myth vs
// Reality TEST project, internal test account) for the preview-vs-FFmpeg check.
//   node --env-file=.env.local scripts/phase6d1PreviewFrames.mjs <outDir> 31 33.5 ...
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [OUT, ...times] = process.argv.slice(2);
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 2400, height: 1500 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, w, r]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-preview").waitFor({ timeout: 40000 });
await page.waitForTimeout(2000);
for (const t of times) {
  await page.evaluate((x) => { document.querySelector("audio").currentTime = Number(x); }, t);
  await page.waitForFunction(() => { const i = document.querySelector("[data-testid=edit-preview] img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.getByTestId("edit-preview").screenshot({ path: `${OUT}/preview-${t}.png` });
}
console.log(JSON.stringify({ frames: times.length, size: await page.getByTestId("edit-preview").boundingBox() }));
await browser.close();
