// update-long-form-discovery-session/index.ts
//
// Generic authenticated writer for a user's OWN discovery session row —
// backs the "generated ideas must be a real server-side generation, not
// just sessionStorage/React state" requirement. Handles all the small,
// frequent updates (idea text + filters right after generation, selected
// idea, length/depth customization, progressive preview status/imageUrl)
// through one whitelisted partial-update endpoint rather than several
// near-identical tiny functions.
//
// This is low-stakes display/restore data, not a billing surface — the
// real preview job truth still lives in the `jobs` table (each idea's
// conceptPreview.jobId points there), independently verifiable. A user can
// only ever touch their OWN session row (ownership-checked), and at worst
// could corrupt their own cached idea list, which only affects their own
// restore experience.
//
// POST { discoverySessionId, patch: { ...whitelisted fields... } }
// Returns { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_FIELDS = [
  "topic",
  "source",
  "idea_category",
  "idea_direction",
  "length_mode",
  "custom_length_minutes",
  "depth_mode",
  "custom_explanation_depth",
  "selected_idea_id",
  "ideas",
  "idea_batches",
] as const;

const MAX_IDEAS = 40;
const MAX_PAYLOAD_BYTES = 200_000; // generous for ~30 ideas' worth of text fields
const MAX_BATCHES = 20; // append-only lifetime record for one session — generous, still bounded against abuse
const MAX_BATCHES_PAYLOAD_BYTES = 600_000; // idea_batches never gets capped/dropped like `ideas`, so its ceiling is generous rather than tight

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const discoverySessionId = String(body?.discoverySessionId ?? "").trim();
  const rawPatch = body?.patch;

  if (!discoverySessionId) return err(req, "Missing discoverySessionId", 400);
  if (!rawPatch || typeof rawPatch !== "object") return err(req, "Missing patch", 400);

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in rawPatch) patch[key] = rawPatch[key];
  }
  if (Object.keys(patch).length === 0) return err(req, "No recognized fields in patch", 400);

  if ("ideas" in patch) {
    if (!Array.isArray(patch.ideas)) return err(req, "ideas must be an array", 400);
    if (patch.ideas.length > MAX_IDEAS) return err(req, "Too many ideas", 400);
    if (JSON.stringify(patch.ideas).length > MAX_PAYLOAD_BYTES) return err(req, "Payload too large", 400);
  }

  if ("idea_batches" in patch) {
    if (!Array.isArray(patch.idea_batches)) return err(req, "idea_batches must be an array", 400);
    if (patch.idea_batches.length > MAX_BATCHES) return err(req, "Too many batches", 400);
    if (JSON.stringify(patch.idea_batches).length > MAX_BATCHES_PAYLOAD_BYTES) return err(req, "Payload too large", 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: session } = await admin.from("long_form_discovery_sessions").select("id, user_id").eq("id", discoverySessionId).maybeSingle();
  if (!session) return err(req, "Discovery session not found", 404);
  if (session.user_id !== user.id) return err(req, "Forbidden", 403);

  const { error: updateError } = await admin
    .from("long_form_discovery_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", discoverySessionId);

  if (updateError) return err(req, "Could not update discovery session", 500);

  return ok(req, { ok: true });
});
