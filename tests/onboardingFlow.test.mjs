// The new-user flow: the free preview's rules, the worker's cut, and the guarantees that live in code and SQL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PREVIEW, previewDecision, topicsForGoals } from "../supabase/functions/_shared/cutaway/freePreview.js";
import { failOrRetry, onEvent } from "../supabase/functions/_shared/cutaway/orchestrate.js";
import { jobFor } from "../supabase/functions/_shared/cutaway/jobs.js";
import { previewCutSec } from "../scripts/cutaway/proto3d/m3/previewCut.mjs";

const read = (f) => readFileSync(f, "utf8");
const allowed = { switchOn: true, enrolled: true, plan: "free", existing: null, ipCount: 0, deviceCount: 0, spent24h: 0, capUsd: 10, hasPlan: true };

test("a free preview needs the switch and the rollout", () => {
  assert.equal(previewDecision(allowed).ok, true);
  assert.equal(previewDecision({ ...allowed, switchOn: false }).code, "OFF");
  assert.equal(previewDecision({ ...allowed, enrolled: false }).code, "OFF");
});

test("one per account; a failed one is given back; paid plans make full videos", () => {
  assert.equal(previewDecision({ ...allowed, existing: { status: "ready" } }).code, "PREVIEW_USED");
  assert.equal(previewDecision({ ...allowed, existing: { status: "reserved" } }).code, "PREVIEW_USED");
  assert.equal(previewDecision({ ...allowed, existing: { status: "failed" } }).ok, true);
  assert.equal(previewDecision({ ...allowed, plan: "starter" }).code, "UPGRADE");
});

test("2 per network or browser in the window, and its own daily cap", () => {
  assert.equal(previewDecision({ ...allowed, ipCount: PREVIEW.ipLimit - 1 }).ok, true);
  assert.equal(previewDecision({ ...allowed, ipCount: PREVIEW.ipLimit }).code, "PREVIEW_LIMIT");
  assert.equal(previewDecision({ ...allowed, deviceCount: PREVIEW.deviceLimit }).code, "PREVIEW_LIMIT");
  assert.equal(previewDecision({ ...allowed, spent24h: 9.99 }).code, "BUSY");
  assert.equal(PREVIEW.ipLimit, 2);
});

test("the survey's first answer orders the topics, three of the approved ones", () => {
  assert.deepEqual(topicsForGoals(["business"]), ["car_wash", "swimming_pool", "french_drain"]);
  assert.deepEqual(topicsForGoals([]), ["landfill", "car_wash", "swimming_pool"]);
  assert.equal(topicsForGoals(["faceless", "business"])[0], "landfill");
});

test("the clip stops at the end of a word, about 10 s in", () => {
  const words = [{ w: "a", s: 8.2, e: 8.9 }, { w: "b", s: 9, e: 10.4 }, { w: "c", s: 10.5, e: 12 }];
  assert.equal(previewCutSec(words, 10), 10.55);
  assert.equal(previewCutSec([], 10), 10.15);
  assert.ok(previewCutSec([{ e: 40 }], 10) >= 8);
});

test("a preview's job asks for the first seconds only and has no full file", () => {
  const urls = { planGet: { layout: "x" }, frames: [], final: "F", web: "W", poster: "P" };
  const run = { id: "r", user_id: "u", topic: "t", length_sec: 30, kind: "premade", plan_ready: true, free_preview: true };
  const job = jobFor(run, { role: "video", mode: "gpu", urls, callback: { url: "c", token: "t" } });
  assert.equal(job.previewSec, PREVIEW.seconds);
  assert.equal(job.out.final, undefined);
  assert.equal(job.out.web, "W");
  const full = jobFor({ ...run, free_preview: false }, { role: "video", mode: "gpu", urls, callback: { url: "c", token: "t" } });
  assert.equal(full.previewSec, undefined);
  assert.equal(full.out.final, "F");
});

