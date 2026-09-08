// deno-lint-ignore-file no-explicit-any
// regenerate-long-form-reference-asset/index.ts
//
// Regenerates ONE reference asset — never the whole Visual World (Part 15
// item 19 / the UI's per-image "Regenerate" action). Creates one replacement
// row, preserving the prior job/result/cost, and reopens the parent version's
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

  const { data: assetIdCreated, error } = await admin.rpc("replace_long_form_reference_asset", { p_asset_id: assetId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("NOT_FOUND") ? 404 : message.includes("BUSY") || message.includes("IN_PROGRESS") ? 409 : 500;
    return err(req, status === 409 ? "References are updating. Please try again shortly." : "Could not replace this reference", status);
  }
  const { data: replacement } = await admin.from("long_form_reference_assets").select("visual_world_version_id").eq("id", assetIdCreated).single();
  if (replacement) {
    const dispatch = fetch(ADVANCE_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId: replacement.visual_world_version_id }) }).catch((e) => console.error("Reference replacement dispatch failed", e));
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(dispatch);
    else await dispatch;
  }
  return ok(req, { ok: true, assetId: assetIdCreated });
});
