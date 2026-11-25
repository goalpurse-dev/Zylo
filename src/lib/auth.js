// src/lib/auth.js (helpers stay here)
import { supabase } from "./supabaseClient";
import { readFirstTouch } from "./firstTouch";
import { checkSignupEmail } from "./emailCheck";

// extraData: more fields for the new account's user_metadata (the sign-up form's creator code).
function firstTouchSignUpOptions(extraData = {}) {
  const firstTouch = readFirstTouch();
  if (!firstTouch && !Object.keys(extraData).length) return undefined;
  return {
    data: {
      ...(firstTouch ? {
        first_touch_landing_page: firstTouch.landingPage,
        first_touch_utm_source: firstTouch.utm_source,
        first_touch_utm_medium: firstTouch.utm_medium,
        first_touch_utm_campaign: firstTouch.utm_campaign,
      } : {}),
      ...extraData,
    },
  };
}

/** Create account with email + password (friendlier errors) */
// src/lib/auth.js
export async function signUpWithEmailPassword(email, password, extraData = {}) {

  // A typo, a throwaway inbox or a domain with no mail server never becomes an account.
  const check = await checkSignupEmail(email);
  if (!check.ok) throw new Error(check.message);

  const { data, error } = await supabase.auth.signUp({ email, password, options: firstTouchSignUpOptions(extraData) });

  if (error) throw error;

  // The welcome email goes out from one place for every sign-up route: components/onboarding/OnboardingGate.jsx.

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
