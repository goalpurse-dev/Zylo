// deno-lint-ignore-file no-explicit-any
// build-stickman-beat-plan/index.ts — Phase 2a Beat Director (Stickman only).
//
// POST { projectId } (project owner's JWT). Builds a new versioned beat plan
// from the project's current script + its frozen Production Bible, using
// real word timings when a ready narration audio exists for that script and
// synthetic timings otherwise. Responds 202 immediately and runs the
// director in the background (a full plan is several sequential Sonnet 5
// calls — never held on one request against the platform's 150 s limit).
// Poll long_form_beat_plan_versions.status: building -> ready |
// ready_with_warnings (per-beat warnings in long_form_beats.warnings) | failed
// (| check_only for window-limited check runs on test projects).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUserOrAutopilot } from "../shared/auth.ts";
import { runBeatDirector, anthropicModelCall, sonnetCostUsd, BEAT_DIRECTOR_MODEL, planCostCapUsd } from "../_shared/stickman/beatDirector.ts";
import { wordsPerMinuteForProfile } from "../../../src/lib/voicePace.ts";
import { recordCost } from "../_shared/costLedger.ts";
import { pickHeadlines, acceptHeadlines, applyTextPass, HEADLINE_MODEL } from "../_shared/stickman/headlines.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

// Recording for offline replay: env-gated AND only for internal test
// projects (owner email on the test domain every harness creates). Real users
// are never recorded — their calls aren't even captured (per-call hook, no
// global fetch patching, so a concurrent test run can't pick them up either).
const RECORD = (Deno.env.get("LONG_FORM_BEAT_RECORD_CASSETTES") ?? "").trim().toLowerCase() === "true";
export const TEST_PROJECT_EMAIL_DOMAIN = "@zyvo-internal.test";

async function isTestProject(admin: any, projectId: string): Promise<boolean> {
  const { data: project } = await admin.from("long_form_projects").select("user_id").eq("id", projectId).maybeSingle();
  if (!project?.user_id) return false;
  const { data } = await admin.auth.admin.getUserById(project.user_id);
  return String(data?.user?.email ?? "").toLowerCase().endsWith(TEST_PROJECT_EMAIL_DOMAIN);
}

// Yield between windows after this long, so one invocation (window time
// incl. a repair ~180s at most) always ends well inside the ~400s wall clock.
const YIELD_AFTER_MS = 150_000;
// Hard cap per plan (cumulative across yields/resumes), checked before every call.
const MAX_COST_USD = Number(Deno.env.get("LONG_FORM_BEAT_MAX_COST_USD") ?? 0.6);
const SELF_URL = `${SUPABASE_URL}/functions/v1/build-stickman-beat-plan`;

// Check runs (test projects only): direct the first `maxWindows` windows under
// a tighter per-plan cap; the partial plan is stored as 'check_only'.
type CheckOpts = { maxWindows?: number; maxCostUsd?: number };

