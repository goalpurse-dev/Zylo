// src/lib/auth.js (helpers stay here)
import { supabase } from "./supabaseClient";

/** Create account with email + password (friendlier errors) */
// src/lib/auth.js
export async function signUpWithEmailPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // session exists only if email confirmations are OFF
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
