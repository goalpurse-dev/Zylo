import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import Logo from "../assets/Logo.png";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function AuthModal({ mode: initialMode, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isSignup = mode === "signup";

  const switchMode = () => {
    setMode(isSignup ? "login" : "signup");
    setError("");
    setSuccess("");
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/workspace/home` },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (data.session) onClose(); // confirmations off — signed in immediately
      else setSuccess("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onClose();
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email above first."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/workspace/home`,
    });
    if (error) setError(error.message);
    else setSuccess("Password reset link sent — check your email.");
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* card — single col on mobile, two col on lg+ */}
      <div className="relative z-10 flex w-full max-w-[420px] lg:max-w-[760px] rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.8)]">

        {/* ── LEFT IMAGE PANEL (desktop only) ── */}
        <div className="hidden lg:flex relative w-[42%] shrink-0 self-stretch min-h-[500px] overflow-hidden">
          <img
            src="/home/login.png"
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* light bottom scrim only where branding text sits */}
          <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-gradient-to-t from-black/70 to-transparent" />
          {/* bottom branding */}
          <div className="absolute bottom-6 left-6 right-6 z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <img src={Logo} className="w-6 h-6 object-contain drop-shadow-lg" />
              <span className="text-white font-black text-base tracking-tight">Zyvo</span>
            </div>
            <p className="text-white/55 text-[12px] leading-snug">
              Create viral content with AI — images, videos, stories & more.
            </p>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="flex-1 bg-[#1B1D1F] p-7 relative">

          {/* close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition"
          >
            <X className="w-4 h-4" />
          </button>

          {/* header */}
          <h2 className="text-white text-[20px] font-bold mb-1">
            {isSignup ? "Welcome to Zyvo" : "Welcome back"}
          </h2>
          <p className="text-white/45 text-sm mb-6">
            {isSignup ? "Sign up and generate for free" : "Sign in and continue creating"}
          </p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-[11px] rounded-xl bg-[#121314] border-0 hover:bg-[#1e2022] text-white font-semibold text-sm transition"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-white/30 text-xs shrink-0">
              {isSignup ? "Or use email to sign up" : "Or use email to sign in"}
            </span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          {/* form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Email</label>
              <div className="rounded-xl overflow-hidden bg-[#121314]">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#121314] rounded-none px-4 py-[11px] text-white text-sm placeholder-white/20 outline-none transition [&:-webkit-autofill]:shadow-[0_0_0_1000px_#121314_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-white/50 text-xs">Password</label>
                {!isSignup && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[#9F5CFF] text-xs hover:text-purple-300 transition"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="rounded-xl overflow-hidden bg-[#121314]">
                <input
                  type="password"
                  placeholder={isSignup ? "Create a password" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#121314] rounded-none px-4 py-[11px] text-white text-sm placeholder-white/20 outline-none transition [&:-webkit-autofill]:shadow-[0_0_0_1000px_#121314_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}
            {success && <p className="text-emerald-400 text-xs">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-[11px] rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white font-semibold text-sm hover:opacity-90 transition mt-1 disabled:opacity-50"
            >
              {loading ? "Please wait…" : isSignup ? "Continue" : "Sign in"}
            </button>
          </form>

          {/* switch mode */}
          <p className="text-white/35 text-sm text-center mt-5">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button
              onClick={switchMode}
              className="text-[#A87AFF] font-semibold hover:text-purple-300 transition"
            >
              {isSignup ? "Sign in" : "Sign up for free"}
            </button>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