test("a failed free preview never reaches the CPU fallback, and is given back", () => {
  const run = { id: "r", topic: "t", status: "render", provider: "runpod", provider_job_id: "j", attempt: 2, free_preview: true };
  const r = failOrRetry(run, { code: "NO_GPU_SLOT", message: "no GPU" });
  assert.equal(r.patch.status, "failed");
  assert.ok(r.actions.some((a) => a.type === "releasePreview"));
  assert.equal(r.patch.provider, undefined);
  const paying = failOrRetry({ ...run, free_preview: false }, { code: "NO_GPU_SLOT", message: "no GPU" });
  assert.equal(paying.patch.provider, "fly", "a paying customer's video keeps its fallback");
});

test("finishing reports to the funnel: the preview ready, and the gift video done", () => {
  const base = { id: "r", status: "render", attempt: 1, provider: "runpod" };
  assert.ok(onEvent({ ...base, free_preview: true }, { event: "done", attempt: 1 }).actions.some((a) => a.type === "previewDone"));
  assert.ok(onEvent({ ...base, gift_finish: true }, { event: "done", attempt: 1 }).actions.some((a) => a.type === "finishDone"));
  assert.ok(!onEvent(base, { event: "done", attempt: 1 }).actions.some((a) => ["previewDone", "finishDone"].includes(a.type)));
});

test("the database: one preview per account on the server, consent never turned off, events the browser can't fake", () => {
  const sql = read("supabase/migrations/20261130100000_onboarding_first_video.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.cutaway_free_previews \(\s*user_id\s+uuid PRIMARY KEY/);
  assert.match(sql, /REVOKE ALL ON public\.cutaway_free_previews FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /UPDATE public\.profiles SET email_updates = false WHERE id = v_user AND email_updates IS NULL/);
  const browserList = sql.match(/IF p_event NOT IN \(([^)]*)\)/)[1];
  for (const server of ["preview_generated", "upgraded", "full_video_completed_after_upgrade"]) assert.ok(!browserList.includes(server), `${server} comes from the server only`);
  for (const e of ["signed_up", "survey_answer", "survey_completed", "survey_skipped", "tutorial_started", "tutorial_step_completed", "preview_watched_to_end", "tutorial_skipped", "upgrade_screen_shown"]) assert.ok(browserList.includes(e), e);
  assert.match(sql, /rollout_percent\s+integer NOT NULL DEFAULT 0/);
  assert.match(sql, /free_preview_on\s+boolean NOT NULL DEFAULT false/);
});

test("the page: the free line at step 1, a tap for sound, no download on the preview", () => {
  const page = read("src/pages/onboarding/FirstVideo.jsx");
  assert.match(page, /free 10-second preview/);
  assert.match(page, /Tap for sound/);
  assert.match(page, /Your video is finished 🎉/);
  assert.match(page, /controlsList="nodownload"/);
  const runtime = read("supabase/functions/_shared/cutaway/runtime.ts");
  assert.match(runtime, /downloadUrl: done && !run\.free_preview/);
  assert.match(runtime, /credits_charged: 0/);
});

test("every sign-up route is named, the welcome email has one trigger, and consent can't turn someone off", () => {
  assert.match(read("src/components/AuthModal.jsx"), /rememberSignupRoute\(signupRoute\("google"\)\)/);
  assert.match(read("src/components/AuthModal.jsx"), /rememberSignupRoute\(signupRoute\("email"\)\)/);
  assert.match(read("src/pages/Signup.jsx"), /signup_page_email/);
  assert.match(read("src/pages/Signup.jsx"), /signup_page_google/);
  assert.match(read("src/components/onboarding/OnboardingGate.jsx"), /send-welcome-email/);
  assert.doesNotMatch(read("src/lib/auth.js"), /functions\.invoke\("send-welcome-email"/);
  assert.doesNotMatch(read("src/components/WelcomeScreen.jsx"), /update\(\{ email_updates/);
  assert.match(read("supabase/functions/send-welcome-email/index.ts"), /const WELCOME_PAUSED = true/);
  assert.match(read("supabase/functions/_shared/welcomeEmail.js"), /5 free image generations/);
});
