// Phase 6e ($0): the new flow on the internal test account — stepper, the
// generating screen (7850557d, stopped at the scenes -> free Retry), resume
// routing from the project list, and instant Back/Continue between saved steps.
//   node --env-file=.env.local scripts/phase6eFlowCheck.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const MYTH = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae", STOPPED = "7850557d-bff5-4a35-b7dc-f01f93510502";
const URL_ = process.env.SUPABASE_URL, TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u.user.email.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
const OUT = "docs/phase6e";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, a, b]) => { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); }, [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const out = {};
const stepper = async () => page.evaluate(() => [...document.querySelectorAll("span.text-\\[11\\.5px\\]")].map((s) => `${s.textContent}${s.className.includes("text-white ") || s.className.endsWith("text-white") ? "*" : ""}`).join(" · "));

// 1. The stopped project opens the generating screen at its live stage (from a legacy URL too).
await page.goto(`http://localhost:5173/long-form/project/${STOPPED}/visuals`, { waitUntil: "domcontentloaded" });
await page.getByTestId("generating-stages").waitFor({ timeout: 30000 });
await page.waitForTimeout(3000);
out.stopped = { url: page.url().split("/").pop(), stepper: await stepper(), stages: await page.getByTestId("generating-stages").textContent(), retry: await page.getByRole("button", { name: /Retry \(free\)/ }).count() };
await page.screenshot({ path: `${OUT}/2-generating-screen.png` });

// 2. A finished project: Scenes home; Idea (read-only) and Continue back — timed, no progress screen.
await page.goto(`http://localhost:5173/long-form/project/${MYTH}/scenes`, { waitUntil: "domcontentloaded" });
await page.getByTestId("stickman-player").waitFor({ timeout: 30000 });
await page.waitForTimeout(2000);
out.scenesStepper = await stepper();
await page.screenshot({ path: `${OUT}/1-stepper-scenes-home.png` });
const flashes = [];
page.on("framenavigated", () => {});
const watchFlash = setInterval(async () => { try { const t = await page.evaluate(() => document.body.innerText); if (/Researching|Writing your script|Building your scenes|Making your video/.test(t)) flashes.push(t.match(/Researching|Writing your script|Building your scenes|Making your video/)[0]); } catch {} }, 100);
let t0 = Date.now();
await page.getByRole("button", { name: "Back to Idea" }).first().click().catch(async () => { await page.getByRole("button", { name: "Idea", exact: true }).first().click(); });
await page.getByTestId("idea-summary").waitFor({ timeout: 15000 });
out.backToIdeaMs = Date.now() - t0;
await page.waitForTimeout(1200);
out.idea = await page.getByTestId("idea-summary").innerText();
await page.screenshot({ path: `${OUT}/3-idea-summary.png` });
t0 = Date.now();
await page.getByRole("button", { name: /^Continue/ }).last().click();
await page.getByTestId("stickman-player").waitFor({ timeout: 15000 });
out.continueToScenesMs = Date.now() - t0;
// Edit and Publish placeholders via the bottom bar.
await page.getByRole("button", { name: /Continue to Edit/ }).click();
await page.getByTestId("panel-voiceover").waitFor({ timeout: 15000 });
out.editPanels = await page.locator("[data-testid^=panel-]").count();
await page.screenshot({ path: `${OUT}/4-edit-panels.png` });
await page.getByRole("button", { name: /Continue to Publish/ }).click();
await page.getByTestId("publish-placeholder").waitFor({ timeout: 15000 });
clearInterval(watchFlash);
out.progressScreenFlashes = [...new Set(flashes)];

// 3. The project list: cards resume by server state.
await page.goto("http://localhost:5173/long-form", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/5-project-list.png` });
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
