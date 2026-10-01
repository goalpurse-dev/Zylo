// deno-lint-ignore-file no-explicit-any
// advance-long-form-autopilot/index.ts — internal (x-autopilot-secret) (Phase 6a).
// Moves each running Stickman autopilot one step: story plan -> research-lite
// -> script -> done, and re-dispatches a stalled stage from its checkpoint
// (decideAutopilot). Called by the 1-minute cron sweep (no body) and by every
// stage as it finishes (body { projectId }), so steps chain within seconds.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { commitWorkDone, settleIdleReservations } from "../_shared/longFormReservations.ts";
import { decideAutopilot, decideNarration, FAILED_COPY, type AutopilotRecord } from "../_shared/stickman/autopilot.ts";
import { loadAutopilotInput } from "../_shared/stickman/autopilotState.ts";
import { decideScenes, type ScenesRecord } from "../_shared/stickman/scenes.ts";
import { loadScenesInput } from "../_shared/stickman/scenesState.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";
const RESEARCH_SECRET = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const SCRIPT_SECRET = Deno.env.get("LONG_FORM_SCRIPT_ADVANCE_SECRET") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const fn = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

const background = (p: Promise<unknown>) => {
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = p.catch((e) => console.error("[autopilot] dispatch failed", String(e)));
  if (rt?.waitUntil) rt.waitUntil(guarded);
};
// A user-level step (story plan / start research / start script) on the owner's behalf.
const callAsOwner = (name: string, body: Record<string, unknown>) =>
  // Authorization only gets the request past the gateway's JWT check; the
  // function itself authorizes on x-autopilot-secret + the owner's userId.
  fetch(fn(name), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, "x-autopilot-secret": SECRET }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.text().then((t) => t.slice(0, 300)) }));
