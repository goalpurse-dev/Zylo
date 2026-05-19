import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // detectSessionInUrl processes the ?code= param automatically.
    // Listen for the SIGNED_IN event then forward the user.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/workspace/home", { replace: true });
      }
    });

    // If session is already present (e.g. page reload), redirect immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/workspace/home", { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#090A0A] flex items-center justify-center">
      <p className="text-white/40 text-sm">Signing you in…</p>
    </div>
  );
}
