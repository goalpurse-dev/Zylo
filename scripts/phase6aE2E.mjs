// Phase 6a — ONE real end-to-end check of the Stickman autopilot (paid).
// Acts as the internal test user (@zyvo-internal.test, admin magic-link
// session): the same calls "Generate video" makes (discovery session ->
// project -> production setup/reservation -> start autopilot), then opens the
// real /writing page in Chrome and does NOTHING until the page itself moves
// to /script-review. Screenshots the progress screen and the review page.
// Usage: node --env-file=.env.local scripts/phase6aE2E.mjs [baseUrl]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

// --attach <projectId>: re-open the browser on an already-started run (no new spend).
const ai = process.argv.indexOf("--attach");
const ATTACH = ai >= 0 ? process.argv[ai + 1] : null;
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:5173";
const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const OUT = "docs/phase6a";
await mkdir(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// 1. A real user session for the internal test account.
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
if (linkErr) throw linkErr;
const userClient = createClient(URL_, ANON, { auth: { persistSession: false } });
const { data: sess, error: otpErr } = await userClient.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (otpErr) throw otpErr;
const call = async (fn, body) => {
  const { data, error } = await userClient.functions.invoke(fn, { body });
  if (error) { let b = null; try { b = await error.context.json(); } catch {} throw new Error(`${fn}: ${error.message} ${JSON.stringify(b)}`); }
  return data;
};

// 2. The same sequence as ProductionSetup's "Generate video".
let project, t0;
if (ATTACH) {
  project = { id: ATTACH };
  const { data: ap } = await admin.from("long_form_projects").select("autopilot").eq("id", ATTACH).single();
  t0 = Date.parse(ap.autopilot.startedAt);
  log(`attached to ${ATTACH} (started ${ap.autopilot.startedAt})`);
} else {
const quote = await call("quote-long-form-project", { recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1", renderTier: "v3", targetDurationMinutes: 8 });
const { data: prof } = await admin.from("profiles").select("credits").eq("id", TEST_USER).single();
const topUp = 0; // reservations draw from the real credit balance, not profiles.credits (the 6a run found this)
if (topUp > 0) await admin.from("profiles").update({ credits: (prof?.credits ?? 0) + topUp }).eq("id", TEST_USER);
log(`quote ${quote.totalCredits} credits; internal test account topped up by ${topUp}`);
const session = await call("create-long-form-discovery-session", {});
project = await call("create-long-form-project", {
  discoverySessionId: session.id ?? session.session?.id, topic: "How did ancient humans hunt", source: "custom",
  lengthMode: "custom", customLengthMinutes: 8, depthMode: "custom", customExplanationDepth: "balanced", onScreenTextDensity: "balanced", initialStatus: "draft",
});
await call("create-long-form-production-setup", {
  projectId: project.id, visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1", renderTier: "v3", targetDurationMinutes: 8,
  explanationDepth: "balanced", voiceProvider: "elevenlabs", voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5", niche: "history",
});
t0 = Date.now();
await call("start-long-form-autopilot", { projectId: project.id });
log(`project ${project.id}: Generate -> autopilot started`);
}

// 3. The real page, no clicks: wait for it to move itself to the review.
const ref = new URL(URL_).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
// The session + "welcome already seen" (a first login shows a full-screen welcome over every page).
await ctx.addInitScript(([k, v, w]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`]);
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
await page.goto(`${BASE}/long-form/project/${project.id}/writing`, { waitUntil: "domcontentloaded" });
const shots = [];
for (const [at, name] of [[45, "progress-early"], [150, "progress-facts"], [330, "progress-writing"]]) {
  const wait = at * 1000 - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  if (page.url().includes("script-review")) break;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  shots.push(name);
  log(`screenshot ${name} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
await page.waitForURL(/script-review/, { timeout: 25 * 60 * 1000 });
const reviewAt = Date.now();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/review-top.png` });
await page.screenshot({ path: `${OUT}/review-full.png`, fullPage: true });
log(`review page reached after ${Math.round((reviewAt - t0) / 1000)} s — no clicks`);
await browser.close();

// 4. Per-stage timings + spend from the rows.
const { data: p } = await admin.from("long_form_projects").select("autopilot, current_story_plan_version_id, created_at").eq("id", project.id).single();
const { data: plan } = await admin.from("long_form_story_plan_versions").select("created_at").eq("id", p.current_story_plan_version_id).single();
const { data: r } = await admin.from("long_form_research_versions").select("status, research_started_at, research_completed_at, meta").eq("project_id", project.id).order("version", { ascending: false }).limit(1).single();
const { data: s } = await admin.from("long_form_script_versions").select("status, created_at, stage_started_at, meta, script_document").eq("project_id", project.id).order("created_at", { ascending: false }).limit(1).single();
const sec = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 1000);
const start = new Date(t0).toISOString();
const report = {
  projectId: project.id,
  timings: {
    planS: sec(start, plan.created_at),
    gapPlanToResearchS: sec(plan.created_at, r.research_started_at),
    researchS: sec(r.research_started_at, r.research_completed_at),
    gapResearchToScriptS: sec(r.research_completed_at, s.created_at),
    scriptS: sec(s.created_at, s.stage_started_at),
    totalToReviewS: Math.round((reviewAt - t0) / 1000),
  },
  statuses: { research: r.status, script: s.status, autopilot: p.autopilot?.status, resumes: p.autopilot?.resumes },
  spendUsd: { research: r.meta?.estimatedTotalCostUsd ?? null, script: s.meta?.estimatedTotalCostUsd ?? null },
  words: s.script_document?.actualWords ?? null,
  screenshots: [...shots, "review-top", "review-full"],
  consoleErrors: consoleErrors.slice(0, 10),
};
await writeFile(`${OUT}/e2e-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
