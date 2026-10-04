import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { peekSeoDraft } from "../lib/seoDraft";
import { POST_AUTH_RETURN_KEY } from "../components/AuthModal.jsx";

const WORKSPACE_ROUTE_BY_TEMPLATE = { "two-am": "/workspace/two-am" };

// A page that opened the sign-up dialog may ask to get the visitor back (an
// in-app path, used once, at most an hour old).
function savedReturnPath() {
  try {
    const raw = localStorage.getItem(POST_AUTH_RETURN_KEY);
    if (!raw) return null;
    localStorage.removeItem(POST_AUTH_RETURN_KEY);
    const { path, at } = JSON.parse(raw);
    return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && Date.now() - Number(at) < 3_600_000 ? path : null;
  } catch { return null; }
}
let returnPath; // read once per page load (the callback effect can run twice)
function postAuthDestination() {
  if (returnPath === undefined) returnPath = savedReturnPath();
  if (returnPath) return returnPath;
  const draft = peekSeoDraft();
  return (draft && WORKSPACE_ROUTE_BY_TEMPLATE[draft.templateId]) || "/";
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
