// src/lib/auth.js (helpers stay here)
import { supabase } from "./supabaseClient";
import { readFirstTouch } from "./firstTouch";

function firstTouchSignUpOptions() {
  const firstTouch = readFirstTouch();
  if (!firstTouch) return undefined;
  return {
    data: {
      first_touch_landing_page: firstTouch.landingPage,
      first_touch_utm_source: firstTouch.utm_source,
      first_touch_utm_medium: firstTouch.utm_medium,
      first_touch_utm_campaign: firstTouch.utm_campaign,
    },
  };
}

/** Create account with email + password (friendlier errors) */
// src/lib/auth.js
export async function signUpWithEmailPassword(email, password) {

  const { data, error } = await supabase.auth.signUp({ email, password, options: firstTouchSignUpOptions() });

  if (error) throw error;

  // ✅ ONLY SEND HERE (not in Signup.jsx)
  if (data?.user) {
    try {
      await fetch("/api/send-welcome-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.user.email,
          user_id: data.user.id, // 🔥 CRITICAL
        }),
      });
    } catch (err) {
      console.error("Welcome email failed:", err);
    }
  }

  if (data.session) {
    return { status: "created", user: data.user, session: data.session };
  }

  return { status: "pending", user: data.user, session: null };
}
/** Login with email + password */
export async function signInWithEmailPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export { signInWithEmailPassword as signInWithEmail };
export { signUpWithEmailPassword as signUpWithEmail };

/** OAuth — Google */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
  return data;
}

/** Logout */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
