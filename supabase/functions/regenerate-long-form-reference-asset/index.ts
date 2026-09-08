// deno-lint-ignore-file no-explicit-any
// regenerate-long-form-reference-asset/index.ts
//
// Regenerates ONE reference asset — never the whole Visual World (Part 15
// item 19 / the UI's per-image "Regenerate" action). Resets just that
// asset row to pending and reopens its parent Visual World version's
// "generating" stage so the existing durable claim/lease machinery
// (advance-long-form-visual-world) picks it up on its own — no separate,
// parallel regeneration path. Bounded the same way as any other asset: 3
// claim attempts max, same crash-safety contract.
//
// POST { assetId }
// Returns { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_VISUAL_WORLD_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-visual-world`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const assetId = String(body?.assetId ?? "").trim();
  if (!assetId) return err(req, "Missing assetId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: asset } = await admin.from("long_form_reference_assets").select("id, visual_world_version_id, claim_attempts").eq("id", assetId).maybeSingle();
  if (!asset) return err(req, "Reference not found", 404);

  const { data: visualWorld } = await admin.from("long_form_visual_world_versions").select("id, project_id, status").eq("id", asset.visual_world_version_id).maybeSingle();
  if (!visualWorld) return err(req, "Visual World version not found", 404);

  const { data: project } = await admin.from("long_form_projects").select("id, user_id").eq("id", visualWorld.project_id).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Forbidden", 403);

  // Only a genuinely terminal asset (succeeded/failed) makes sense to
  // regenerate — one still pending/running is already in the normal queue.
  const { data: currentAsset } = await admin.from("long_form_reference_assets").select("status").eq("id", assetId).maybeSingle();
  if (currentAsset?.status !== "succeeded" && currentAsset?.status !== "failed") {
    return err(req, "This reference is already in progress", 409, { code: "ALREADY_IN_PROGRESS" });
  }

  await admin
    .from("long_form_reference_assets")
    .update({ status: "pending", job_id: null, result_url: null, cost_usd: null, claim_attempts: 0, lease_until: null, last_error_code: null, last_error_at: null, updated_at: new Date().toISOString() })
    .eq("id", assetId);

  // Reopen the parent version's generating stage only if it had already
  // moved past it (ready/needs_attention/finalizing) — never disturb a
  // version that's still actively generating other assets.
  if (visualWorld.status === "ready" || visualWorld.status === "needs_attention") {
    await admin
      .from("long_form_visual_world_versions")
      .update({ status: "generating", stage: "generating", stage_attempt: 0, worker_lock_until: null, last_error_code: null })
      .eq("id", visualWorld.id);
  }

  fetch(ADVANCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET },
    body: JSON.stringify({ visualWorldVersionId: visualWorld.id }),
  }).catch((e) => console.error("[regenerate-long-form-reference-asset] dispatch failed", e));

  return ok(req, { ok: true });
});
