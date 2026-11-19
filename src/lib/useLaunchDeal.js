// The In This Town launch deal on the website (owner, 2026-11-19): Starter 20% off the first month, new customers,
// until Sunday 22 Nov 23:59 Finnish. The window lives in ONE file, supabase/functions/_shared/launchDeal.js, which
// create-checkout-session also reads (the real limit): what the page shows and what checkout charges can't drift
// apart. After the end everything disappears by itself.
import { useEffect, useState } from "react";
import { LAUNCH_DEAL, launchDealMsLeft, launchDealPrice } from "../../supabase/functions/_shared/launchDeal.js";
import { formatCountdown } from "../../supabase/functions/_shared/offer.js";

export { LAUNCH_DEAL, launchDealPrice };

/**
 * { live, msLeft, countdown, percentOff } — ticks every second while the deal runs.
 * Starts as NOT live and decides after mount: the prerendered HTML never carries the deal, so a page built before
 * the deadline can't show it after the deadline.
 */
export function useLaunchDeal() {
  const [msLeft, setMsLeft] = useState(0);
  useEffect(() => {
    const tick = () => setMsLeft(launchDealMsLeft(Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return { live: msLeft > 0, msLeft, countdown: formatCountdown(msLeft), percentOff: LAUNCH_DEAL.percentOff };
}

/** Shown to this viewer? Not to someone who has (or had) a paid plan: the deal is for new customers only. */
export const launchDealForViewer = (deal, account) => deal.live && !account?.hasSub && !account?.isPaid;
