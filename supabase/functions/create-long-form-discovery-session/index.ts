// create-long-form-discovery-session/index.ts
//
// Creates one durable long_form_discovery_sessions row representing "this
// one Idea discovery / create-video session" — not a Video Project. The
// frontend creates exactly one of these when a user genuinely starts a new
// Long Form video (lobby "Create New Video"), then persists the returned id
// in the draft so refresh/back/mode-switch/filter-change all reuse it.
//
// POST {} (no body needed — the session belongs to whoever is authenticated)
// Returns { id, created_at }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Each new session grants a free batch of up to 20 concept-preview images
// (2 free idea batches x 10). This caps how many sessions one account can
// spin up per hour — generous for real usage, far below anything a normal
// creator would ever hit, per the product's "don't make normal use
// annoying" instruction.
const MAX_NEW_SESSIONS_PER_HOUR = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("long_form_discovery_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (countError) return err(req, "Could not verify session limit", 500);
  if ((count ?? 0) >= MAX_NEW_SESSIONS_PER_HOUR) {
    return err(req, "Too many new Long Form sessions started recently. Please try again later.", 429, {
      code: "TOO_MANY_SESSIONS",
    });
  }

  const { data, error } = await admin
    .from("long_form_discovery_sessions")
    .insert({ user_id: user.id })
    .select("id, created_at")
    .single();

  if (error || !data) return err(req, "Could not create discovery session", 500);

  return ok(req, { id: data.id, created_at: data.created_at });
});
