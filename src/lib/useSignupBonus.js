// The viewer's sign-up bonus, with its real time left (_shared/signupBonus.js). The end time comes from the server; the
// webhook is what really checks it. The owner's walk-through shows an example time instead.
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "./supabaseClient";
import { adminPreviewMode } from "./onboarding";
import { SIGNUP_BONUS, signupBonusLine } from "../../supabase/functions/_shared/signupBonus.js";

const EXAMPLE_MS = (2 * 24 + 14) * 3600 * 1000 + 30 * 60 * 1000;
const TICK_MS = 30000;

/** { line, head, tail, credits }: line is null while unknown, without a bonus, and the moment it ends. head and tail keep "ends in 2 days 14 h" unbroken on a phone. */
export function useSignupBonus() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const demo = adminPreviewMode() === "demo";
  const [expiresAt, setExpiresAt] = useState(() => (demo ? Date.now() + EXAMPLE_MS : null));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (demo || !userId) return undefined;
    let live = true;
    supabase.from("signup_bonuses").select("expires_at").eq("user_id", userId).maybeSingle()
      .then(({ data }) => { if (live && data?.expires_at) setExpiresAt(data.expires_at); }, () => {});
    return () => { live = false; };
  }, [demo, userId]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [expiresAt]);

  const line = expiresAt ? signupBonusLine(expiresAt, now) : null;
  const cut = line ? line.indexOf("ends in") : -1;
  return { line, head: cut > 0 ? line.slice(0, cut) : line, tail: cut > 0 ? line.slice(cut) : "", credits: SIGNUP_BONUS.credits };
}
