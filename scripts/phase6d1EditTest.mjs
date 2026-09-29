// Phase 6d-1 ($0): the Edit step on the Myth vs Reality TEST project (the
// internal test account; never a real user's account). Moves a cut, splits a
// scene, adds each text style, turns captions on, changes a motion, undo/redo,
// reload (autosave) — with screenshots. f90160bc (a real user's project) is
// only OPENED, read-only: its edit is served into the page (no writes).
//   node --env-file=.env.local scripts/phase6d1EditTest.mjs <outDir> [--f90160bc]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [OUT] = process.argv.slice(2);
const ONLY_F9 = process.argv.includes("--f90160bc");
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

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, w, r]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
const out = { steps: [] };
const step = (name, data = {}) => { out.steps.push({ name, ...data }); console.log(name, JSON.stringify(data)); };
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const lastEdit = async () => (await admin.from("long_form_edits").select("version, doc").eq("project_id", TEST_PROJECT).order("version", { ascending: false }).limit(1).maybeSingle()).data;
const waitSaved = async () => { await page.waitForTimeout(400); await page.getByTestId("save-state").filter({ hasText: "Saved" }).waitFor({ timeout: 20000 }); };
const seekTo = async (s) => {
  await page.waitForFunction(() => document.querySelector("audio")?.readyState >= 1, null, { timeout: 60000 });
  await page.evaluate((x) => { const a = document.querySelector("audio"); a.currentTime = x; }, s);
  await page.waitForFunction(() => { const i = document.querySelector("[data-testid=edit-preview] img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(700);
};

if (ONLY_F9) {
  // Read-only: f90160bc's scenes as an edit doc, served into the test account's page.
  const { buildInitialEdit, flattenWords } = await import("../src/lib/stickmanEdit.js");
  const SHOW = "f90160bc-8e3c-4210-890f-91b383b5dd81";
  const { data: p } = await admin.from("long_form_projects").select("autopilot, selected_title").eq("id", SHOW).single();
  const planId = p.autopilot.scenes.planId;
  const { data: beats } = await admin.from("long_form_beats").select("sequence, start_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
  const { data: imgs } = await admin.from("long_form_scene_images").select("id, beat_sequence, image_url, overlay").eq("project_id", SHOW).eq("beat_plan_version_id", planId).eq("is_current", true);
  const { data: narr } = await admin.from("long_form_narration_audio_versions").select("id, audio_url, audio_duration_seconds, narration, voice_id").eq("project_id", SHOW).eq("status", "ready").order("created_at", { ascending: false }).limit(1).single();
  const img = new Map(imgs.map((i) => [i.beat_sequence, i]));
  const words = flattenWords(narr.narration);
  const doc = buildInitialEdit({ scenes: beats.map((b) => ({ sceneId: img.get(b.sequence).id, number: b.sequence, startMs: b.start_ms, narration: b.narration_text, imageUrl: img.get(b.sequence).image_url, overlay: img.get(b.sequence).overlay, camera: b.contract?.motionIntent?.camera })), words, audio: { url: narr.audio_url, durationMs: Math.round(narr.audio_duration_seconds * 1000) }, narrationId: narr.id });
  doc.captions.enabled = true;
  await ctx.route("**/functions/v1/long-form-edit", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.action === "get") return route.fulfill({ json: { doc, version: 1, retimed: false, words, narrationId: narr.id, voice: { voiceId: narr.voice_id, freeRerecordUsed: false }, script: { title: p.selected_title, chapters: [], claims: [] }, tier: "V3", creditsPerScene: 4 } });
    return route.fulfill({ json: { ok: true, version: 2 } }); // nothing is written for f90160bc
  });
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-preview").waitFor({ timeout: 40000 });
  await page.waitForTimeout(2500);
  for (const [s, name] of [[52, "f90160bc-1-bigstat"], [458, "f90160bc-2-question-captions"]]) { await seekTo(s); await page.evaluate(() => document.fonts.ready); await shot(name); }
  step("f90160bc opened read-only", { clips: doc.clips.length, texts: doc.texts.length, errors: errors.length });
  console.log(JSON.stringify({ errors }, null, 1));
  await browser.close();
  process.exit(0);
}

// Fresh start: the test project's edit history is cleared first (test data only).
await admin.from("long_form_edits").delete().eq("project_id", TEST_PROJECT);
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-preview").waitFor({ timeout: 40000 });
await waitSaved();
await page.waitForTimeout(2500);
let e0 = await lastEdit();
step("opened", { version: e0?.version, clips: e0?.doc.clips.length, texts: e0?.doc.texts.length });
await shot("1-editor");

// 1. Move a cut: drag the cut before clip 3 by +60 px.
const cutBefore = e0.doc.clips[2].startMs;
const h = page.getByTestId("cut-handle").nth(1); // handles start at clip index 1
const hb = await h.boundingBox();
await page.mouse.move(hb.x + 3, hb.y + hb.height / 2);
await page.mouse.down();
await page.mouse.move(hb.x + 40, hb.y + hb.height / 2, { steps: 8 });
await page.mouse.move(hb.x + 63, hb.y + hb.height / 2, { steps: 4 });
await page.mouse.up();
await waitSaved();
let e1 = await lastEdit();
step("move cut", { before: cutBefore, after: e1.doc.clips[2].startMs, prevClipMs: e1.doc.clips[2].startMs - e1.doc.clips[1].startMs, version: e1.version });

// 2. Split the scene at ~20 s (S key).
await seekTo(20);
await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.keyboard.press("s");
await waitSaved();
let e2 = await lastEdit();
const half = e2.doc.clips.find((c) => c.needsImage);
step("split", { clipsBefore: e1.doc.clips.length, clipsAfter: e2.doc.clips.length, newHalfAt: half?.startMs, generateButton: await page.getByTestId("generate-split").isVisible() });
await shot("2-split");

// 3. Each text style at the playhead.
const styles = ["HEADLINE", "BIG_STAT", "QUESTION", "CALLOUT"];
for (const [k, s] of styles.entries()) {
  await seekTo(30 + k * 4);
  await page.getByTestId("tab-text").click();
  await page.getByTestId(`add-text-${s}`).click();
  await page.waitForTimeout(300);
}
await waitSaved();
let e3 = await lastEdit();
step("text styles", { added: e3.doc.texts.filter((x) => x.startMs >= 29000 && x.startMs < 47000).map((x) => x.style) });
await seekTo(35);
await shot("3-bigstat");
await seekTo(43);
await shot("4-callout");

// 4. Captions on (bold highlight).
await page.getByTestId("tab-captions").click();
await page.getByTestId("captions-toggle").check();
await waitSaved();
await seekTo(12.3);
await shot("5-captions");
step("captions", { enabled: (await lastEdit()).doc.captions.enabled, onScreen: await page.getByTestId("preview-caption").count() });

// 5. Change a motion (clip 1 -> pan left).
await page.getByTestId("timeline-clip").first().click({ position: { x: 20, y: 10 } });
await page.getByTestId("motion-pan_left").click();
await waitSaved();
step("motion", { clip1: (await lastEdit()).doc.clips[0].motion });
await shot("6-scene-props");

// 6. Undo / redo.
await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.keyboard.press("Control+z");
await waitSaved();
const afterUndo = (await lastEdit()).doc.clips[0].motion;
await page.keyboard.press("Control+Shift+z");
await waitSaved();
const afterRedo = (await lastEdit()).doc.clips[0].motion;
step("undo/redo", { afterUndo, afterRedo });

// 7. Reload: everything comes back from the autosave.
const before = await lastEdit();
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByTestId("edit-preview").waitFor({ timeout: 40000 });
await page.waitForTimeout(2500);
step("reload", { version: before.version, clips: await page.getByTestId("timeline-clip").count(), savedClips: before.doc.clips.length, texts: before.doc.texts.length, captions: before.doc.captions.enabled, motion: before.doc.clips[0].motion });
await page.getByTestId("tab-script").click();
await page.waitForTimeout(500);
await shot("7-after-reload-script");
fs.writeFileSync(`${OUT}/edit-doc.json`, JSON.stringify(before.doc, null, 1));
out.errors = errors;
console.log(JSON.stringify({ errors }, null, 1));
fs.writeFileSync(`${OUT}/test-result.json`, JSON.stringify(out, null, 1));
await browser.close();
