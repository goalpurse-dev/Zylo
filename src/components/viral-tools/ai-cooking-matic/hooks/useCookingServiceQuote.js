import { useCallback, useEffect, useState } from "react";
import { quoteCookingMaticService } from "../api/cookingMaticApi";

/**
 * The Cooking Matic service fee for the signed-in user's plan, as quoted by
 * the server (the same helper begin_cooking_matic_generation charges with).
 *
 *   status: "guest" (not signed in, nothing to quote) | "loading" | "ready" | "error"
 *   value:  { serviceCredits, voiceLimit, plan, allowed } once ready
 *
 * planCode is only a re-quote trigger; the server reads the real plan.
 */
export default function useCookingServiceQuote(signedIn, planCode) {
  const [state, setState] = useState({ status: signedIn ? "loading" : "guest", value: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!signedIn) {
      setState({ status: "guest", value: null });
      return undefined;
    }
    let cancelled = false;
    setState((prev) => (prev.value ? prev : { status: "loading", value: null }));
    quoteCookingMaticService()
      .then((value) => { if (!cancelled) setState({ status: "ready", value }); })
      .catch(() => { if (!cancelled) setState({ status: "error", value: null }); });
    return () => { cancelled = true; };
  }, [signedIn, planCode, attempt]); // re-quote when the plan changes (upgrade)

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
