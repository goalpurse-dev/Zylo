import { Link } from "react-router-dom";
import { ArrowRight, Gift } from "lucide-react";
import { useOffer } from "../../lib/useOffer";

// The +50 bonus offer's banners (owner, 2026-10-26). Both render nothing outside the offer window.

function Countdown({ countdown, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-[#0B0D0F] px-2.5 py-0.5 font-mono text-[12px] font-bold tabular-nums text-lime-300 sm:text-[13px] ${className}`} aria-label={`Ends in ${countdown}`}>
      {countdown}
    </span>
  );
}

/** /pricing: the big banner at the top. */
export function OfferBanner() {
  const { live, countdown, bonus } = useOffer();
  if (!live) return null;
  return (
    <div className="rounded-2xl bg-lime-300 px-5 py-4 text-[#0B0D0F] shadow-[0_0_0_1px_rgba(190,242,100,0.4),0_12px_40px_-12px_rgba(190,242,100,0.55)] sm:px-7 sm:py-5" data-testid="offer-banner" role="region" aria-label="Limited-time offer">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="flex items-center gap-2.5 text-[17px] font-black leading-tight tracking-[-0.01em] sm:text-[21px]">
          <Gift className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span>+{bonus} bonus credits on every plan — ends Sunday</span>
        </p>
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em]">
          Ends in <Countdown countdown={countdown} />
        </p>
      </div>
    </div>
  );
}

/** Home: the news bar at the very top, linking to /pricing. */
export function OfferBar() {
  const { live, countdown, bonus } = useOffer();
  if (!live) return null;
  return (
    <Link to="/pricing" className="group block w-full bg-lime-300 text-[#0B0D0F]" data-testid="offer-bar">
      <div className="mx-auto flex min-h-9 items-center justify-center gap-2.5 px-3 py-1.5 text-[12.5px] font-black sm:gap-3 sm:text-[13.5px]">
        <Gift className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
        <span className="min-w-0 truncate">+{bonus} bonus credits on every plan until Sunday</span>
        <Countdown countdown={countdown} className="shrink-0" />
        <span className="hidden shrink-0 items-center gap-1 underline-offset-2 group-hover:underline sm:inline-flex">See plans <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
      </div>
    </Link>
  );
}

/** A plan card's credits: "750 + 50 bonus" while the offer runs, else the plain number. */
export function OfferCredits({ credits }) {
  const { live, bonus } = useOffer();
  return (
    <>
      {credits.toLocaleString("en-US")}
      {live && (
        <span className="ml-1.5 inline-flex items-center rounded-md bg-lime-300 px-1.5 py-0.5 align-middle text-[14px] font-black tracking-normal text-[#0B0D0F]" data-testid="offer-credits">
          + {bonus} bonus
        </span>
      )}
    </>
  );
}
