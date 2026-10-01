// email-unsubscribe/index.ts — unsubscribe from Zyvo product emails (profiles.email_updates = false).
//
// Every link is signed per user: ?u=<profile id>&t=<token>, where token =
// base64url(HMAC-SHA256(EMAIL_UNSUBSCRIBE_SECRET, "unsub:" + u)) — see
// emails/unsubscribeLink.js. No login needed; a forged or edited link is refused.
//   POST            — unsubscribe. This is the RFC 8058 one-click target of the
//                     List-Unsubscribe header (Gmail/Yahoo's own Unsubscribe button
//                     posts "List-Unsubscribe=One-Click" here), and what the
//                     tryzyvo.com/unsubscribe page calls. Idempotent.
//   POST {action:"resubscribe"} — the page's Undo (same signed link).
//   GET             — never changes anything (link scanners prefetch GETs): it
//                     sends the reader to the tryzyvo.com/unsubscribe page.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { logEvent } from "../_shared/systemLog.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET") ?? "";
const PAGE = "https://tryzyvo.com/unsubscribe";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function tokenFor(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsub:${userId}`))));
}
// Constant-time compare.
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const url = new URL(req.url);
  const u = url.searchParams.get("u") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (req.method === "GET") {
    return new Response(null, { status: 302, headers: { Location: `${PAGE}?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}` } });
  }
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  if (!SECRET) return err(req, "Unsubscribe isn't configured", 500);
  if (!UUID.test(u) || !t || !same(t, await tokenFor(u))) return err(req, "This unsubscribe link isn't valid.", 400);

  // The one-click body is a form ("List-Unsubscribe=One-Click"); the page sends JSON.
  const type = req.headers.get("content-type") ?? "";
  const body: any = type.includes("application/json") ? await req.json().catch(() => ({})) : {};
  const resubscribe = body?.action === "resubscribe";
  const { data, error } = await admin.from("profiles").update({ email_updates: resubscribe }).eq("id", u).select("id").maybeSingle();
  if (error) return err(req, "Couldn't update your email settings. Try again.", 500);
  if (!data) return err(req, "This unsubscribe link isn't valid.", 400);
  await logEvent("email-unsubscribe", "info", resubscribe ? "email_resubscribed" : "email_unsubscribed", { userId: u, oneClick: !type.includes("application/json") });
  return ok(req, { ok: true, emailUpdates: resubscribe });
});
