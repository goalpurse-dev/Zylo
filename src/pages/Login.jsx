// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AUTH_BUTTON, AUTH_INPUT, AuthPage, GoogleButton, OrUseEmail } from "../components/auth/AuthSplit.jsx";
import { signInWithEmailPassword, signInWithGoogle } from "../lib/auth";
import { authError, formatCountdown, isEmailNotConfirmed } from "../lib/authErrors";
import ConfirmEmailNotice from "../components/auth/ConfirmEmailNotice.jsx";
import { useCooldown } from "../hooks/useCooldown";

export default function Login() {

  useEffect(() => {
  document.title = "Log Into Zyvo Account";
}, []);


  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [confirmFor, setConfirmFor] = useState(""); // this address still has to be confirmed
  const cooldown = useCooldown(); // Supabase said "slow down": the button counts down instead of a red error

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setConfirmFor("");
    setLoading(true);
    try {
      await signInWithEmailPassword(email, password);
      navigate("/"); // go to home/dashboard after login
    } catch (e2) {
      const problem = authError(e2, "Login failed.");
      if (problem.rateLimited) cooldown.start(problem.waitSeconds);
      else if (isEmailNotConfirmed(e2)) setConfirmFor(email);
      else setErr(problem.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErr("");
    try {
      await signInWithGoogle(); // redirects
    } catch (e2) {
      setErr(authError(e2, "Google sign-in failed.").message);
    }
  };

  return (
    <AuthPage>
      <Link to="/" aria-label="Back" className="fixed left-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/10">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <h2 className="text-[24px] font-black tracking-tight text-white">Welcome back</h2>
      <p className="mb-5 mt-1 text-sm text-white/55">Log in and keep creating.</p>

      <GoogleButton onClick={handleGoogle} />
      <OrUseEmail />

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          aria-label="Email address"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className={AUTH_INPUT}
        />
        <input
          type="password"
          required
          value={password}
          aria-label="Password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={AUTH_INPUT}
        />

        {/* Forgot password */}
        <div className="text-right">
          <Link to="/auth/forgot" state={{ email }} className="text-sm font-semibold text-lime-300 hover:underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading || cooldown.secondsLeft > 0} className={AUTH_BUTTON}>
          {loading ? "Signing in..." : cooldown.secondsLeft > 0 ? `Try again in ${formatCountdown(cooldown.secondsLeft)}` : "Log in"}
        </button>

        {cooldown.secondsLeft > 0 && <p role="status" className="text-sm text-white/60">Too many tries in a short time. It's nothing you did.</p>}

        {err && <p className="text-sm text-red-400">{err}</p>}
        {confirmFor && <ConfirmEmailNotice email={confirmFor} />}
      </form>

      <p className="mt-4 text-center text-sm text-white/55">
        No account?{" "}
        <Link to="/signup" className="font-bold text-lime-300 hover:underline">
          Create one
        </Link>
      </p>
    </AuthPage>
  );
}
