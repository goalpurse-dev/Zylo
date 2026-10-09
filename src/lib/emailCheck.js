// Is this an address a new account can use? Asked by the sign-up screens before
// supabase.auth.signUp, so a typo ("gmsil.com"), a throwaway inbox or a domain
// with no mail server never becomes an account.
// The rules are _shared/emailRules.js (the same file the email senders use); the
// check-email function adds the DNS lookup. If that function can't be reached,
// the local rules decide: a network hiccup must not block sign-ups.
import { supabase } from "./supabaseClient";
import { checkEmailAddress, emailProblemMessage } from "../../supabase/functions/_shared/emailRules.js";

// → { ok: true } or { ok: false, reason, suggestion?, message }
export async function checkSignupEmail(email) {
  let check = checkEmailAddress(email);
  if (check.ok) {
    try {
      const { data } = await supabase.functions.invoke("check-email", { body: { email: check.email } });
      if (data?.ok === false) check = { ...data, email: check.email };
    } catch { /* unreachable: the local rules already passed */ }
  }
  return check.ok ? { ok: true } : { ...check, message: emailProblemMessage(check) };
}
