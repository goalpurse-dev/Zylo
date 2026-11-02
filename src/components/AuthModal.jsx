import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { readFirstTouch } from "../lib/firstTouch";
import { rememberSignupRoute } from "../lib/onboarding";
import { authError, formatCountdown, isEmailNotConfirmed } from "../lib/authErrors";
import ConfirmEmailNotice from "./auth/ConfirmEmailNotice.jsx";
import { checkSignupEmail } from "../lib/emailCheck";
import { useCooldown } from "../hooks/useCooldown";
import ForgotPassword from "./auth/ForgotPassword.jsx";
import { AUTH_BUTTON, AUTH_INPUT, AuthPitch, GoogleButton, OrUseEmail } from "./auth/AuthSplit.jsx";

// Where to land after signing in when the browser leaves the page on the way
// (Google, or the link in the confirmation email): pages/AuthCallback.jsx reads it once.
export const POST_AUTH_RETURN_KEY = "zyvo:post-auth-return";

// title / subtitle: a heading for a specific moment ("Create a free account to
// start your video"). returnTo: an in-app path to come back to after sign-up.
// onClose(signedIn): true when the dialog closed because the visitor is now signed in.
// onSignUp(): called when a sign-up goes through here (a new email account that is
// signed in at once, or the moment the browser leaves for Google).
export default function AuthModal({ mode: initialMode, onClose, title, subtitle, returnTo, onSignUp }) {
  const [mode, setMode] = useState(initialMode);
  const [view, setView] = useState("form"); // form | forgot ("Forgot password?" has its own view)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const cooldown = useCooldown(); // Supabase said "slow down": the button counts down instead of a red error

  const isSignup = mode === "signup";
  const [confirmFor, setConfirmFor] = useState(""); // this address still has to be confirmed
  const fail = (failed) => {
    const problem = authError(failed);
    if (problem.rateLimited) cooldown.start(problem.waitSeconds);
    else if (isEmailNotConfirmed(failed)) setConfirmFor(email);
    else setError(problem.message);
  };

  const switchMode = () => {
    setMode(isSignup ? "login" : "signup");
    setError("");
    setSuccess("");
  };

  const rememberReturn = () => { if (returnTo) { try { localStorage.setItem(POST_AUTH_RETURN_KEY, JSON.stringify({ path: returnTo, at: Date.now() })); } catch { /* no storage: lands on Home */ } } };
  const signupRoute = (how) => `${returnTo ? "generate" : "popup"}_${how}`;
  const handleGoogle = async () => {
    rememberReturn();
    rememberSignupRoute(signupRoute("google"));
    onSignUp?.();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setConfirmFor("");
    if (isSignup) {
      // A typo, a throwaway inbox or a domain with no mail server never becomes an account.
      const check = await checkSignupEmail(email);
      if (!check.ok) { setError(check.message); setLoading(false); return; }
      const firstTouch = readFirstTouch();
      rememberReturn();
      rememberSignupRoute(signupRoute("email"));
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: firstTouch
          ? {
              ...(returnTo ? { emailRedirectTo: `${window.location.origin}/auth/callback` } : {}),
              data: {
                first_touch_landing_page: firstTouch.landingPage,
                first_touch_utm_source: firstTouch.utm_source,
                first_touch_utm_medium: firstTouch.utm_medium,
                first_touch_utm_campaign: firstTouch.utm_campaign,
              },
            }
          : returnTo ? { emailRedirectTo: `${window.location.origin}/auth/callback` } : undefined,
      });
      if (error) fail(error);
      else if (data.session) { onSignUp?.(); onClose(true); } // confirmations off — signed in immediately
      else setConfirmFor(email); // "Confirm email" is on in Supabase: the link in the email signs them in
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) fail(error);
      else onClose(true);
    }
    setLoading(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4" data-zyvo-modal="auth">
      {/* backdrop */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => onClose(false)} />

      {/* the pitch, then the form: side by side on lg+, stacked on phones */}
      <div className="relative z-10 flex w-full max-w-[440px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#090A0A] shadow-[0_32px_80px_rgba(0,0,0,0.8)] lg:max-w-[920px] lg:flex-row">

        {/* ── THE PITCH ── */}
        <div className="relative shrink-0 overflow-hidden p-5 lg:flex lg:w-[50%] lg:items-center lg:p-9">
          <div className="pointer-events-none absolute -left-24 -top-24 h-[340px] w-[340px] rounded-full bg-lime-300/[0.1] blur-[90px]" />
          <AuthPitch inModal />
        </div>

        {/* ── THE FORM ── */}
        <div className="relative flex-1 bg-[#161816] p-5 sm:p-7">

          {/* close */}
          <button
            onClick={() => onClose(false)}
            aria-label="Close"
            className="absolute right-4 top-4 text-white/40 transition hover:text-white/80"
          >
            <X className="w-5 h-5" />
          </button>

          {view === "forgot" ? (
            <div className="lg:min-h-[444px] flex flex-col justify-center">
              <ForgotPassword initialEmail={email} onBack={() => setView("form")} />
            </div>
          ) : (<>
          {/* header */}
          <h2 className="pr-6 text-white text-[22px] font-black tracking-tight mb-1">
            {isSignup ? title ?? "Create your free account" : "Welcome back"}
          </h2>
          <p className="text-white/55 text-sm mb-5">
            {isSignup ? subtitle ?? "Start free. Upgrade when you're ready." : "Sign in and continue creating"}
          </p>

          <GoogleButton onClick={handleGoogle} />
          <OrUseEmail />

          {/* form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              aria-label="Email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={AUTH_INPUT}
            />

            <div>
              <input
                type="password"
                aria-label="Password"
                placeholder={isSignup ? "Create a password" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={AUTH_INPUT}
              />
              {!isSignup && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => { setError(""); setSuccess(""); setView("forgot"); }}
                    className="text-lime-300 text-xs font-semibold hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}
            {success && <p className="text-emerald-400 text-xs">{success}</p>}
            {confirmFor && <ConfirmEmailNotice email={confirmFor} />}
            {cooldown.secondsLeft > 0 && <p role="status" className="text-white/55 text-xs">Too many tries in a short time. It's nothing you did.</p>}

            <button
              type="submit"
              disabled={loading || cooldown.secondsLeft > 0}
              className={AUTH_BUTTON}
            >
              {loading ? "Please wait…" : cooldown.secondsLeft > 0 ? `Try again in ${formatCountdown(cooldown.secondsLeft)}` : isSignup ? "Create my account" : "Sign in"}
            </button>
          </form>

          {/* switch mode */}
          <p className="text-white/35 text-sm text-center mt-5">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button
              onClick={switchMode}
              className="text-lime-300 font-bold hover:underline"
            >
              {isSignup ? "Sign in" : "Sign up for free"}
            </button>
          </p>
          </>)}
        </div>
      </div>
    </div>,
    document.body
  );
}
