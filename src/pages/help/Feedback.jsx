// src/pages/help/Feedback.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentBrand } from "../../lib/brandSession";
import { ArrowLeft, MessageSquare, Send } from "lucide-react";

const wrap = "mx-auto w-full max-w-[720px] px-4 lg:px-2";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Feedback() {
  const q = useQuery();
  const navigate = useNavigate();
  const tool = q.get("for") || "Zylo";

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOk(false);

    try {
      // session + email
      const { data: sessionRes } = await supabase.auth.getSession();
      const access = sessionRes?.session?.access_token;
      const userEmailFromSession = sessionRes?.session?.user?.email || undefined;

      // brand info (safe optional)
      const brand = getCurrentBrand?.() || {};
      const brandId = brand?.id || null;
      const brandName = brand?.name || null;

      const headers = access ? { Authorization: `Bearer ${access}` } : undefined;

      const { data, error } = await supabase.functions.invoke("submit-feedback", {
        body: {
          tool,
          message,
          brandId,
          brandName,
          email: userEmailFromSession, // optional reply-to
        },
        headers,
      });

      if (error) {
        // Try to read the server's JSON error for a helpful message
        let serverMsg = "";
        try {
          const res = error?.context?.response;
          if (res) {
            const j = await res.json();
            serverMsg = j?.error || j?.message || "";
          }
        } catch {}
        setError(serverMsg || error.message || "Edge Function returned a non-2xx status code");
        return;
      }

      if (data?.ok) {
        setOk(true);
        setMessage("");
      } else {
        setError("Unexpected response from server");
      }
    } catch (err) {
      setError(err?.message || "Failed to send feedback");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#0b0f14] text-white py-10">
      <div className={wrap}>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-3 py-2 text-sm hover:bg-white/10"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="rounded-2xl border border-white/10 bg-[#10151d] p-6 md:p-8">
          <div className="mb-4 flex items-center gap-2 text-white/90">
            <MessageSquare size={18} />
            <h1 className="text-xl md:text-2xl font-bold">Give feedback for {tool}</h1>
          </div>

          <p className="text-white/70 text-sm">
            Tell us what worked, what didn’t, or what you wish this tool could do better.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              placeholder="Write your feedback…"
              className="w-full rounded-xl border border-white/10 bg-white/[.04] p-4 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-[#7A3BFF]"
            />

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#7A3BFF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6a2fff] disabled:opacity-60"
            >
              <Send size={16} />
              {loading ? "Sending…" : "Send feedback"}
            </button>

            {ok && <div className="text-green-400 text-sm">Thanks! Your feedback has been sent.</div>}
            {error && <div className="text-red-400 text-sm">{error}</div>}
          </form>
        </div>
      </div>
    </main>
  );
}
