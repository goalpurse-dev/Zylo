// Phase 6c — ONE real end-to-end Stickman project on the internal test account
// (paid; cap $1.40 + ~1,500 ElevenLabs credits). Drives the REAL Create page
// in Chrome: niche, topic, 8 min, V2, a voice picked in "6 · Voice", Generate.
// Then it only waits — the autopilot runs plan -> research -> script -> voice
// by itself; at "Listen & change" it clicks the designed "Continue to Scenes →"
// and waits for the finished Scenes review. A spend guard stops the run
// (autopilot failed + queued scenes failed) if the ledger passes the cap.
//   node --env-file=.env.local scripts/phase6cE2E.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

const BASE = "http://localhost:5173";
const CAP_USD = 1.4;
const VOICE = { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" };
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const OUT = "docs/phase6c/e2e";
await mkdir(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);

const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: BASE }]);
await ctx.addInitScript(([k, v, w, r]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

// ---- Step 1 on the real Create page ----
await page.goto(`${BASE}/long-form/create`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
if (await page.getByText("Choose your niche").count()) await page.getByText("Choose your niche").click();
else await page.getByText("Change", { exact: true }).first().click();
await page.getByText("Everyday Science", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.locator("textarea").first().fill("Why is ice so slippery? The surprising science of the thin layer on top");
await page.getByRole("button", { name: "8 min", exact: true }).click();
await page.getByRole("button", { name: /V2 Fast/ }).click();
await page.getByTestId("choose-voice").click();
await page.getByTestId("voice-library").waitFor();
await page.locator(`[data-voice-id="${VOICE.id}"]`).getByRole("button", { name: "Use this voice" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/1-create-filled.png` });
const gen = page.getByRole("button", { name: /Generate video/ }).last();
await gen.click();
await page.waitForURL(/\/writing/, { timeout: 60000 });
const projectId = page.url().match(/project\/([0-9a-f-]{36})/)[1];
log("Generate ->", projectId);

// ---- spend guard (ledger) ----
let stopped = null;
const spend = async () => {
  const { data } = await admin.from("long_form_cost_ledger").select("stage, provider, usd, units").eq("project_id", projectId);
  const by = {};
  let total = 0;
  for (const r of data ?? []) { const k = `${r.provider}:${r.stage}`; by[k] = Number(((by[k] ?? 0) + Number(r.usd ?? 0)).toFixed(5)); if (r.provider !== "elevenlabs") total += Number(r.usd ?? 0); }
  // Research + script record their cost on the row (not the ledger); the story plan records none -> a fixed margin.
  const { data: rv } = await admin.from("long_form_research_versions").select("meta").eq("project_id", projectId);
  const { data: sv } = await admin.from("long_form_script_versions").select("meta").eq("project_id", projectId);
  by["research(meta)"] = Number((rv ?? []).reduce((a, x) => a + Number(x.meta?.estimatedTotalCostUsd ?? 0), 0).toFixed(4));
  by["script(meta)"] = Number((sv ?? []).reduce((a, x) => a + Number(x.meta?.estimatedTotalCostUsd ?? 0), 0).toFixed(4));
  by["storyPlan(margin)"] = 0.06;
  total += by["research(meta)"] + by["script(meta)"] + by["storyPlan(margin)"];
  return { total: Number(total.toFixed(4)), by };
};
const guard = setInterval(async () => {
  const s = await spend();
  if (s.total > CAP_USD && !stopped) {
    stopped = `spend ${s.total} > cap ${CAP_USD}`;
    log("STOP:", stopped);
    const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", projectId).single();
    await admin.from("long_form_projects").update({ autopilot: { ...p.autopilot, status: "failed", failedReason: "e2e spend cap" } }).eq("id", projectId);
    await admin.from("long_form_scene_images").update({ status: "failed", error: "e2e spend cap" }).eq("project_id", projectId).eq("status", "queued");
  }
}, 30000);

// ---- wait: plan -> research -> script -> voice (no clicks) ----
await page.waitForTimeout(60000);
await page.screenshot({ path: `${OUT}/2-writing.png` });
await page.waitForURL(/\/narration/, { timeout: 30 * 60000 });
log("reached the Voice step");
await page.getByText("Listen & change").waitFor({ timeout: 10 * 60000 });
const voiceReadyAt = Date.now();
log("narration ready");
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/3-listen-and-change.png` });

// ---- the designed click: Continue to Scenes ----
await page.getByRole("button", { name: /Continue to Scenes/ }).click();
await page.waitForURL(/\/scenes/, { timeout: 60000 });
const scenesStart = Date.now();
log("Continue to Scenes");
await page.waitForTimeout(150000);
await page.screenshot({ path: `${OUT}/4-building.png` });
await page.getByTestId("scenes-list").waitFor({ timeout: 45 * 60000 });
const reviewAt = Date.now();
log("Scenes review reached");
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/5-scenes-review.png` });
await page.getByTestId("scenes-list").evaluate((el) => { el.scrollTop = el.scrollHeight / 2; });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/6-scenes-review-middle.png` });
clearInterval(guard);
await browser.close();

// ---- report from the rows ----
const iso = (ms) => new Date(ms).toISOString();
const sec = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 1000) : null);
const { data: p } = await admin.from("long_form_projects").select("autopilot, current_story_plan_version_id, current_script_version_id").eq("id", projectId).single();
const { data: plan } = await admin.from("long_form_story_plan_versions").select("created_at").eq("id", p.current_story_plan_version_id).single();
const { data: r } = await admin.from("long_form_research_versions").select("status, research_started_at, research_completed_at").eq("project_id", projectId).order("version", { ascending: false }).limit(1).single();
const { data: s } = await admin.from("long_form_script_versions").select("status, created_at, stage_started_at, locked_at, script_document").eq("id", p.current_script_version_id).single();
const { data: n } = await admin.from("long_form_narration_audio_versions").select("created_at, ready_at, audio_duration_seconds, provider_metadata").eq("project_id", projectId).order("version", { ascending: false }).limit(1).single();
const { data: bp } = await admin.from("long_form_beat_plan_versions").select("created_at, completed_at, status, stats").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).single();
const { data: imgs } = await admin.from("long_form_scene_images").select("status, started_at, ready_at, cost_usd, credits_charged, qa, attempts").eq("project_id", projectId).eq("is_current", true);
const { data: res } = await admin.from("long_form_project_reservations").select("status, reserved_credits, committed_credits, released_credits").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).single();
const ready = (imgs ?? []).filter((i) => i.status === "ready");
const firstStart = (imgs ?? []).map((i) => i.started_at).filter(Boolean).sort()[0];
const lastReady = ready.map((i) => i.ready_at).sort().slice(-1)[0];
const med = (a) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const timingKeys = ["renderMs", "fetchOriginalMs", "codeCheckMs", "upscaleMs", "fetchMasterMs", "overlayMs", "uploadMs"];
const report = {
  projectId, stopped, errors: errors.slice(0, 8),
  timingsS: {
    storyPlan: sec(iso(t0), plan.created_at), research: sec(r.research_started_at, r.research_completed_at), script: sec(s.created_at, s.stage_started_at),
    generateToVoiceReady: Math.round((voiceReadyAt - t0) / 1000), narration: sec(n.created_at, n.ready_at),
    beatPlan: sec(bp.created_at, bp.completed_at), drawing: sec(firstStart, lastReady), continueToReview: Math.round((reviewAt - scenesStart) / 1000), total: Math.round((reviewAt - t0) / 1000),
  },
  scenes: { total: imgs?.length, ready: ready.length, failed: (imgs ?? []).filter((i) => i.status === "failed").length, retried: (imgs ?? []).filter((i) => i.attempts > 1).length, medianWorkerS: med(ready.map((i) => i.qa?.wallMs / 1000)), medianStepMs: Object.fromEntries(timingKeys.map((k) => [k, med(ready.map((i) => i.qa?.timings?.[k]))])) },
  voice: VOICE.name, words: s.script_document?.actualWords, audioS: Number(n.audio_duration_seconds), elevenLabsCredits: n.provider_metadata?.providerCharacterCost, characters: n.provider_metadata?.characterCount,
  spend: await spend(), imagesUsd: Number(ready.reduce((a, i) => a + Number(i.cost_usd), 0).toFixed(4)),
  reservation: res, creditsDrawnByScenes: (imgs ?? []).reduce((a, i) => a + (i.credits_charged ?? 0), 0),
  resumes: p.autopilot?.resumeLog ?? [], scenesRun: p.autopilot?.scenes,
};
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
