// supabase/functions/youtube-oauth-start/index.ts
// Initiates YouTube OAuth: validates the Zyvo user JWT, generates a
// cryptographically secure one-time state, stores its SHA-256 hash in
// social_oauth_states, and returns the Google authorization URL.
//
// The frontend redirects the browser to the returned URL.
// The raw state value never touches the database — only its hash is stored.
// The caller's origin is stored so the callback can redirect back to it
// (supports both localhost dev and production).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID    = (Deno.env.get("YOUTUBE_CLIENT_ID") ?? "").trim();
const REDIRECT_URI = (Deno.env.get("YOUTUBE_REDIRECT_URI") ?? "").trim();
const APP_ORIGIN   = (Deno.env.get("APP_ORIGIN") ?? "").trim();

/* ── CONSTANTS ────────────────────────────────────────────────────────────── */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

const STATE_TTL_MS   = 10 * 60 * 1000;
const RATE_MAX       = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// Origins allowed to initiate OAuth and receive the callback redirect
const ALLOWED_ORIGINS = new Set([
  "https://www.tryzyvo.com",
  "http://localhost:5173",
]);

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

  const { user, authError } = await requireUser(req);
  if (authError || !user) {
    return err(req, "Unauthorized", 401);
  }

  if (!CLIENT_ID || !REDIRECT_URI) {
    console.error("[yt-oauth-start] Missing YOUTUBE_CLIENT_ID or YOUTUBE_REDIRECT_URI");
    return err(req, "YouTube OAuth not configured", 500);
  }

  // Determine the caller's origin for the return redirect.
  // Browser always sends Origin header on cross-origin fetch.
  const requestOrigin = req.headers.get("origin") ?? "";
  const returnToOrigin = ALLOWED_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : (ALLOWED_ORIGINS.has(APP_ORIGIN) ? APP_ORIGIN : "https://www.tryzyvo.com");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Rate limit: max RATE_MAX OAuth starts per user per hour
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await sb
    .from("social_oauth_states")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("platform", "youtube")
    .gte("created_at", since);

  if ((count ?? 0) >= RATE_MAX) {
    return err(req, "Too many connection attempts. Please try again later.", 429);
  }

  // Generate cryptographically random state
  const rawState  = randomHex(32);
  const stateHash = await sha256Hex(rawState);
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

  // Try insert with return_to_origin; fall back without it if column doesn't exist yet.
  let insertErr = (await sb.from("social_oauth_states").insert({
    user_id:          user.id,
    platform:         "youtube",
    state_hash:       stateHash,
    expires_at:       expiresAt,
    return_to_origin: returnToOrigin,
  })).error;

  if (insertErr) {
    // Column may not exist yet — retry without it
    if (insertErr.message?.includes("return_to_origin")) {
      console.warn("[yt-oauth-start] return_to_origin column missing, inserting without it");
      insertErr = (await sb.from("social_oauth_states").insert({
        user_id:    user.id,
        platform:   "youtube",
        state_hash: stateHash,
        expires_at: expiresAt,
      })).error;
    }
  }

  if (insertErr) {
    console.error("[yt-oauth-start] State insert failed:", insertErr.message);
    return err(req, "Failed to initiate connection. Please try again.", 500);
  }

  const params = new URLSearchParams({
    client_id:              CLIENT_ID,
    redirect_uri:           REDIRECT_URI,
    response_type:          "code",
    scope:                  SCOPES,
    access_type:            "offline",
    prompt:                 "consent",
    include_granted_scopes: "true",
    state:                  rawState,
  });

  const authorizationUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  return ok(req, { authorizationUrl, url: authorizationUrl });
});
