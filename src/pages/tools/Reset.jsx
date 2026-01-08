// src/pages/tools/Reset.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";     // ⬅️ NEW
import { supabase } from "../../lib/supabaseClient";

function useAuthParams() {
  return useMemo(() => {
    const hash = window.location.hash?.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    const hs = new URLSearchParams(hash);
    const qs = new URLSearchParams(window.location.search);
    const access_token  = hs.get("access_token")  || qs.get("access_token");
    const refresh_token = hs.get("refresh_token") || qs.get("refresh_token");
    const type          = hs.get("type")          || qs.get("type");
    return { access_token, refresh_token, type };
  }, []);
}

export default function Reset() {
  const nav = useNavigate();                        // ⬅️ NEW
  const { access_token, refresh_token, type } = useAuthParams();

  const [stage, setStage] = useState(
    access_token && refresh_token && type === "recovery" ? "checking" : "missing"
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");
  const [err, setErr]           = useState("");

  useEffect(() => {
    (async () => {
      if (stage !== "checking") return;
      try {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;
        setStage("ready");
      } catch (e) {
        setErr(e.message || "This link is invalid or expired. Please request a new reset link.");
        setStage("error");
      }
    })();
  }, [stage, access_token, refresh_token]);

 async function handleSubmit(e) {
  e.preventDefault();
  setErr("");
  setMsg("");

  if (password.length < 6) return setErr("Password must be at least 6 characters.");
  if (password !== confirm) return setErr("Passwords do not match.");

  setSaving(true);
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    // 🔒 Force a clean state: log out the temporary recovery session
    await supabase.auth.signOut(); // local is enough; use { scope: "global" } if you want to revoke all devices

    setMsg("Password updated. Please log in with your new password.");
    setStage("done"); // your UI already shows the “Back to log in” button in this stage
  } catch (e) {
    setErr(e.message || "Could not update password.");
  } finally {
    setSaving(false);
  }
}

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Reset password</h1>
        <p className="text-sm text-black/70 mb-6">Set a new password for your account.</p>

        {stage === "missing" && (
          <div className="text-red-600">
            This link is invalid or missing tokens. Please request a new reset link.
          </div>
        )}

        {stage === "checking" && (
          <div className="text-black/70">Validating reset link…</div>
        )}

        {(stage === "ready" || stage === "done") && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="New password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 rounded-full border border-gray-300 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#007BFF]/30"
              disabled={stage === "done"}
              minLength={6}
              required
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-12 rounded-full border border-gray-300 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#007BFF]/30"
              disabled={stage === "done"}
              minLength={6}
              required
            />

            <button
              type="submit"
              disabled={saving || stage === "done"}
              className="w-full h-12 rounded-full bg-[#007BFF] text-white text-[15px] font-semibold hover:opacity-95 disabled:opacity-60"
            >
              {saving ? "Updating…" : "Update password"}
            </button>

            {err && <p className="text-sm text-red-600">{err}</p>}
            {msg && <p className="text-sm text-green-600">{msg}</p>}

            {/* ⬇️ NEW: show Back to login after success */}
            {stage === "done" && (
              <button
                type="button"
                onClick={() => nav("/login")}
                className="w-full h-12 rounded-full border border-black/10 bg-black/5 text-[15px] font-semibold hover:bg-black/10 mt-2"
              >
                Back to log in
              </button>
            )}
          </form>
        )}

        {stage === "error" && (
          <div className="text-red-600 mt-2">
            {err || "This link is invalid or expired. Please request a new reset link."}
          </div>
        )}
      </div>
    </div>
  );
}
