// The +50 bonus offer on the website (owner, 2026-10-26). The window lives in ONE file,
// supabase/functions/_shared/offer.js, which the Stripe webhook also reads: what the page shows
// and what the webhook gives can't drift apart. After the end everything disappears by itself.
import { useEffect, useState } from "react";
import { OFFER, formatCountdown, offerMsLeft } from "../../supabase/functions/_shared/offer.js";

export { OFFER };

/**
 * { live, msLeft, countdown } — ticks every second while the offer runs.
 * Starts as NOT live and decides after mount: the prerendered HTML never carries the offer, so a
 * page built before the deadline can't show it after the deadline.
 */
export function useOffer() {
  const [msLeft, setMsLeft] = useState(0);
  useEffect(() => {
    const tick = () => setMsLeft(offerMsLeft(Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return { live: msLeft > 0, msLeft, countdown: formatCountdown(msLeft), bonus: OFFER.bonusCredits };
}
