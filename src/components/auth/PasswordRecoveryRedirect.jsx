import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

// Reset emails sent with the older template don't come through /auth/confirm:
// they land on whatever page Supabase allows, with the session (or "this link
// expired") after the # in the address. Read here, when the app loads, before
// the Supabase client clears it.
const hash = typeof window === "undefined" ? "" : window.location.hash;
const arrivedByResetLink = /[#&]type=recovery(&|$)/.test(hash);
const arrivedByExpiredLink = /[#&]error_code=otp_expired(&|$)/.test(hash);

/**
 * Sends a visitor who arrived by such a link to "set a new password", wherever
 * the link dropped them. Without it the link only signs them in and never asks
 * for the new password. Renders nothing.
 */
export default function PasswordRecoveryRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") navigate("/auth/reset", { replace: true });
    });
    if (arrivedByExpiredLink) navigate("/auth/reset", { replace: true, state: { expired: true } });
    else if (arrivedByResetLink) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) navigate("/auth/reset", { replace: true });
      });
    }
    return () => subscription.unsubscribe();
  }, [navigate]);
  return null;
}
