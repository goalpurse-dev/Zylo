import { useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { authError, EMAIL_WAIT_SECONDS, formatCountdown } from "../../lib/authErrors";
import { useCooldown } from "../../hooks/useCooldown";

// When this browser last asked for a reset link, and for which address: closing
// the dialog and opening it again continues the same countdown.
const SENT_KEY = "zyvo:reset-sent";
function secondsUntilNextSend(email) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SENT_KEY) ?? "null");
    if (!saved || saved.email !== email.trim().toLowerCase()) return 0;
    return Math.max(0, Math.ceil((saved.until - Date.now()) / 1000));
  } catch { return 0; }
}
function rememberSend(email, seconds) {
  try { sessionStorage.setItem(SENT_KEY, JSON.stringify({ email: email.trim().toLowerCase(), until: Date.now() + seconds * 1000 })); } catch { /* no storage: the countdown lives in this view only */ }
}

const input = "w-full bg-[#121314] rounded-xl px-4 py-[11px] text-white text-sm placeholder-white/20 outline-none transition focus:ring-1 focus:ring-[#9F5CFF]/60 [&:-webkit-autofill]:shadow-[0_0_0_1000px_#121314_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]";
const primary = "w-full py-[11px] rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50";

/**
 * "Forgot password?": an email field and "Send reset link", then a "Check your
 * inbox" screen whose resend button counts down. Used inside the sign-in dialog
 * and on /auth/forgot.
 *
 * initialEmail: what the visitor already typed. onBack(): back to sign in.
 * notice: a line above the form (e.g. "That link has expired").
 */
export default function ForgotPassword({ initialEmail = "", onBack, notice }) {
  const [email, setEmail] = useState(initialEmail);
  const [stage, setStage] = useState("form"); // form | sent
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentBefore, setSentBefore] = useState(false); // the link went out earlier, not on this press
  const cooldown = useCooldown(); // until this address may be sent another link
  const busy = useCooldown();     // Supabase's general "slow down": nothing can be sent for a moment

  const waitFor = (seconds, earlier) => {
    rememberSend(email, seconds);
    cooldown.start(seconds);
    setSentBefore(earlier);
    setStage("sent");
  };

  const send = async () => {
    setError("");
    // Asked a moment ago (this browser remembers): show the same screen, don't ask Supabase again.
    const left = secondsUntilNextSend(email);
    if (left > 0) { waitFor(left, true); return; }

    setSending(true);
    const { error: failed } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Where the link in the email lands: /auth/confirm, set in the email
      // template. This address is only used by emails sent with the older template.
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setSending(false);
    if (!failed) { waitFor(EMAIL_WAIT_SECONDS, false); return; }

    const problem = authError(failed, "Couldn't send the email. Try again.");
    // "Wait N seconds" means a link was sent a moment ago: same screen, with the wait Supabase named.
    if (problem.sentRecently) waitFor(problem.waitSeconds, true);
    // Any other "slow down": nothing was sent, the button counts down until it is worth trying again.
    else if (problem.rateLimited) { busy.start(problem.waitSeconds); setStage("form"); }
    else setError(problem.message);
  };

  const back = onBack && (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-white/45 text-xs hover:text-white/80 transition">
      <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
    </button>
  );

  if (stage === "sent") {
    const waiting = cooldown.secondsLeft > 0;
    return (
      <div data-testid="reset-sent">
        <div className="w-11 h-11 rounded-full bg-[#9F5CFF]/15 flex items-center justify-center mb-4">
          <MailCheck className="w-5 h-5 text-[#B58CFF]" />
        </div>
        <h2 className="text-white text-[20px] font-bold mb-2">Check your inbox</h2>
        <p className="text-white/60 text-sm leading-relaxed">
          {sentBefore ? "We sent a reset link a moment ago to " : "If there is a Zyvo account for "}
          <span className="text-white font-medium break-all">{email.trim()}</span>
          {sentBefore ? "." : ", a link to reset your password is on its way."}
        </p>
        <p className="text-white/45 text-sm leading-relaxed mt-2">
          It can take a minute. Check your spam folder too.
        </p>

        <button type="button" onClick={send} disabled={waiting || sending} className={`${primary} mt-6`} data-testid="reset-resend">
          {sending ? "Sending…" : waiting ? `Resend in ${formatCountdown(cooldown.secondsLeft)}` : "Resend email"}
        </button>
        {error && <p role="alert" className="text-red-400 text-xs mt-3">{error}</p>}

        <div className="flex items-center justify-between mt-5">
          {back || <span />}
          <button type="button" onClick={() => { setStage("form"); setError(""); }} className="text-[#A87AFF] text-xs font-semibold hover:text-purple-300 transition">
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} data-testid="reset-form">
      <h2 className="text-white text-[20px] font-bold mb-1">Reset your password</h2>
      <p className="text-white/45 text-sm mb-6">Enter your email and we'll send you a link to set a new password.</p>
      {notice && <p className="text-amber-300/90 text-xs mb-4 rounded-lg bg-amber-300/[0.07] px-3 py-2">{notice}</p>}

      <label className="text-white/50 text-xs mb-1.5 block" htmlFor="reset-email">Email</label>
      <input
        id="reset-email"
        type="email"
        autoComplete="email"
        autoFocus
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={input}
      />
      {error && <p role="alert" className="text-red-400 text-xs mt-3">{error}</p>}

      {busy.secondsLeft > 0 && <p role="status" className="text-white/55 text-xs mt-3">We can't send the email right this second. It's nothing you did.</p>}

      <button type="submit" disabled={sending || busy.secondsLeft > 0} className={`${primary} mt-4`}>
        {sending ? "Sending…" : busy.secondsLeft > 0 ? `Try again in ${formatCountdown(busy.secondsLeft)}` : "Send reset link"}
      </button>
      {back && <div className="mt-5">{back}</div>}
    </form>
  );
}
