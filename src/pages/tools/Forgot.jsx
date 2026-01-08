import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk(false);
    setSending(true);
    try {
      const redirectTo = `${window.location.origin}/auth/reset`;
      const { error } =// Forgot.jsx (you already have this)
await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setOk(true);
    } catch (e2) {
      setErr(e2.message || "Could not send reset email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* back arrow */}
      <div className="fixed left-4 top-4 z-10">
<Link
  to="/login"
  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white hover:bg-black/5 transition"
  aria-label="Back"
>
  <ArrowLeft className="h-5 w-5" />
</Link>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-full max-w-md text-center lg:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold">Forgot password</h1>
            <p className="mt-1 text-sm text-black/70">
              Enter your email and we’ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full h-12 rounded-full border border-gray-300 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#007BFF]/30"
              />

              <button
                type="submit"
                disabled={sending}
                className="w-full h-12 rounded-full bg-[#007BFF] text-white text-[15px] font-semibold hover:opacity-95 disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send reset link"}
              </button>

              {err && <p className="text-sm text-red-600">{err}</p>}
              {ok && (
                <div className="text-sm text-green-600">
                  Reset email sent. Check your inbox.
                  <div className="mt-2">
                    <Link
                      to="/auth/reset"
                      className="underline text-green-700 hover:text-green-800"
                    >
                      Open reset page
                    </Link>{" "}
                    (works after opening the link from your email).
                  </div>
                </div>
              )}
            </form>

            <div className="mt-4 text-sm text-black/70">
              Remembered it?{" "}
              <Link to="/login" className="text-[#007BFF] hover:underline">
                Back to log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