const resumeWorker = (name: string, secret: string, body: Record<string, unknown>) =>
  fetch(fn(name), { method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": secret }, body: JSON.stringify(body) }).then((r) => r.body?.cancel());

async function latestNarrationRow(projectId: string) {
  const { data: profile } = await admin.from("long_form_generation_profiles").select("id").eq("project_id", projectId).eq("status", "active").maybeSingle();
  if (!profile) return null;
  const { data } = await admin.from("long_form_narration_audio_versions").select("id, status, lease_until, created_at").eq("project_id", projectId).eq("generation_profile_id", profile.id).order("version", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

// Phase 6b server watchdog: ANY narration row whose lease expired (the
// worker died) is handed back to the generator — no page needs to be open.
// The generator resumes it once, then marks NARRATION_STALLED (Retry free).
async function sweepStalledNarration() {
  const { data: rows } = await admin.from("long_form_narration_audio_versions").select("id, project_id").eq("status", "generating").lt("lease_until", new Date().toISOString()).limit(10);
  const out = [];
  for (const row of rows ?? []) {
    const { data: p } = await admin.from("long_form_projects").select("user_id").eq("id", row.project_id).maybeSingle();
    if (!p) continue;
    const r = await callAsOwner("generate-long-form-narration-audio", { projectId: row.project_id, userId: p.user_id, manual: false, resumeRowId: row.id });
    out.push({ rowId: row.id, status: r.status, body: r.body.slice(0, 120) });
    await logEvent("advance-long-form-autopilot", "warn", "narration_watchdog_resume", { projectId: row.project_id, rowId: row.id, status: r.status });
  }
  return out;
}

// ---------------- Phase 6c: the Scenes step ----------------
async function advanceScenes(projectId: string, project: any, ap: any, now: string, owner: { projectId: string; userId: string }) {
  const sc: ScenesRecord = { ...(ap.scenes ?? { status: "running", startedAt: now }) };
  const { input, planRow, tier } = await loadScenesInput(admin, projectId, project, sc, now);
  const d = decideScenes(input);
  const a = d.action;
  const resumed = (reason: string) => { sc.resumes = (sc.resumes ?? 0) + 1; ap.resumeLog = [...(ap.resumeLog ?? []), { at: now, stage: d.stage, reason }].slice(-10); };
  switch (a.kind) {
    case "build_bible": {
      if (a.resume) resumed("style guide restarted");
      sc.dispatched = { ...(sc.dispatched ?? {}), bible: now };
      background(callAsOwner("build-stickman-production-bible", owner).then((r) => { if (!r.ok) console.error("[autopilot] bible", r.status, r.body); }));
      break;
    }
    case "build_beats": {
      if (a.resume) {
        resumed("scene planning restarted");
        if (planRow && !["ready", "ready_with_warnings", "failed"].includes(planRow.status)) await admin.from("long_form_beat_plan_versions").update({ status: "failed", error_code: "STALLED" }).eq("id", planRow.id);
      }
      sc.dispatched = { ...(sc.dispatched ?? {}), beats: now };
      const r = await callAsOwner("build-stickman-beat-plan", owner);
      if (!r.ok) console.error("[autopilot] beat plan", r.status, r.body);
      break;
    }
    case "create_scenes": {
      const { data: beats } = await admin.from("long_form_beats").select("sequence, warnings").eq("beat_plan_version_id", a.planId).order("sequence");
      const rows = (beats ?? []).map((b: any) => ({ project_id: projectId, beat_plan_version_id: a.planId, beat_sequence: b.sequence, tier, status: "queued", source: "autopilot" }));
      // Only reached when the plan has no scene rows yet; the partial unique index blocks any duplicate.
      if (rows.length) { const { error } = await admin.from("long_form_scene_images").insert(rows); if (error) console.error("[autopilot] create scenes", error.message); }
      sc.planId = a.planId;
      for (let i = 0; i < Math.min(rows.length, 6); i++) background(dispatchScene(owner));
      break;
    }
    case "draw": {
      if (a.requeue.length) await admin.from("long_form_scene_images").update({ status: "queued", lease_until: null }).in("id", a.requeue).eq("status", "rendering");
      if (a.fail.length) await admin.from("long_form_scene_images").update({ status: "failed", error: "stalled", lease_until: null }).in("id", a.fail).eq("status", "rendering");
      for (let i = 0; i < a.slots; i++) background(dispatchScene(owner));
      break;
    }
    case "done":
      sc.status = "done";
      sc.doneAt = now;
      (sc as any).regenerating = false;
      ap.status = "done";
      ap.doneAt = now;
      break;
    case "fail":
      sc.status = "failed";
      sc.failedReason = a.reason;
      ap.status = "failed";
      ap.failedReason = a.reason;
      await logEvent("advance-long-form-autopilot", "error", "scenes_failed", { projectId, reason: a.reason, resumeLog: ap.resumeLog ?? [] });
      break;
    case "wait":
      break;
  }
  sc.stage = d.stage;
  ap.scenes = sc;
  ap.heartbeatAt = now;
  ap.lockUntil = null;
  await admin.from("long_form_projects").update({ autopilot: ap }).eq("id", projectId);
  if (a.kind !== "wait" && a.kind !== "draw") await logEvent("advance-long-form-autopilot", "info", `scenes_${a.kind}`, { projectId, stage: d.stage, drawn: d.drawn, total: d.total });
  return { projectId, action: `scenes_${a.kind}`, stage: d.stage, drawn: d.drawn, total: d.total };
}

const dispatchScene = (owner: { projectId: string; userId: string }) =>
  fetch(fn("render-long-form-scene"), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, "x-autopilot-secret": SECRET }, body: JSON.stringify(owner) }).then((r) => r.body?.cancel());

async function advanceOne(projectId: string) {
  const { data: claimed } = await admin.rpc("claim_long_form_autopilot", { p_project_id: projectId, p_seconds: 45 });
  if (!claimed) return { projectId, skipped: "not running or locked" };
  const loaded = await loadAutopilotInput(admin, projectId);
  if (!loaded) return { projectId, skipped: "no autopilot" };
  const { project, input } = loaded;
  const now = input.now;
  const ap: AutopilotRecord & Record<string, any> = { ...(input.autopilot as any) };
  const d = decideAutopilot(input);
  const a = d.action;
  const log = (reason: string) => { ap.resumes = (ap.resumes ?? 0) + 1; ap.resumeLog = [...(ap.resumeLog ?? []), { at: now, stage: d.workerStage, reason }].slice(-10); };
  const owner = { projectId, userId: project.user_id };

  // Phase 6c: "Continue to Scenes" -> bible -> beat director -> draw every scene.
  if (ap.phase === "scenes") return await advanceScenes(projectId, project, ap, now, owner);

  // Phase 6b: the script is finished -> lock it and narrate with the voice
  // chosen in Step 1. The run is "done" only once the narration has settled.
  if (a.kind === "done" || ap.phase === "narration") {
    if (ap.phase !== "narration") {
      ap.phase = "narration";
      ap.scriptVersionId = a.kind === "done" ? a.scriptVersionId : ap.scriptVersionId;
      ap.scriptDoneAt = now;
      ap.narration = { kicks: 0 };
    }
    const row = await latestNarrationRow(projectId);
    const n = decideNarration({ now, narration: ap.narration, row });
    if (n.kind === "lock") {
      ap.narration = { ...(ap.narration ?? {}), lockedAt: now, kicks: (ap.narration?.kicks ?? 0) + 1 };
      const r = await callAsOwner("lock-long-form-script", owner);
      if (!r.ok) console.error("[autopilot] lock script", r.status, r.body);
    } else if (n.kind === "resume") {
      background(callAsOwner("generate-long-form-narration-audio", { ...owner, manual: false, resumeRowId: n.rowId }).then((r) => { if (!r.ok) console.error("[autopilot] narration resume", r.status, r.body); }));
    } else if (n.kind === "done" && n.narrationStatus === "ready") {
      // Phase 6e: no stop at the voice — the chain goes straight on to the
      // scenes (bible -> beat director -> drawing). The lock already started the
      // bible in parallel with the voice, so it counts as in flight.
      ap.narration = { ...(ap.narration ?? {}), status: "ready", doneAt: now };
      ap.phase = "scenes";
      ap.status = "running";
      ap.scenes = { status: "running", startedAt: now, stage: "bible", resumes: 0, dispatched: ap.narration?.lockedAt ? { bible: ap.narration.lockedAt } : {} };
    } else if (n.kind === "done") {
      // The voice failed: stop with a clear free Retry on the generating screen.
      ap.status = "failed";
      ap.failedReason = "the voiceover failed";
      ap.narration = { ...(ap.narration ?? {}), status: n.narrationStatus };
    }
    ap.progressMax = 1;
    ap.heartbeatAt = now;
    ap.lockUntil = null;
    await admin.from("long_form_projects").update({ autopilot: ap }).eq("id", projectId);
    if (n.kind !== "wait") await logEvent("advance-long-form-autopilot", "info", `autopilot_narration_${n.kind}`, { projectId, narration: ap.narration });
    // Straight on to the scenes step (don't wait for the next cron minute).
    if (ap.phase === "scenes") background(fetch(fn("advance-long-form-autopilot"), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, "x-autopilot-secret": SECRET }, body: JSON.stringify({ projectId }) }).then((r) => r.body?.cancel()));
    return { projectId, action: `narration_${n.kind}`, stage: "voice" };
  }

  switch (a.kind) {
    case "generate_plan":
      if (a.resume) log("story plan stalled");
      ap.dispatched = { ...(ap.dispatched ?? {}), plan: now };
      background(callAsOwner("generate-long-form-story-plan", { ...owner, regenerate: false }).then((r) => { if (!r.ok) console.error("[autopilot] story plan", r.status, r.body); }));
      break;
    case "start_research": {
      if (a.resume) log("fact-finding restarted");
      ap.dispatched = { ...(ap.dispatched ?? {}), research: now };
      const r = await callAsOwner("start-long-form-research", { ...owner, regenerate: a.resume });
      if (!r.ok) console.error("[autopilot] start research", r.status, r.body);
      break;
    }
    case "start_script": {
      if (a.resume) log("writing restarted");
      ap.dispatched = { ...(ap.dispatched ?? {}), script: now };
      const r = await callAsOwner("start-long-form-script", { ...owner, regenerate: a.resume });
      if (!r.ok) console.error("[autopilot] start script", r.status, r.body);
      break;
    }
    case "resume_research":
      log("fact-finding stalled");
      if (loaded.research) background(resumeWorker("advance-long-form-research", RESEARCH_SECRET, { researchVersionId: loaded.research.id }));
      break;
    case "resume_script":
      log("the script stalled");
      if (loaded.script) background(resumeWorker("advance-long-form-script", SCRIPT_SECRET, { scriptVersionId: loaded.script.id }));
      break;
    case "fail":
      ap.status = "failed";
      ap.failedReason = a.reason;
      await logEvent("advance-long-form-autopilot", "error", "autopilot_failed", { projectId, reason: a.reason, resumeLog: ap.resumeLog ?? [] });
      break;
    case "wait":
      break;
  }
  ap.progressMax = Math.max(ap.progressMax ?? 0, d.progress);
  ap.stageMax = d.uiStage; // already the furthest of (this stage, the last furthest)
  ap.heartbeatAt = now;
  ap.lockUntil = null;
  await admin.from("long_form_projects").update({ autopilot: ap }).eq("id", projectId);
  if (a.kind !== "wait") await logEvent("advance-long-form-autopilot", "info", `autopilot_${a.kind}`, { projectId, stage: d.workerStage, resumes: ap.resumes });
  return { projectId, action: a.kind, stage: d.uiStage, workerStage: d.workerStage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (!SECRET || req.headers.get("x-autopilot-secret") !== SECRET) return err(req, "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  let ids: string[];
  let narrationWatchdog: unknown[] = [];
  let idleSettle: unknown = null;
  if (body?.projectId) ids = [String(body.projectId)];
  else {
    const { data } = await admin.from("long_form_projects").select("id").eq("autopilot->>status", "running").limit(25);
    ids = (data ?? []).map((r: any) => r.id);
    try { narrationWatchdog = await sweepStalledNarration(); } catch (e) { console.error("[autopilot] narration watchdog", String(e)); }
    // Phase 6c safety rule: reservations idle for 7 days are auto-settled (unused credits refunded).
    try { idleSettle = await settleIdleReservations(admin, new Date().toISOString(), logEvent); } catch (e) { console.error("[autopilot] idle settle", String(e)); }
  }
  const results = [];
  for (const id of ids) {
    try { results.push(await advanceOne(id)); } catch (e) { results.push({ projectId: id, error: String(e).slice(0, 200) }); }
    // Charge for work done: after each tick (script, voice, every batch of scenes) commit
    // min(quote, 2 x real cost so far) of a progressive hold.
    try { await commitWorkDone(admin, id); } catch (e) { console.error("[autopilot] commit work done", String(e)); }
  }
  return ok(req, { ok: true, results, narrationWatchdog, idleSettle, failedCopy: FAILED_COPY });
});
