// deno-lint-ignore-file no-explicit-any
// reconcile-long-form-visual-world/index.ts
//
// 2026-09-19 "Visual World incremental reconciliation" pass — the real
// "Update Visual World" action, distinct from start-long-form-visual-world's
// own build/regenerate: this creates a NEW VisualWorldVersion that REUSES
// every compatible canonical reference from the project's current world
// (zero cost, zero provider call) and only plans/generates the genuinely
// missing ones. Mirrors start-long-form-visual-world's own thin
// client-facing shape exactly (validate, create/claim the row via a SQL
// RPC, kick off the async worker, return almost immediately — the client
// polls for completion).
//
// Idempotent by construction: start_visual_world_reconciliation (SQL) keys
// its own creation on (project, current plan, current world) and returns
// the SAME row on a repeat call — this endpoint never needs its own
// idempotency layer on top.
//
// POST { projectId }
// Returns { project, visualWorld }.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_VISUAL_WORLD_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-visual-world`;
const VISUAL_WORLD_PAUSED = (Deno.env.get("LONG_FORM_VISUAL_WORLD_PAUSED") ?? "").trim().toLowerCase() === "true";

function backgroundDispatch(promise: Promise<unknown>) {
  if (VISUAL_WORLD_PAUSED) return;
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[reconcile-long-form-visual-world] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}
async function dispatchFirstStage(visualWorldVersionId: string) {
  await fetch(ADVANCE_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId }) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // The RPC itself is the single source of truth for every validation
  // (ownership, plan/world readiness, "is there actually anything to
  // reconcile") and for idempotency (its own unique
  // reconciliation_idempotency_key) — this endpoint does not re-derive any
  // of that, exactly mirroring start-long-form-visual-plan/
  // start-long-form-visual-world's own "thin wrapper around one
  // service-role RPC, explicit p_user_id" shape.
  const { data: visualWorld, error } = await admin.rpc("start_visual_world_reconciliation", { p_project_id: projectId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403
      : message.includes("NO_CURRENT_PLAN") || message.includes("NO_CURRENT_VISUAL_WORLD") ? 400
      : message.includes("PLAN_NOT_READY") || message.includes("PARENT_VISUAL_WORLD_NOT_READY") ? 409
      : message.includes("ALREADY_COMPATIBLE") ? 200
      : 500;
    if (status === 200) {
      // Not an error from the user's point of view — the compatibility
      // resolver should already have prevented this click, but if the
      // Visual World was already fully compatible there is nothing to
      // reconcile; tell the caller so it can just treat the current world
      // as ready, rather than surfacing a scary-looking failure.
      return ok(req, { alreadyCompatible: true });
    }
    return err(req, "Could not start the Visual World update. Please try again.", status, { code: message.split(":")[0] });
  }

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  // Nudges the worker on every call, not only a freshly-created row — a
  // "Try Again" click against an existing, still-in-flight reconciliation
  // (status planning/generating) is a safe no-op (claim_long_form_visual_
  // world_stage's own SKIP LOCKED + stage_attempt/lock checks make a
  // redundant dispatch harmless) and is exactly what actually un-sticks a
  // row whose worker_lock_until already expired but hasn't been reclaimed
  // yet (item 4/5: manual re-kick, same version, idempotent).
  if (["planning", "generating"].includes(visualWorld.status)) backgroundDispatch(dispatchFirstStage(visualWorld.id));
  return ok(req, { project, visualWorld });
});
