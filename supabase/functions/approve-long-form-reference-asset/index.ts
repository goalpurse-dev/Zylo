// deno-lint-ignore-file no-explicit-any
// approve-long-form-reference-asset/index.ts
//
// Part 8 of the 2026-09-14 "FINAL CHARACTER REFERENCE POLISH" fix:
// "Approve Anyway" — a deliberate manual override for a current reference
// stuck in Needs Review. QA can reject for non-critical reasons (a missing
// action pose, minor prop text); this lets the user say "this is fine"
// without regenerating or editing pixels. Never touches the image, never
// calls a provider, never erases the automated QA result — see
// approve_long_form_reference_asset_manually (SQL) for the actual
// column-only update.
//
// POST { assetId }
// Returns { ok: true, assetId }

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
  const assetId = String(body?.assetId ?? "").trim();
  if (!assetId) return err(req, "Missing assetId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { error } = await admin.rpc("approve_long_form_reference_asset_manually", { p_asset_id: assetId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("REFERENCE_NOT_FOUND") ? 404 : message.includes("NOT_CURRENT") ? 409 : message.includes("NOTHING_TO_APPROVE") ? 400 : 500;
    const friendly = status === 409 ? "A newer version of this reference already exists." : status === 400 ? "This reference isn't in Needs Review, so there's nothing to approve." : "Could not approve this reference";
    return err(req, friendly, status);
  }
  return ok(req, { ok: true, assetId });
});
