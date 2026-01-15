// src/pages/auth/AuthCallback.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const completeAuth = async () => {
      try {
        const url = window.location.href;

        // 1️⃣ Force PKCE exchange (fixes iOS Safari)
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(url);

        if (exchangeError) {
          console.error("OAuth exchange failed:", exchangeError);
        }

        // 2️⃣ Wait one tick so Safari can write cookies
        await new Promise((r) => setTimeout(r, 100));

        // 3️⃣ Now safely read the session
        const { data, error } = await supabase.auth.getSession();

        if (error || !data?.session) {
          console.error("Session missing after OAuth:", error);
          navigate("/login", { replace: true });
          return;
        }

        // ✅ SUCCESS
        navigate("/workspace", { replace: true });
      } catch (err) {
        console.error("Auth callback fatal error:", err);
        navigate("/login", { replace: true });
      }
    };

    completeAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Finishing sign in…</p>
    </div>
  );
}
