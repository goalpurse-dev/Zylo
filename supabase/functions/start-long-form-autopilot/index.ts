// deno-lint-ignore-file no-explicit-any
// start-long-form-autopilot/index.ts — user-facing (Phase 6a).
// "Generate video" for a Stickman project: starts the one continuous
// server-side chain (story plan -> research-lite -> script). { retry: true }
// is the free "Retry" after a failed run: it resets the resume counter and
// continues from the last checkpoint (finished stages are never redone, and
// nothing is charged — the credits were reserved at setup).
// POST { projectId, retry? } -> { autopilot }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { fetchActiveGenerationProfile, isStickmanProfile } from "../_shared/stickman/recipeProfile.ts";
import { nudgeAutopilot } from "../_shared/stickman/autopilotNudge.ts";
import { REFUNDED_COPY } from "../_shared/stickman/autopilot.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const { data: project } = await admin.from("long_form_projects").select("id, user_id, autopilot, status").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);
  if (!isStickmanProfile(await fetchActiveGenerationProfile(admin, projectId))) return err(req, "The one-step flow is for Stickman projects", 400, { code: "NOT_STICKMAN" });

  const now = new Date().toISOString();
  const current = project.autopilot as any;
  let autopilot: any;
  // 2026-10-07: a run that could not make a video gives its whole hold back at once.
  // Continuing that project would then make a video nobody paid for, so every
  // retry / regenerate on it is refused with a plain message (start a new video).
  if (body?.retry === true || body?.regenerateScript === true) {
    const { data: hold } = await admin.from("long_form_project_reservations").select("status").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (hold?.status === "released") return err(req, REFUNDED_COPY, 409, { code: "HOLD_RELEASED" });
  }
  if (body?.scenes === true) {
    // Phase 6c: "Continue to Scenes" (after Listen & change) -> bible -> beat
    // director -> draw every scene, server-side. { scenes, retry } is the free
    // Retry after a stop: same checkpoint (finished scenes are kept), fresh budget.
    const sc = current?.scenes ?? null;
    if (current?.phase === "scenes" && sc && (sc.status === "running" || sc.status === "done") ) return ok(req, { autopilot: current });
    if (current?.phase === "scenes" && sc?.status === "failed") {
      if (!body?.retry) return ok(req, { autopilot: current });
      autopilot = { ...current, status: "running", lockUntil: null, failedReason: null, scenes: { ...sc, status: "running", resumes: 0, dispatched: {}, failedReason: null, retries: (sc.retries ?? 0) + 1, retriedAt: now } };
    } else {
      const { data: profile } = await admin.from("long_form_generation_profiles").select("id").eq("project_id", projectId).eq("status", "active").maybeSingle();
      const { data: narration } = profile ? await admin.from("long_form_narration_audio_versions").select("id").eq("project_id", projectId).eq("generation_profile_id", profile.id).in("status", ["ready", "alignment_failed"]).limit(1).maybeSingle() : { data: null };
      if (!narration) return err(req, "The voiceover isn't ready yet.", 409);
      // The lock already started the style-guide (bible) build in parallel with the
      // voice; if that was recent, count it as in flight so the chain doesn't pay
      // for a second one (the 6c e2e built two). The watchdog still covers a dead one.
      const { data: proj } = await admin.from("long_form_projects").select("current_script_version_id").eq("id", projectId).single();
      const { data: sv } = await admin.from("long_form_script_versions").select("locked_at").eq("id", proj.current_script_version_id).maybeSingle();
      const lockedRecently = sv?.locked_at && Date.now() - Date.parse(sv.locked_at) < 180_000;
      autopilot = { ...(current ?? { startedAt: now, resumes: 0 }), status: "running", phase: "scenes", lockUntil: null, failedReason: null, scenes: { status: "running", startedAt: now, stage: "bible", resumes: 0, dispatched: lockedRecently ? { bible: sv.locked_at } : {} } };
    }
    await admin.from("long_form_projects").update({ autopilot }).eq("id", projectId);
    await logEvent("start-long-form-autopilot", "info", body?.retry ? "scenes_retry" : "scenes_started", { projectId });
    nudgeAutopilot(projectId);
    return ok(req, { autopilot });
  }
  if (body?.regenerateScript === true) {
    // "Regenerate script" on the review page: keep the plan and the facts,
    // write a new script version (the autopilot follows it to "done").
    if (!current || current.status === "running") return err(req, "The script is still being written", 409);
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/start-long-form-script`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") ?? "" }, body: JSON.stringify({ projectId, regenerate: true }),
    });
    if (!r.ok) return err(req, "Couldn't start a new script. Try again.", r.status === 429 ? 429 : 500);
    await r.body?.cancel();
    autopilot = { ...current, status: "running", startedAt: now, resumes: 0, failedReason: null, doneAt: null, scriptVersionId: null, phase: null, narration: null, dispatched: { ...(current.dispatched ?? {}), script: now }, progressMax: 0.35, stageMax: "write", lockUntil: null, regenerations: (current.regenerations ?? 0) + 1 };
  } else if (body?.retry === true && current?.phase === "narration" && current.status === "failed") {
    // Phase 6e: the voiceover failed -> a free Retry re-records it (the generator's
    // own free retry), then the chain goes on to the scenes by itself.
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-long-form-narration-audio`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") ?? "" }, body: JSON.stringify({ projectId, manual: false, retry: true }),
    });
    await r.body?.cancel();
    autopilot = { ...current, status: "running", failedReason: null, lockUntil: null, narration: { ...(current.narration ?? {}), status: null, lockedAt: now, kicks: 1 }, retries: (current.retries ?? 0) + 1, retriedAt: now };
  } else if (body?.retry === true) {
    if (!current) return err(req, "Nothing to retry", 400);
    if (current.status === "running") return ok(req, { autopilot: current });
    // Free retry: same checkpoint, fresh resume budget, no charge.
    autopilot = { ...current, status: "running", resumes: 0, failedReason: null, dispatched: {}, lockUntil: null, retries: (current.retries ?? 0) + 1, retriedAt: now };
  } else {
    if (current) return ok(req, { autopilot: current }); // idempotent: a double click never starts a second chain
    autopilot = { status: "running", startedAt: now, resumes: 0, dispatched: {}, progressMax: 0, stageMax: undefined };
  }
  await admin.from("long_form_projects").update({ autopilot }).eq("id", projectId);
  await logEvent("start-long-form-autopilot", "info", body?.retry ? "autopilot_retry" : "autopilot_started", { projectId });
  nudgeAutopilot(projectId);
  return ok(req, { autopilot });
});
