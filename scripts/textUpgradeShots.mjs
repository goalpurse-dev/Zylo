// Text upgrade ($0): screenshots of f90160bc's new text layers in the REAL
// Scenes player. f90160bc belongs to a real user, so nobody signs in as them:
// the internal test account opens its own test project's Scenes page, and
// the scene list response is swapped (in the browser, read-only) for
// f90160bc's scenes + narration, read with the service role.
//   node --env-file=.env.local scripts/textUpgradeShots.mjs <outDir> <scene> <scene> <scene>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const SHOW = "f90160bc-8e3c-4210-890f-91b383b5dd81";
const [OUT, ...picks] = process.argv.slice(2);
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

// f90160bc's scenes in the get-long-form-scenes shape (read-only).
const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", SHOW).single();
const planId = p.autopilot.scenes.planId;
const { data: beats } = await admin.from("long_form_beats").select("sequence, start_ms, end_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
const { data: imgs } = await admin.from("long_form_scene_images").select("id, beat_sequence, image_url, overlay, overlay_text, version").eq("project_id", SHOW).eq("beat_plan_version_id", planId).eq("is_current", true);
const { data: audio } = await admin.from("long_form_narration_audio_versions").select("audio_url, audio_duration_seconds").eq("project_id", SHOW).in("status", ["ready", "alignment_failed"]).order("created_at", { ascending: false }).limit(1).single();
const img = new Map(imgs.map((i) => [i.beat_sequence, i]));
const thumb = (url, w) => `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${w}&height=${Math.round((w * 9) / 16)}&resize=contain&quality=72`;
const scenes = beats.map((b) => {
  const i = img.get(b.sequence);
  return { key: i.id, sceneId: i.id, number: b.sequence, startMs: b.start_ms, endMs: b.end_ms, narration: b.narration_text, summary: b.contract?.visualConcept ?? "", imageUrl: i.image_url, thumbUrl: thumb(i.image_url, 640), playerUrl: thumb(i.image_url, 1920), status: "ready", version: i.version, motion: null, overlay: i.overlay, overlayText: i.overlay_text, warnings: [], flagged: false, edited: false, section: "The ancient hunt" };
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, w, r, pid]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); localStorage.setItem(`zyvo_scenes_celebrated:${pid}`, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`, TEST_PROJECT]);
await ctx.route("**/functions/v1/get-long-form-scenes", async (route) => {
  const res = await route.fetch();
  const body = await res.json();
  body.scenes = scenes;
  body.sections = [{ title: "The ancient hunt", count: scenes.length }];
  body.counts = { scenes: scenes.length, drawn: scenes.length, flagged: 0 };
  body.audio = { url: audio.audio_url, durationSeconds: Number(audio.audio_duration_seconds) };
  body.title = "The ancient hunt (f90160bc)";
  await route.fulfill({ response: res, json: body });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/scenes`, { waitUntil: "domcontentloaded" });
await page.getByTestId("stickman-player").waitFor({ timeout: 30000 });
await page.waitForFunction(() => document.querySelector("[data-testid=stickman-player] audio")?.readyState >= 1, null, { timeout: 30000 });
const out = [];
for (const n of picks.map(Number)) {
  const s = scenes.find((x) => x.number === n);
  await page.evaluate((t) => { const a = document.querySelector("[data-testid=stickman-player] audio"); a.currentTime = t; }, (s.startMs + 400) / 1000);
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.fonts.ready);
  const shown = await page.locator("[data-testid=stickman-player] svg[data-text-style]").getAttribute("data-text-style").catch(() => null);
  await page.getByTestId("stickman-player").screenshot({ path: `${OUT}/player-scene-${n}.png` });
  out.push({ scene: n, text: s.overlayText, style: shown });
}
console.log(JSON.stringify({ out, errors }, null, 1));
await browser.close();