async function buildInBackground(admin: any, planId: string, projectId: string, input: { segments: any[]; sections?: Record<string, string>; bible: any; narration: any[] | null; callback: any; wordsPerMinute?: number }, resume: any | null, startedAt: number, check: CheckOpts = {}) {
  const t0 = Date.now();
  const record = RECORD && (await isTestProject(admin, projectId));
  const entries: any[] = [];
  const onExchange = record ? (e: any) => entries.push({ ...e, seq: entries.length, stage: "beat_director" }) : undefined;
  try {
    const result: any = await runBeatDirector({ ...input, sectionOfSegment: input.sections, callModel: anthropicModelCall(ANTHROPIC_KEY, BEAT_DIRECTOR_MODEL, 150_000, onExchange), resume, shouldYield: () => Date.now() - t0 > YIELD_AFTER_MS, maxCostUsd: check.maxCostUsd ?? planCostCapUsd(input.segments.reduce((n: number, s: any) => n + String(s.text ?? "").split(/\s+/).filter(Boolean).length, 0), MAX_COST_USD), costOf: sonnetCostUsd, maxWindows: check.maxWindows });
    const cost = sonnetCostUsd(result.usage);
    if (result.yielded) {
      await admin.from("long_form_beat_plan_versions").update({ stats: { resume: result.resume, startedAt, check }, estimated_model_cost_usd: cost }).eq("id", planId);
      await fetch(SELF_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ continuePlanId: planId }) });
      return;
    }
    // Cost ledger: one row per finished plan (usage is cumulative across yields).
    const ledger = () => recordCost(admin, { projectId, stage: "beats", provider: "anthropic", model: BEAT_DIRECTOR_MODEL, units: { calls: result.usage.calls, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadTokens: result.usage.cacheReadTokens, cacheWriteTokens: result.usage.cacheWriteTokens }, usd: cost, estimated: false, sourceTable: "long_form_beat_plan_versions", sourceId: planId });
    await ledger();
    if (!result.ok) {
      await admin.from("long_form_beat_plan_versions").update({
        status: "failed", error_code: result.errorCode, timing_source: result.timingSource, estimated_model_cost_usd: cost,
        error_detail: { window: result.window ?? null, issues: result.issues, partialBeatCount: result.partialBeats.length },
        stats: { windows: result.windows, repairs: result.repairs, usage: result.usage, latencyMs: Date.now() - startedAt },
        completed_at: new Date().toISOString(),
      }).eq("id", planId);
      return;
    }
    // Phase 6c-polish: the on-screen text pass — tops the plan up to the
    // project's text density with HEADLINE beats and classifies the director's
    // own text beats (HEADLINE vs IN_SCENE). Never fails the plan.
    let textPass: any = null;
    try {
      const { data: proj } = await admin.from("long_form_projects").select("on_screen_text_density").eq("id", projectId).maybeSingle();
      const density = proj?.on_screen_text_density ?? "balanced";
      const picked = await pickHeadlines(OPENAI_KEY, result.beats, density);
      const acc = acceptHeadlines(result.beats, picked.picks, density);
      result.beats = applyTextPass(result.beats, acc.accepted);
      textPass = { density, target: acc.target, total: acc.total, added: acc.accepted.length, rejected: acc.rejected.length, costUsd: picked.costUsd };
      if (picked.costUsd) await recordCost(admin, { projectId, stage: "beats", provider: "openai", model: HEADLINE_MODEL, units: { ...picked.usage, purpose: "on_screen_text" } as any, usd: picked.costUsd, estimated: false, sourceTable: "long_form_beat_plan_versions", sourceId: planId });
    } catch (e) {
      console.error("[build-stickman-beat-plan] text pass skipped:", String(e).slice(0, 200));
      result.beats = applyTextPass(result.beats, []);
    }
    const rows = result.beats.map((b: any) => ({
      beat_plan_version_id: planId, sequence: b.sequence, start_word: b.startWord, end_word: b.endWord,
      narration_text: b.narrationText, start_ms: b.startMs, end_ms: b.endMs, contract: b.contract, warnings: b.warnings ?? [],
    }));
    const { error: insertError } = await admin.from("long_form_beats").insert(rows);
    if (insertError) throw new Error(`beat insert failed: ${insertError.message}`);
    // Quality rules never fail a paid run: leftover SOFT warnings (per beat) or
    // plan-level warnings mark the plan for review instead.
    const hasWarnings = result.beats.some((b: any) => b.warnings?.length) || result.validation.warn.length > 0;
    await admin.from("long_form_beat_plan_versions").update({
      status: result.stats.partial ? "check_only" : hasWarnings ? "ready_with_warnings" : "ready", timing_source: result.timingSource, estimated_model_cost_usd: cost,
      stats: { ...result.stats, textPass, usage: result.usage, latencyMs: Date.now() - startedAt, bibleIndex: result.bibleIndex, syntheticWpm: result.timingSource === "synthetic" ? input.wordsPerMinute ?? null : null },
      validation: result.validation, completed_at: new Date().toISOString(),
    }).eq("id", planId);
  } catch (e) {
    await admin.from("long_form_beat_plan_versions").update({
      status: "failed", error_code: "DIRECTOR_ERROR", error_detail: { message: String(e).slice(0, 1000) }, completed_at: new Date().toISOString(),
    }).eq("id", planId);
  } finally {
    if (record && entries.length) {
      const payload = JSON.stringify({ beatPlanVersionId: planId, recordedAt: new Date().toISOString(), entries });
      await admin.storage.from("script-cassettes").upload(`beatplan/${planId}/${Date.now()}.json`, new Blob([payload], { type: "application/json" }), { contentType: "application/json", upsert: true });
    }
  }
}

function callbackOf(doc: any) {
  return {
    key: doc?.callbackKey ?? null,
    plantSegmentId: doc?.plantSegmentIndex != null ? doc.narrationSegments?.[doc.plantSegmentIndex]?.id ?? null : null,
    payoffSegmentId: doc?.payoffSegmentIndex != null ? doc.narrationSegments?.[doc.payoffSegmentIndex]?.id ?? null : null,
  };
}

