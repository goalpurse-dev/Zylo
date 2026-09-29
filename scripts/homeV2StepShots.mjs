// "How it works" step images for the Home v2 Long Form section ($0): real
// crops of the Idea, Scenes and Publish pages (internal test account, TEST
// project f6ee3eb2). Nothing is clicked that costs anything; render starts
// are blocked.
//   node --env-file=.env.local scripts/homeV2StepShots.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
const OUT = "public/home/v2";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1.5 });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); sessionStorage.setItem("free_credits_banner_closed", "true"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
await ctx.route("**/functions/v1/long-form-render", async (r) => {
  const b = r.request().postDataJSON?.() ?? {};
  if (b.action && b.action !== "status") return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  const res = await r.fetch(); const j = await res.json();
  if (j.lastDone) { j.job = j.lastDone; if (!j.doneByRes?.["1080p"]) j.doneByRes = { ...(j.doneByRes ?? {}), "1080p": j.lastDone }; }
  return r.fulfill({ response: res, json: j });
});
const page = await ctx.newPage();
const clip = { x: 248, y: 96, width: 1096, height: 616 };
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 78, clip });
const scroll = (y) => page.evaluate((v) => { const s = document.getElementById("workspace-scroll"); if (s) s.scrollTop = v; }, y);

// 1. Idea: pick a niche + quality.
await page.goto("http://localhost:5173/long-form/create", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
if (await page.getByText("Choose your niche").count()) await page.getByText("Choose your niche").click(); else await page.getByText("Change", { exact: true }).first().click();
await page.getByText("Ancient Humans & Prehistory", { exact: true }).first().click();
await page.waitForTimeout(2500);
await scroll(0); await page.waitForTimeout(600);
await shot("step-idea");
// 2. Scenes: the drawn grid (second row onward, no editing state).
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/scenes`, { waitUntil: "domcontentloaded" });
await page.getByTestId("regenerate").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(2500);
await scroll(1010); await page.waitForTimeout(1500);
await shot("step-scenes");
// 3. Publish: video, thumbnails and YouTube text.
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/publish`, { waitUntil: "domcontentloaded" });
await page.getByTestId("price-1440").waitFor({ timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);
// A later frame than the opening shot (the player shows its first frame by default).
await page.evaluate(() => new Promise((res) => { const v = document.querySelector("[data-testid=publish-player]"); if (!v) return res(); v.addEventListener("seeked", () => res(), { once: true }); v.currentTime = 120; setTimeout(res, 8000); }));
await page.waitForTimeout(800);
await shot("step-publish");
await browser.close();
for (const f of fs.readdirSync(OUT)) console.log(f, (fs.statSync(`${OUT}/${f}`).size / 1024).toFixed(0) + " KB");
