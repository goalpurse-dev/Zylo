// src/pages/auth/AuthCallback.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallback() {
  const nav = useNavigate();

  useEffect(() => {
    const finishAuth = async () => {
      try {
        // Supabase v2 automatically handles OAuth + PKCE
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          nav("/login", { replace: true });
          return;
        }

        if (data?.session) {
          // ✅ Logged in successfully
          nav("/workspace", { replace: true });
        } else {
          // ❌ No session → back to login
          nav("/login", { replace: true });
        }
      } catch (err) {
        console.error("Unexpected auth callback error:", err);
        nav("/login", { replace: true });
      }
    };

    finishAuth();
  }, [nav]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-black">Finishing sign in…</p>
    </div>
  );
}
