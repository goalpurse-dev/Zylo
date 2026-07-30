import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { peekSeoDraft } from "../lib/seoDraft";

const WORKSPACE_ROUTE_BY_TEMPLATE = { "two-am": "/workspace/two-am" };

function postAuthDestination() {
  const draft = peekSeoDraft();
  return (draft && WORKSPACE_ROUTE_BY_TEMPLATE[draft.templateId]) || "/workspace/home";
}

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // detectSessionInUrl processes the ?code= param automatically.
    // Listen for the SIGNED_IN event then forward the user.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate(postAuthDestination(), { replace: true });
      }
    });

    // If session is already present (e.g. page reload), redirect immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(postAuthDestination(), { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#090A0A] flex items-center justify-center">
      <p className="text-white/40 text-sm">Signing you in…</p>
    </div>
  );
}
