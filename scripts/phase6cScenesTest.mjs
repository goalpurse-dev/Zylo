// Phase 6c ($0) — the Scenes step on the Myth vs Reality test project:
// review list, playback sync (click -> audio from the scene's start; the
// playing scene highlighted + auto-scrolled), a REAL free text edit, the
// paid actions as dry runs (?dryrun=1), and the live-fill building screen
// via a replayed run (?replay=1). Internal test account only.
//   node --env-file=.env.local scripts/phase6cScenesTest.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync("docs/phase6c", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, w, r]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
const out = {};

await page.goto(`http://localhost:5173/long-form/project/${PROJECT}/scenes?dryrun=1`, { waitUntil: "domcontentloaded" });
await page.getByTestId("scenes-list").waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);
out.counts = await page.getByTestId("scenes-counts").textContent();
out.renderedRows = await page.locator('[data-testid="scenes-list"] >> text=/^Scene \\d+ ·/').count();
await page.screenshot({ path: "docs/phase6c/2-scenes-review.png" });

// Playback sync: click scene 3 -> audio starts at its start time, scene 3 highlighted.
const startOf = async (n) => (await admin.from("long_form_beats").select("start_ms").eq("beat_plan_version_id", "96f510cb-67e7-4a98-a138-0ec1a1687706").eq("sequence", n).single()).data.start_ms;
await page.getByRole("button", { name: "Play from scene 3", exact: true }).click();
await page.waitForTimeout(1500);
const t3 = await page.evaluate(() => document.querySelector("audio").currentTime);
const active3 = await page.locator(".border-lime-300\\/50").first().textContent();
out.playback = { clickedScene: 3, sceneStartS: (await startOf(3)) / 1000, audioAtS: Number(t3.toFixed(2)), highlighted: active3.match(/Scene \d+/)?.[0] };
// Jump the audio to scene 60 -> the list auto-scrolls to it and highlights it.
const s60 = (await startOf(60)) / 1000;
await page.evaluate((t) => { const a = document.querySelector("audio"); a.currentTime = t + 0.2; a.play(); }, s60);
await page.waitForTimeout(2500);
const active60 = await page.locator(".border-lime-300\\/50").first().textContent().catch(() => "");
out.autoScroll = { jumpedToS: s60, highlighted: active60.match(/Scene \d+/)?.[0], listScrollTop: await page.getByTestId("scenes-list").evaluate((el) => el.scrollTop) };
await page.screenshot({ path: "docs/phase6c/3-playback-sync.png" });

// Scene 26 ("NORWAY, 1943"): REAL free text edit.
await page.evaluate((t) => { const a = document.querySelector("audio"); a.currentTime = t + 0.2; }, (await startOf(26)) / 1000);
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector("audio").pause());
const row26 = page.locator('div.rounded-xl', { hasText: "Scene 26 ·" }).last();
await row26.getByRole("button", { name: "Edit text" }).click();
await row26.locator("input").fill("NORWAY 1943");
await row26.getByRole("button", { name: "Save · free" }).click();
await page.getByText("On-screen text updated.").waitFor({ timeout: 20000 });
await page.waitForTimeout(2500);
const { data: after } = await admin.from("long_form_scene_images").select("overlay_text, overlay, image_url").eq("project_id", PROJECT).eq("beat_sequence", 26).eq("is_current", true).single();
out.textEdit = { scene: 26, from: "NORWAY, 1943", to: after.overlay_text, layerBox: after.overlay?.box, imageUnchanged: after.image_url.endsWith("026-v1.jpg") };
await row26.screenshot({ path: "docs/phase6c/4-text-edit-row.png" });

// Paid actions as DRY RUNS: regenerate, edit description, regenerate all flagged.
await row26.getByRole("button", { name: /Regenerate · \d+ credits/ }).click();
out.regenerateDry = await page.locator("p", { hasText: "Test mode:" }).first().textContent({ timeout: 15000 });
await row26.getByRole("button", { name: "Edit description" }).click();
await row26.locator("input").fill("A puzzled stickman archaeologist holds up a plain round iron helmet with no horns");
await row26.getByRole("button", { name: /Regenerate · \d+ credits/ }).click();
await page.waitForTimeout(2500);
out.describeDry = await page.locator("p", { hasText: /Test mode:|describe|brand|words/ }).first().textContent();
await page.getByRole("button", { name: /Regenerate all flagged/ }).click();
await page.waitForTimeout(3000);
out.flaggedDry = await page.locator("p", { hasText: "Test mode:" }).first().textContent();
const { count: newRows } = await admin.from("long_form_scene_images").select("id", { count: "exact", head: true }).eq("project_id", PROJECT).neq("source", "seeded");
out.dryRunCreatedRows = newRows;

// Live fill via a replayed run.
await page.goto(`http://localhost:5173/long-form/project/${PROJECT}/scenes?replay=1`, { waitUntil: "domcontentloaded" });
await page.getByTestId("scenes-grid").waitFor({ timeout: 30000 });
await page.waitForTimeout(11000);
out.replayCounter = await page.getByTestId("scenes-counter").textContent();
await page.screenshot({ path: "docs/phase6c/1-building-live-fill.png" });
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
