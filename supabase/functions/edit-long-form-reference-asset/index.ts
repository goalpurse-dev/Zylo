// deno-lint-ignore-file no-explicit-any
// edit-long-form-reference-asset/index.ts
//
// Edit is separate from Regenerate (Part 13 of the Visual World reference-
// contract patch): Regenerate (regenerate-long-form-reference-asset) is a
// fresh attempt from the canonical spec; Edit is a controlled, natural-
// language-instructed transformation of the CURRENT image, conditioned on
// that exact image (same reference-conditioned mechanism as Part 5's
// identity-anchor derivation, and the same one 30 Days' own reference
// editor already uses via runware-image's referenceImages support). Same
// "never destructively overwrite" contract as Regenerate: creates one
// replacement row, preserves the prior asset/job/cost/result untouched, and
// reopens the parent version's "generating" stage so the existing durable
// claim/lease machinery (advance-long-form-visual-world) picks it up.
//
// POST { assetId, instruction }
// Returns { ok: true, assetId }

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
  const instruction = String(body?.instruction ?? "").trim();
  if (!assetId) return err(req, "Missing assetId", 400);
  if (instruction.length < 3 || instruction.length > 800) return err(req, "Describe the change in a few words (3-800 characters)", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: assetIdCreated, error } = await admin.rpc("edit_long_form_reference_asset", { p_asset_id: assetId, p_user_id: user.id, p_instruction: instruction });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("NOT_FOUND") ? 404 : message.includes("NOTHING_TO_EDIT") ? 400 : message.includes("INVALID_INSTRUCTION") ? 400 : message.includes("BUSY") || message.includes("IN_PROGRESS") ? 409 : 500;
    const friendly = status === 409 ? "References are updating. Please try again shortly." : status === 400 && message.includes("NOTHING_TO_EDIT") ? "This reference isn't ready to edit yet." : status === 400 ? "Describe the change in a few words (3-800 characters)." : "Could not edit this reference";
    return err(req, friendly, status);
  }
  const { data: replacement } = await admin.from("long_form_reference_assets").select("visual_world_version_id").eq("id", assetIdCreated).single();
  if (replacement) {
    const dispatch = fetch(ADVANCE_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId: replacement.visual_world_version_id }) }).catch((e) => console.error("Reference edit dispatch failed", e));
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(dispatch);
    else await dispatch;
  }
  return ok(req, { ok: true, assetId: assetIdCreated });
});
