// send-welcome-email/index.ts — the welcome email of the signed-in user, once per new account.
//
// The caller proves who they are with their Supabase session token; the email
// goes to THAT account's own address. No address or user id is read from the
// request, so this cannot be used to send mail to anyone else.
// The app asks when "Building your plan" finishes, or when someone skips the survey ({ trigger: "plan_finished" }).
// Sent only with onboarding_settings.welcome_email_on (off until the owner says so) and only to accounts in the new flow:
// existing accounts are never enrolled, so they never get it.
//
// { test: true } with the x-ops-secret header: one proof copy to the owner (the first of ADMIN_EMAILS), whatever the switch
// says; no address is read from the request here either.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { checkEmailAddress, REPLY_TO, WELCOME_SENDER } from "../_shared/emailRules.js";
import { claimEmail, FINAL_REASONS, sendClaimedEmail } from "../_shared/userEmail.ts";
import { welcomeEmail, welcomePlainEmail, WELCOME_SUBJECT, WELCOME_WHY } from "../_shared/welcomeEmail.js";
import { signupBonusMsLeft } from "../_shared/signupBonus.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// The version new users get. "plain" (the personal note, welcomePlainEmail) waits for the owner's ok (2026-11-03);
// the owner's test can ask for either with { style: "plain" }.
type Style = "classic" | "plain";
const USER_STYLE: Style = "classic";
const version = (style: Style, bonusEndsAt: string | null = null) => style === "plain"
  ? { render: (footer: any) => welcomePlainEmail(footer), plain: true }
  : { render: (footer: any) => welcomeEmail(footer, { bonusEndsAt }), plain: false };

// One proof copy for the owner. The "campaign" tag is what makes resend-webhook keep its delivered and opened events.
async function sendOwnerTest(req: Request, style: Style) {
  const to = (Deno.env.get("ADMIN_EMAILS") ?? "").split(",")[0]?.trim();
  const address = checkEmailAddress(to ?? "");
  if (!address.ok) return err(req, "No owner address", 500);
  const { data: profile } = await admin.from("profiles").select("id").eq("email", address.email).limit(1).maybeSingle();
  if (!profile?.id) return err(req, "No owner profile", 500);
  const claim = await claimEmail(admin, address.email, `welcome_test_${Date.now()}`, "test");
  if (!claim.ok) return ok(req, { skipped: claim.reason });
  const sent = await sendClaimedEmail(admin, {
    claimId: claim.id, to: address.email, userId: profile.id, from: WELCOME_SENDER, replyTo: REPLY_TO.founder,
    subject: WELCOME_SUBJECT, why: WELCOME_WHY, ...version(style),
    tags: [{ name: "kind", value: "welcome_test" }, { name: "campaign", value: "welcome_test" }],
  });
  return sent ? ok(req, { success: true, test: true }) : err(req, "Email failed", 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  const body = await req.json().catch(() => ({}));

  const opsSecret = Deno.env.get("OPS_HEALTH_SECRET") ?? "";
  if (body?.test === true && opsSecret && req.headers.get("x-ops-secret") === opsSecret) return await sendOwnerTest(req, body?.style === "plain" ? "plain" : "classic");

  // 1. Who is asking: the session token, checked by Supabase Auth.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: null, error: null } as any;
  const user = auth?.user;
  if (authError || !user?.id || !user.email) return err(req, "Not signed in", 401);
  // (an older page asking at sign-up gets nothing)
  if (body?.trigger !== "plan_finished") return ok(req, { skipped: "no_trigger" });

  // 2. The switch, and the new flow only.
  const { data: settings } = await admin.from("onboarding_settings").select("welcome_email_on").eq("id", 1).maybeSingle();
  if (settings?.welcome_email_on !== true) return ok(req, { skipped: "paused" });
  const { data: onboarding } = await admin.from("user_onboarding").select("enrolled, email_consent_at").eq("user_id", user.id).maybeSingle();
  if (onboarding?.enrolled !== true) return ok(req, { skipped: "not_in_new_flow" });

  // 3. One per account: only the request that flips the flag goes on.
  const { data: claimed, error: flagError } = await admin.from("profiles")
    .update({ welcome_email_sent: true }).eq("id", user.id).eq("welcome_email_sent", false).select("id");
  if (flagError) return err(req, "Failed to send email", 500);
  if (!claimed?.length) {
    const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
    return ok(req, profile ? { already_sent: true } : { retry: true }); // no profile row yet: the app may try again
  }
  const giveFlagBack = () => admin.from("profiles").update({ welcome_email_sent: false }).eq("id", user.id);

  // 4. An address that can't be right gets no email (the flag stays: nothing to retry).
  const address = checkEmailAddress(user.email);
  if (!address.ok) {
    await logEvent("send-welcome-email", "info", "welcome_skipped", { userId: user.id, reason: address.reason });
    return ok(req, { skipped: address.reason });
  }

  // 5. An offer only for someone who ticked the opt-in, with the bonus's real end time while it still runs.
  let bonusEndsAt: string | null = null;
  if (onboarding.email_consent_at) {
    const { data: bonus } = await admin.from("signup_bonuses").select("expires_at").eq("user_id", user.id).maybeSingle();
    if (bonus?.expires_at && signupBonusMsLeft(bonus.expires_at) > 0) bonusEndsAt = bonus.expires_at;
  }

  // 6. The gate, then the send.
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
    from: WELCOME_SENDER,
    replyTo: REPLY_TO.founder,
    subject: WELCOME_SUBJECT,
    why: WELCOME_WHY,
    ...version(USER_STYLE, bonusEndsAt),
    tags: [{ name: "kind", value: "welcome" }, { name: "campaign", value: "welcome" }],
  });
  if (!sent) {
    await giveFlagBack();
    return err(req, "Email failed", 500);
  }
  // the page's "check your spam" note shows only after this
  const { error: markError } = await admin.from("user_onboarding").update({ welcome_sent_at: new Date().toISOString() }).eq("user_id", user.id);
  if (markError) console.error("[send-welcome-email] welcome_sent_at not saved:", markError.message);
  return ok(req, { success: true });
});