// Re-loads exactly the inputs a plan was started with (by its stored ids).
async function loadInput(admin: any, plan: any) {
  const { data: script } = await admin.from("long_form_script_versions").select("script_document").eq("id", plan.script_version_id).single();
  const { data: bible } = await admin.from("long_form_production_bibles").select("bible").eq("id", plan.production_bible_id).single();
  const audio = plan.narration_audio_version_id
    ? (await admin.from("long_form_narration_audio_versions").select("narration").eq("id", plan.narration_audio_version_id).single()).data
    : null;
  const doc = script.script_document;
  const { data: profile } = await admin.from("long_form_generation_profiles").select("voice_id, voice_model, voice_settings").eq("project_id", plan.project_id).eq("status", "active").maybeSingle();
  return { segments: doc.narrationSegments.map((s: any) => ({ id: s.id, text: s.text })), sections: Object.fromEntries(doc.narrationSegments.map((s: any) => [s.id, s.chapterId ?? s.id])), bible: bible.bible, narration: audio?.narration ?? null, callback: callbackOf(doc), wordsPerMinute: wordsPerMinuteForProfile(profile).wordsPerMinute };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  if (!ANTHROPIC_KEY) return err(req, "ANTHROPIC_API_KEY not configured", 500);

  const body = await req.json().catch(() => ({}));
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Continuation of a yielded build (self-invoked with the service key).
  if (body?.continuePlanId) {
    if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return err(req, "Unauthorized", 401);
    const { data: plan } = await admin.from("long_form_beat_plan_versions").select("*").eq("id", body.continuePlanId).maybeSingle();
    if (!plan || plan.status !== "building" || !plan.stats?.resume) return err(req, "Nothing to continue", 409);
    const input = await loadInput(admin, plan);
    const work = buildInBackground(admin, plan.id, plan.project_id, input, plan.stats.resume, plan.stats.startedAt ?? Date.now(), plan.stats.check ?? {});
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(work);
    else await work;
    return ok(req, { ok: true, continued: plan.id }, 202);
  }

  const { user, authError } = await requireUserOrAutopilot(req, body); // Phase 6c: the Scenes autopilot builds the plan
  if (!user) return err(req, authError || "Unauthorized", 401);
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const { data: profile } = await admin.from("long_form_generation_profiles").select("*").eq("project_id", projectId).eq("status", "active").maybeSingle();
  if (profile?.visual_recipe !== "stickman_doodle_explainer") return err(req, "The Beat Director only supports the Stickman recipe.", 409);
  if (!project.current_script_version_id) return err(req, "This project has no script yet.", 409);

  const { data: script } = await admin.from("long_form_script_versions").select("id, script_document").eq("id", project.current_script_version_id).maybeSingle();
  const segments = (script?.script_document?.narrationSegments ?? []).map((s: any) => ({ id: s.id, text: s.text }));
  if (!segments.length) return err(req, "The script has no narration segments.", 422);

  const { data: bible } = await admin.from("long_form_production_bibles").select("id, bible").eq("project_id", projectId).eq("script_version_id", script.id).eq("status", "frozen").maybeSingle();
  if (!bible) return err(req, "Build the Production Bible for this script first.", 409);

  const { data: audio } = await admin
    .from("long_form_narration_audio_versions").select("id, narration")
    .eq("project_id", projectId).eq("script_version_id", script.id).eq("status", "ready")
    .order("version", { ascending: false }).limit(1).maybeSingle();

  const callback = callbackOf(script.script_document);

  // Check-run options are honoured for internal test projects only.
  const check: CheckOpts = {};
  if (body?.maxWindows != null || body?.maxCostUsd != null) {
    if (!(await isTestProject(admin, projectId))) return err(req, "Check runs are only available for test projects.", 403);
    if (body.maxWindows != null) check.maxWindows = Math.max(1, Math.floor(Number(body.maxWindows)));
    if (body.maxCostUsd != null) check.maxCostUsd = Number(body.maxCostUsd);
  }

  const { data: latest } = await admin.from("long_form_beat_plan_versions").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data: plan, error: planError } = await admin.from("long_form_beat_plan_versions").insert({
    project_id: projectId, script_version_id: script.id, production_bible_id: bible.id, narration_audio_version_id: audio?.id ?? null,
    version: (latest?.version ?? 0) + 1, status: "building", director_model: BEAT_DIRECTOR_MODEL,
  }).select("id, version").single();
  if (planError) return err(req, "Could not create the beat plan.", 500);

  // Synthetic timings (no narration yet) run at the selected voice's measured pace.
  const pace = wordsPerMinuteForProfile(profile);
  const sections = Object.fromEntries((script?.script_document?.narrationSegments ?? []).map((s: any) => [s.id, s.chapterId ?? s.id]));
  const work = buildInBackground(admin, plan.id, projectId, { segments, sections, bible: bible.bible, narration: audio?.narration ?? null, callback, wordsPerMinute: pace.wordsPerMinute }, null, Date.now(), check);
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work);
  else await work;

  return ok(req, { ok: true, beatPlanVersionId: plan.id, version: plan.version, status: "building", timingSource: audio ? "real" : "synthetic" }, 202);
});
