// deno-lint-ignore-file no-explicit-any
// get-long-form-autopilot-status/index.ts — user-facing (Phase 6a).
// What the "Writing your script" screen polls every ~4 s: the real stage,
// the SERVER start time + server "now" (the UI's elapsed clock never runs on
// a local timer that can freeze), an honest ETA range, never-backwards
// progress, real events, and the plan. If the watchdog sees a stalled stage
// it nudges the autopilot right away (the cron sweep is the safety net).
// POST { projectId }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { loadAutopilotInput, buildProgressView } from "../_shared/stickman/autopilotState.ts";
import { nudgeAutopilot } from "../_shared/stickman/autopilotNudge.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);
  const { data: owner } = await admin.from("long_form_projects").select("user_id").eq("id", projectId).maybeSingle();
  if (!owner) return err(req, "Project not found", 404);
  if (owner.user_id !== user.id) return err(req, "Forbidden", 403);

  const loaded = await loadAutopilotInput(admin, projectId);
  if (!loaded) return ok(req, { status: "none" });
  const view = buildProgressView(loaded);
  if (view.status === "running" && view.stale) nudgeAutopilot(projectId);
  return ok(req, view);
});
