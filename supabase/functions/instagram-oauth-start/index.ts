// supabase/functions/instagram-oauth-start/index.ts
// Initiates Instagram OAuth: validates the Zyvo user JWT, generates a
// cryptographically secure one-time state, stores its SHA-256 hash in
// social_oauth_states, and returns the Meta authorization URL.
//
// The frontend redirects the browser to the returned URL.
// The raw state value never touches the database — only its hash is stored.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ID         = Deno.env.get("INSTAGRAM_APP_ID")!;
const REDIRECT_URI   = Deno.env.get("INSTAGRAM_REDIRECT_URI")!;

/* ── CONSTANTS ────────────────────────────────────────────────────────────── */

const IG_AUTH_URL    = "https://www.instagram.com/oauth/authorize";
const SCOPES         = "instagram_business_basic,instagram_business_content_publish";
const STATE_TTL_MS   = 10 * 60 * 1000;   // 10 minutes
const RATE_MAX       = 5;                 // starts per user per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;   // 1 hour

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── HANDLER ──────────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return err(req, "Method not allowed", 405);
  }

  // Require authenticated Zyvo user
  const { user, authError } = await requireUser(req);
  if (authError || !user) {
    return err(req, "Unauthorized", 401);
  }

  if (!APP_ID || !REDIRECT_URI) {
    console.error("[ig-oauth-start] Missing INSTAGRAM_APP_ID or INSTAGRAM_REDIRECT_URI");
    return err(req, "OAuth not configured", 500);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Rate limit: max RATE_MAX OAuth starts per user per hour
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await sb
    .from("social_oauth_states")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("platform", "instagram")
    .gte("created_at", since);

  if ((count ?? 0) >= RATE_MAX) {
    return err(req, "Too many connection attempts. Please try again later.", 429);
  }

  // Generate 32-byte cryptographically random raw state (hex)
  const rawState  = randomHex(32);                     // sent to Instagram
  const stateHash = await sha256Hex(rawState);         // stored in DB
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

  const { error: insertErr } = await sb.from("social_oauth_states").insert({
    user_id:    user.id,
    platform:   "instagram",
    state_hash: stateHash,
    expires_at: expiresAt,
  });

  if (insertErr) {
    console.error("[ig-oauth-start] State insert failed:", insertErr.message);
    return err(req, "Failed to initiate connection. Please try again.", 500);
  }

  const params = new URLSearchParams({
    client_id:     APP_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         SCOPES,
    response_type: "code",
    state:         rawState,
  });

  return ok(req, { url: `${IG_AUTH_URL}?${params.toString()}` });
});
