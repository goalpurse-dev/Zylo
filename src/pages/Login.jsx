// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import OAuthButton from "../components/auth/OAuthButton";
import { signInWithEmailPassword, signInWithGoogle } from "../lib/auth";

// Use your actual asset import (matches your pattern)
 import v32 from "../assets/symbols/bg.mp4"


export default function Login() {

  useEffect(() => {
  document.title = "Log Into Zyvo Account";
}, []);


  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await signInWithEmailPassword(email, password);
      navigate("/"); // go to home/dashboard after login
    } catch (e2) {
      setErr(e2.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErr("");
    try {
      await signInWithGoogle(); // redirects
    } catch (e2) {
      setErr(e2.message || "Google sign-in failed.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {/* top-left back arrow */}
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
            {/* LEFT: form */}
            <div className="max-w-md w-full mx-auto text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold">Log in</h1>
              <p className="mt-1 text-sm text-black/70">Welcome back.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full h-12 rounded-full border border-gray-300 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#007BFF]/30"
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-12 rounded-full border border-gray-300 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#007BFF]/30"
                />

                {/* Forgot password */}
                <div className="text-right -mt-2">
                  <Link to="/auth/forgot" className="text-sm text-[#7A3BFF] hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-full bg-[#7A3BFF] text-white text-[15px] font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Log in"}
                </button>

                {err && <p className="text-sm text-red-600">{err}</p>}
              </form>

              {/* Create account */}
              <div className="mt-3 text-sm text-black/70">
                No account?{" "}
                <Link to="/signup" className="text-[#7A3BFF] hover:underline">
                  Create one
                </Link>
              </div>

              {/* Divider + Google */}
              <div className="my-6 flex items-center gap-4">
                <div className="h-px bg-gray-200 flex-1" />
                <div className="text-xs uppercase tracking-widest text-black/40">or</div>
                <div className="h-px bg-gray-200 flex-1" />
              </div>

              <OAuthButton provider="google" onClick={handleGoogle}>
                Continue with Google
              </OAuthButton>
            </div>

            {/* RIGHT: video (hidden on mobile/tablet) */}
            <div className="hidden lg:block">
              <div className="rounded-[36px] overflow-hidden shadow-xl ring-1 ring-black/10">
                <video
                  src={v32}
                  className="w-full h-[580px] object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
