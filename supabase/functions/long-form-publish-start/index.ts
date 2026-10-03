// deno-lint-ignore-file no-explicit-any
// long-form-publish-start/index.ts — Publish autopilot. "Continue to Publish"
// calls this once; it starts, in parallel and server-side (it keeps going if
// the user leaves the page), everything the Publish page shows:
//   0) the edit itself — created from the current scenes if the editor was never
//      opened, and put on the scenes' current pictures (done first, once, so the
//      steps below all see the same edit)
//   a) the 1080p render — only if this edit version has none yet (never a duplicate)
//   b) the YouTube title / alternatives / description / tags — only if not written yet
//   c) the 3 included thumbnails — only if there are none yet
// All three are included in the video price; each step is idempotent, so a
// double click or a reload never starts (or charges) anything twice.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { logEvent } from "../_shared/systemLog.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Bad request", 400);
  const { data: project } = await admin.from("long_form_projects").select("id, user_id").eq("id", projectId).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);
  // The user's own token: each step runs its normal ownership and pricing checks.
  const headers = { Authorization: req.headers.get("Authorization") ?? "", apikey: req.headers.get("apikey") ?? "", "Content-Type": "application/json" };
  const call = (fn: string, payload: any) => fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: "POST", headers, body: JSON.stringify({ projectId, ...payload }) })
    .then(async (r) => ({ fn, status: r.status, body: await r.json().catch(() => null) })).catch((e) => ({ fn, status: 0, body: String(e?.message ?? e) }));
  const all = call("long-form-edit", { action: "ensure" }).then((edit) => Promise.all([
    Promise.resolve(edit),
    call("long-form-render", { action: "start", resolution: "1080p", ifMissing: true }),
    call("long-form-youtube-text", { action: "generate", ifMissing: true }),
    call("long-form-thumbnails", { action: "start" }),
  ])).then((rs) => logEvent("long-form-publish-start", rs.every((r) => r.status === 200) ? "info" : "warn", "publish_autopilot", { projectId, steps: rs.map((r) => ({ fn: r.fn, status: r.status, note: r.body?.exists ? "exists" : r.body?.alreadyRunning ? "running" : r.body?.generating ? "generating" : r.status === 200 ? "started" : String(r.body?.error ?? r.body ?? "").slice(0, 120) })) }));
  EdgeRuntime.waitUntil(all);
  return ok(req, { ok: true, started: true });
});
