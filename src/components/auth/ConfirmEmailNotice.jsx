import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { authError, EMAIL_WAIT_SECONDS, formatCountdown } from "../../lib/authErrors";
import { useCooldown } from "../../hooks/useCooldown";

/**
 * "Check your inbox to confirm your email", shown after sign-up (and after a
 * sign-in that Supabase refuses with "email not confirmed") while Supabase's
 * "Confirm email" setting is on. The link in that email lands on /auth/confirm,
 * which signs the visitor in. "Send it again" counts down from a minute:
 * Supabase sends one email per address per minute.
 *
 * tone: "dark" (the sign-in dialog) or "light" (/signup).
 */
export default function ConfirmEmailNotice({ email, tone = "dark" }) {
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const cooldown = useCooldown(EMAIL_WAIT_SECONDS); // one just went out
  const text = tone === "light" ? "text-black/70" : "text-white/60";
  const strong = tone === "light" ? "text-black" : "text-white";
  const link = tone === "light" ? "text-[#6D28D9]" : "text-[#A87AFF]";

  const resend = async () => {
    setSending(true);
    setNote("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (!error) { cooldown.start(EMAIL_WAIT_SECONDS); setNote("Sent again."); return; }
    const problem = authError(error, "Couldn't send the email. Try again.");
    if (problem.rateLimited) cooldown.start(problem.waitSeconds);
    else setNote(problem.message);
  };

  const waiting = cooldown.secondsLeft > 0;
  return (
    <div role="status" data-testid="confirm-email-notice" className={`text-sm leading-relaxed ${text}`}>
      <p>
        Check your inbox: we sent a link to <span className={`font-medium break-all ${strong}`}>{email.trim()}</span>. Open it to confirm your email and you're in.
      </p>
      <p className="mt-1">It can take a minute. Check your spam folder too.</p>
      <button type="button" onClick={resend} disabled={waiting || sending} className={`mt-2 text-xs font-semibold disabled:opacity-50 ${link}`}>
        {sending ? "Sending…" : waiting ? `Send it again in ${formatCountdown(cooldown.secondsLeft)}` : "Send it again"}
      </button>
      {note && <span className="ml-2 text-xs">{note}</span>}
    </div>
  );
}
