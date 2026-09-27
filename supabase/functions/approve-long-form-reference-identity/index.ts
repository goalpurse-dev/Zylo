// deno-lint-ignore-file no-explicit-any
// approve-long-form-reference-identity/index.ts
//
// Part 2's "QA says usable but uncertain -> allow explicit user approval":
// a Character Pack QA rejection is a strong default, never a hard wall —
// this lets the user override qa_status to 'approved' for a generation they
// judge acceptable, at which point the SAME accepted_reference_identity gate
// every dependent role (Profile/Back/Face) already checks unblocks them on
// its own, next tick, through the standing recovery sweeper — no separate
// "release the dependents" step needed anywhere.
//
// POST { assetId }
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
  if (!assetId) return err(req, "Missing assetId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: asset } = await admin.from("long_form_reference_assets").select("visual_world_version_id").eq("id", assetId).maybeSingle();
  const { error } = await admin.rpc("approve_long_form_reference_identity", { p_asset_id: assetId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("NOT_FOUND") ? 404 : message.includes("TERMINAL_GENERATION_REQUIRED") ? 400 : 500;
    const friendly = status === 400 ? "This reference isn't finished generating yet." : "Could not approve this reference";
    return err(req, friendly, status);
  }
  // Wake the standing worker immediately so any dependent Profile/Back/Face
  // row that was waiting becomes claimable without needing a page refresh
  // or the once-a-minute recovery cron to happen to fire first.
  if (asset?.visual_world_version_id) {
    const dispatch = fetch(ADVANCE_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId: asset.visual_world_version_id }) }).catch((e) => console.error("Identity approval dispatch failed", e));
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(dispatch);
    else await dispatch;
  }
  return ok(req, { ok: true, assetId });
});
