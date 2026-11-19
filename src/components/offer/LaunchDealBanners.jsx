import { Link } from "react-router-dom";
import { ArrowRight, Tag } from "lucide-react";
import { useLaunchDeal } from "../../lib/useLaunchDeal";

// The In This Town launch deal's banners (owner, 2026-11-19): Starter 20% off the first month, new customers, until
// Sunday 23:59 Finnish. All render nothing outside the deal window (checkout adds the discount by itself).

function Countdown({ countdown, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-[#0B0D0F] px-2.5 py-0.5 font-mono text-[12px] font-bold tabular-nums text-lime-300 sm:text-[13px] ${className}`} aria-label={`Ends in ${countdown}`}>
      {countdown}
    </span>
  );
}

/** /pricing: the banner at the top. */
export function LaunchDealBanner() {
  const { live, countdown, percentOff } = useLaunchDeal();
  if (!live) return null;
  return (
    <div className="rounded-2xl bg-lime-300 px-5 py-4 text-[#0B0D0F] shadow-[0_0_0_1px_rgba(190,242,100,0.4),0_12px_40px_-12px_rgba(190,242,100,0.55)] sm:px-7 sm:py-5" data-testid="launch-deal-banner" role="region" aria-label="Launch deal">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="flex items-center justify-center gap-2.5 text-[17px] font-black leading-tight tracking-[-0.01em] sm:justify-start sm:text-[21px]">
            <Tag className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span>Launch deal: Starter is {percentOff}% off your first month</span>
          </p>
          <p className="mt-1 text-[12px] font-semibold opacity-70">New customers, monthly plan. Taken off at checkout, no code needed.</p>
        </div>
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em]">
          Ends in <Countdown countdown={countdown} />
        </p>
      </div>
    </div>
  );
}

/**
 * In This Town: a thin bar above the studio for visitors without a paid plan. onClick opens the upgrade popup
 * (signed in) or sign-up (guest); without onClick it links to /pricing.
 */
export function LaunchDealBar({ onClick }) {
  const { live, countdown, percentOff } = useLaunchDeal();
  if (!live) return null;
  const inner = (
    <div className="mx-auto flex min-h-9 items-center justify-center gap-2.5 px-3 py-1.5 text-[12.5px] font-black sm:gap-3 sm:text-[13.5px]">
      <Tag className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
      <span className="min-w-0 truncate">Launch deal: Starter {percentOff}% off your first month</span>
      <Countdown countdown={countdown} className="shrink-0" />
      <span className="hidden shrink-0 items-center gap-1 underline-offset-2 group-hover:underline sm:inline-flex">Get it <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
    </div>
  );
  const cls = "group block w-full shrink-0 bg-lime-300 text-[#0B0D0F]";
  return onClick
    ? <button type="button" onClick={onClick} className={cls} data-testid="launch-deal-bar">{inner}</button>
    : <Link to="/pricing" className={cls} data-testid="launch-deal-bar">{inner}</Link>;
}
