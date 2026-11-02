// src/pages/Signup.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AUTH_BUTTON, AUTH_INPUT, AuthPage, GoogleButton, OrUseEmail } from "../components/auth/AuthSplit.jsx";
import { signUpWithEmailPassword, signInWithGoogle } from "../lib/auth";
import { rememberSignupRoute } from "../lib/onboarding";
import { authError, formatCountdown } from "../lib/authErrors";
import { useCooldown } from "../hooks/useCooldown";
import ConfirmEmailNotice from "../components/auth/ConfirmEmailNotice.jsx";

export default function Signup() {

  useEffect(() => {
  document.title = "Create Your Zyvo Account";
}, []);

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirmFor, setConfirmFor] = useState(""); // the account exists; this address still has to be confirmed
  const cooldown = useCooldown(); // Supabase said "slow down": the button counts down instead of a red error

async function handleSubmit(e) {
  e.preventDefault();
  setErr(""); setMsg(""); setConfirmFor(""); setLoading(true);

  try {
    rememberSignupRoute("signup_page_email");
    const res = await signUpWithEmailPassword(email, password);

    if (res.status === "created") {

      // 🔥 SEND WELCOME EMAIL
      try {
      
      } catch (emailErr) {
        console.error("Welcome email failed:", emailErr);
      }

      if (res.session) {
        navigate("/");
      } else {
        setConfirmFor(email);
      }

    } else {
      // "Confirm email" is on in Supabase: no session until the link in the email is opened.
      setConfirmFor(email);
    }

  } catch (e2) {
    const problem = authError(e2, "Signup failed.");
    if (problem.rateLimited) cooldown.start(problem.waitSeconds);
    else setErr(problem.message);
  } finally {
    setLoading(false);
  }
}

  async function handleGoogle() {
    setErr(""); setMsg("");
    rememberSignupRoute("signup_page_google");
    try { await signInWithGoogle(); } 
    catch (e2) { setErr(authError(e2, "Google sign-in failed.").message); }
  }

  return (
    <AuthPage>
      <Link to="/" aria-label="Back" className="fixed left-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/10">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <h2 className="text-[24px] font-black tracking-tight text-white">Create your free account</h2>
      <p className="mb-5 mt-1 text-sm text-white/55">Start free. Upgrade when you're ready.</p>

      <GoogleButton onClick={handleGoogle} />
      <OrUseEmail />

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email" required value={email} aria-label="Email address"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className={AUTH_INPUT}
        />
        <input
          type="password" minLength={6} required value={password} aria-label="Password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          className={AUTH_INPUT}
        />
        <button type="submit" disabled={loading || cooldown.secondsLeft > 0} className={AUTH_BUTTON}>
          {loading ? "Creating..." : cooldown.secondsLeft > 0 ? `Try again in ${formatCountdown(cooldown.secondsLeft)}` : "Create my account"}
        </button>

        {cooldown.secondsLeft > 0 && <p role="status" className="text-sm text-white/60">Too many tries in a short time. It's nothing you did.</p>}

        {err && <p className="text-sm text-red-400">{err}</p>}
        {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        {confirmFor && <ConfirmEmailNotice email={confirmFor} />}
      </form>

      <p className="mt-4 text-center text-sm text-white/55">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-lime-300 hover:underline">Log in</Link>
      </p>

      <p className="mt-3 text-center text-xs text-white/40">
        By continuing, you agree to our{" "}
        <Link to="/support" className="underline">Terms</Link> and{" "}
        <Link to="/support" className="underline">Privacy Policy</Link>.
      </p>
    </AuthPage>
  );
}
