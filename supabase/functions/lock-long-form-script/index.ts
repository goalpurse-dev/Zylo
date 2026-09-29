// deno-lint-ignore-file no-explicit-any
// lock-long-form-script/index.ts — 2026-10-02 "real narration audio master
// timeline" pass, Section 5/6.
//
// The explicit "Lock Story" action. Distinct from a script merely reaching
// status='ready' (the critic/revision pipeline's own completion, which only
// means the CONTENT is finished) — locking is the user's deliberate
// commitment that THIS script version, under THIS Production Profile, is
// authoritative for generation. Idempotent: locking an already-locked
// script for the SAME profile is a harmless no-op that still re-kicks both
// downstream triggers (safe, since each is independently idempotent — see
// their own doc comments) — this gives a free "resume" if the browser
// refreshed before Bible/TTS actually started.
//
// Fires Production Bible building AND narration audio generation in
// PARALLEL, per Section 3's explicit dependency graph (neither needs the
// other — the Beat Director is what waits on both). Never awaited; both run
// via EdgeRuntime.waitUntil so this endpoint returns immediately and the
// user is never blocked staring at a spinner for either background job.
//
// POST { projectId }
// Returns { ok:true, locked:true, scriptVersionId, generationProfileId }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUserOrAutopilot } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function kickDownstream(url: string, headers: Record<string, string>, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { ...headers, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .catch((e) => console.error(`[lock-long-form-script] downstream kick failed: ${url}`, e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  // Phase 6b: the autopilot locks the finished Stickman script itself (the
  // voice was chosen in Step 1) — internal calls pass the owner's userId on.
  const { user, authError, internal } = await requireUserOrAutopilot(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const authorization = req.headers.get("authorization") ?? "";
  const downstreamHeaders: Record<string, string> = internal
    ? { Authorization: authorization, "x-autopilot-secret": req.headers.get("x-autopilot-secret") ?? "" }
    : { Authorization: authorization };
  const owner = internal ? { userId: user.id } : {};

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("id,user_id,current_script_version_id").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const { data: profile, error: profileError } = await admin.from("long_form_generation_profiles").select("id, visual_recipe").eq("project_id", projectId).eq("status", "active").maybeSingle();
  if (profileError) return err(req, "Failed to load generation profile", 500);
  if (!profile) return err(req, "This project has no active Production Profile yet — complete Setup first.", 409);

  if (!project.current_script_version_id) return err(req, "This project has no script yet.", 409);
  const { data: scriptVersion, error: scriptError } = await admin.from("long_form_script_versions").select("id,status,locked_at,locked_generation_profile_id,script_document").eq("id", project.current_script_version_id).maybeSingle();
  if (scriptError) return err(req, "Failed to load script", 500);
  if (!scriptVersion) return err(req, "Script not found", 404);
  // Phase 6a: a Stickman script is finished when it has a document — the
  // autopilot's scripts almost always settle at needs_attention (critic notes
  // the user reviews on the Script review page), which is NOT a gate.
  const stickman = profile.visual_recipe === "stickman_doodle_explainer";
  const finished = stickman ? ["ready", "needs_attention", "needs_research"].includes(scriptVersion.status) && !!scriptVersion.script_document : scriptVersion.status === "ready";
  if (!finished) return err(req, "The script isn't finished yet — it must reach a finished draft before it can be locked.", 409);

  const alreadyLocked = Boolean(scriptVersion.locked_at) && scriptVersion.locked_generation_profile_id === profile.id;
  if (!alreadyLocked) {
    const { error: lockError } = await admin.from("long_form_script_versions")
      .update({ locked_at: new Date().toISOString(), locked_generation_profile_id: profile.id })
      .eq("id", scriptVersion.id).is("locked_at", null); // never re-lock/overwrite an existing lock timestamp
    if (lockError) return err(req, "Could not lock the script.", 500);
  }

  const bibleWork = kickDownstream(`${SUPABASE_URL}/functions/v1/build-stickman-production-bible`, downstreamHeaders, { projectId, ...owner });
  const narrationWork = kickDownstream(`${SUPABASE_URL}/functions/v1/generate-long-form-narration-audio`, downstreamHeaders, { projectId, manual: false, ...owner });
  const combined = Promise.all([bibleWork, narrationWork]);
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(combined); else await combined;

  return ok(req, { ok: true, locked: true, scriptVersionId: scriptVersion.id, generationProfileId: profile.id });
});
