// src/pages/auth/AuthCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Finishing sign in…");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // 1) If Supabase sent an explicit error in the URL
        const urlErr =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error");
        if (urlErr) {
          setMsg(urlErr);
          return;
        }

        // 2) Password recovery links sometimes arrive as a hash:
        //    #access_token=...&type=recovery
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const type = hashParams.get("type");
        if (type === "recovery") {
          // Route the user to the reset screen (your form at /auth/reset)
          nav("/auth/reset", { replace: true });
          return;
        }

        // 3) OAuth (PKCE) flow may return ?code=...
        const code = url.searchParams.get("code");
        if (code) {
          setMsg("Exchanging code for a session…");
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (error) {
            setMsg(error.message || "Could not complete login.");
            return;
          }
          if (data?.session) {
            nav("/workspace", { replace: true });
            return;
          }
        }

        // 4) Fallback: if we already have a session, go home
        const { data: sess, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) {
          setMsg(sessErr.message || "Could not complete login.");
          return;
        }
        if (sess?.session) {
          nav("/workspace", { replace: true });
          return;
        }

        // Otherwise, nothing to do—send to login.
        nav("/login", { replace: true });
      } catch (e) {
        setMsg(e?.message || "Unexpected error.");
      }
    })();
  }, [nav]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-black">{msg}</p>
    </div>
  );
}
