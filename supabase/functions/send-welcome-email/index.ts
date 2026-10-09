// send-welcome-email/index.ts — the welcome email of the signed-in user, once per account.
//
// The caller proves who they are with their Supabase session token; the email
// goes to THAT account's own address. Nothing in the request body is read: no
// address, no user id, so this cannot be used to send mail to anyone else.
// (It replaces the Vercel endpoint api/send-welcome-email.js: here the email
// passes the email gate and carries the unsubscribe link and the footer.)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { checkEmailAddress, REPLY_TO, SENDERS } from "../_shared/emailRules.js";
import { claimEmail, FINAL_REASONS, sendClaimedEmail } from "../_shared/userEmail.ts";
import { welcomeEmail, WELCOME_SUBJECT, WELCOME_WHY } from "../_shared/welcomeEmail.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  // 1. Who is asking: the session token, checked by Supabase Auth.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: null, error: null } as any;
  const user = auth?.user;
  if (authError || !user?.id || !user.email) return err(req, "Not signed in", 401);

  // 2. One per account: only the request that flips the flag goes on.
  const { data: claimed, error: flagError } = await admin.from("profiles")
    .update({ welcome_email_sent: true }).eq("id", user.id).eq("welcome_email_sent", false).select("id");
  if (flagError) return err(req, "Failed to send email", 500);
  if (!claimed?.length) {
    const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
    return ok(req, profile ? { already_sent: true } : { retry: true }); // no profile row yet: the app may try again
  }
  const giveFlagBack = () => admin.from("profiles").update({ welcome_email_sent: false }).eq("id", user.id);

  // 3. An address that can't be right gets no email (the flag stays: nothing to retry).
  const address = checkEmailAddress(user.email);
  if (!address.ok) {
    await logEvent("send-welcome-email", "info", "welcome_skipped", { userId: user.id, reason: address.reason });
    return ok(req, { skipped: address.reason });
  }

  // 4. The gate, then the send.
  const claim = await claimEmail(admin, address.email, "welcome", "account");
  if (!claim.ok) {
    if (!FINAL_REASONS.has(claim.reason)) await giveFlagBack();
    await logEvent("send-welcome-email", "info", "welcome_skipped", { userId: user.id, reason: claim.reason });
    return ok(req, { skipped: claim.reason });
  }
  const sent = await sendClaimedEmail(admin, {
    claimId: claim.id,
    to: address.email,
    userId: user.id,
    from: SENDERS.founder,
    replyTo: REPLY_TO.founder,
    subject: WELCOME_SUBJECT,
    why: WELCOME_WHY,
    render: welcomeEmail,
    tags: [{ name: "kind", value: "welcome" }],
  });
  if (!sent) {
    await giveFlagBack();
    return err(req, "Email failed", 500);
  }
  return ok(req, { success: true });
});
