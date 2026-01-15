// src/pages/Signup.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import OAuthButton from "../components/auth/OAuthButton";
import { signUpWithEmailPassword, signInWithGoogle } from "../lib/auth";
import v32 from "../assets/library/v32.mp4";

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

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setLoading(true);
    try {
      const res = await signUpWithEmailPassword(email, password);
if (res.session) {
  navigate("/workspace");
} else {
  setMsg("Account created. Check your email to confirm your account.");
}

    } catch (e2) {
      const msg = String(e2?.message || "");
      if (msg.toLowerCase().includes("already registered")) {
        setErr("That email is already registered. Try logging in.");
      } else {
        setErr(msg || "Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setErr(""); setMsg("");
    try { await signInWithGoogle(); } 
    catch (e2) { setErr(e2.message || "Google sign-in failed."); }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="fixed left-4 top-4 z-10">
        <Link
          to="/home"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white hover:bg-black/5 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="min-h-screen flex items-center justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center w-full">
            <div className="max-w-md w-full mx-auto text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold">Create an account</h1>
              <p className="mt-1 text-sm text-black/70">Start free. Upgrade when you’re ready.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full h-12 rounded-full border border-gray-300 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#007BFF]/30"
                />
                <input
                  type="password" minLength={6} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  className="w-full h-12 rounded-full border border-gray-300 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#007BFF]/30"
                />
                <button
                  type="submit" disabled={loading}
                  className="w-full h-12 rounded-full bg-[#007BFF] text-white text-[15px] font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {loading ? "Creating..." : "Continue"}
                </button>

                {err && <p className="text-sm text-red-600">{err}</p>}
                {msg && <p className="text-sm text-green-600">{msg}</p>}
              </form>

              <div className="mt-3 text-sm text-black/70">
                Already have an account?{" "}
                <Link to="/login" className="text-[#007BFF] hover:underline">Log in</Link>
              </div>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px bg-gray-200 flex-1" />
                <div className="text-xs uppercase tracking-widest text-black/40">or</div>
                <div className="h-px bg-gray-200 flex-1" />
              </div>

              <div className="mx-auto w-full">
                <OAuthButton provider="google" onClick={handleGoogle}>
                  Continue with Google
                </OAuthButton>
              </div>

              <div className="mt-3 text-xs text-black/50">
                By continuing, you agree to our{" "}
                <Link to="/terms" className="underline">Terms</Link> and{" "}
                <Link to="/privacy" className="underline">Privacy Policy</Link>.
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-[36px] overflow-hidden shadow-xl ring-1 ring-black/10">
                <video
                  src={v32}
                  className="w-full h-[580px] object-cover"
                  autoPlay muted loop playsInline controls={false}
                  poster="/assets/auth/intro-poster.jpg"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
