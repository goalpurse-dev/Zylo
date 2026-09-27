// deno-lint-ignore-file no-explicit-any
// disable-long-form-scene-overlay/index.ts
//
// 2026-09-22 "FINAL stabilization pass" §0/§10 — the first real,
// user-controllable overlay operation: revert a scene's displayed frame to
// its clean base image, with ZERO image-provider cost. Architecture-only
// (deliberately not a full overlay editor — see the final report): only
// "disable" is built this pass; "re-enable"/"edit text"/"reposition" are a
// natural, safe follow-up reusing the exact same history chain this
// endpoint writes to.
//
// Thin wrapper mirroring retry-long-form-scene's own shape exactly: all
// real logic (ownership check, approval/base-image preconditions,
// idempotency, the actual history-preserving row creation) lives in the
// disable_long_form_scene_overlay SQL function; this endpoint only handles
// auth/HTTP and translates SQL error codes into honest user-facing copy.
// Never dispatches a job/provider call — there is no worker to kick.
//
// POST { sceneId }
// Returns { ok: true, sceneId: <the id to now display> }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const sceneId = String(body?.sceneId ?? "").trim();
  if (!sceneId) return err(req, "Missing sceneId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: replacementId, error } = await admin.rpc("disable_long_form_scene_overlay", { p_scene_id: sceneId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("SCENE_NOT_FOUND") ? 404
      : message.includes("SCENE_NOT_APPROVED") ? 409 : message.includes("NO_BASE_IMAGE") ? 409 : 500;
    const fallback = status === 409 ? "This scene isn't ready to have its overlay changed yet." : "Could not update this scene's overlay.";
    return err(req, fallback, status);
  }
  return ok(req, { ok: true, sceneId: replacementId });
});
