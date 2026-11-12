// The builder panel's parts, in Cartoon Drive By's layout: a scrolling body and the action pinned at the bottom (the
// panel's foot on desktop, fixed above the bottom nav on phones), so the next step is always one tap away.
import { useLayoutEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { FOCUS, cx } from "../../ui/zyvo";

/** The step's scrolling content. A step always opens at its top. */
export function StepBody({ children, className = "" }) {
  const ref = useRef(null);
  useLayoutEffect(() => { ref.current?.scrollTo?.(0, 0); }, []);
  return (
    <div ref={ref} className="min-h-0 flex-1 px-5 py-5 [scrollbar-color:rgba(255,255,255,.2)_transparent] [scrollbar-width:thin] lg:overflow-y-auto">
      <div className={cx("flex flex-col gap-6 pb-[190px] lg:pb-2", className)}>{children}</div>
    </div>
  );
}

/** The bar pinned under the step: phones keep it above the bottom nav, desktop at the panel's foot. */
export function ActionBar({ children, above = null }) {
  return (
    <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:z-auto lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-3">
      {above}
      {children}
    </div>
  );
}

/** The credits icon (the app's own, as on Cartoon Drive By's Generate). */
export function CreditMark({ className = "h-4 w-4" }) {
  return (
    <span aria-hidden="true" className={cx("shrink-0 bg-current", className)}
      style={{ WebkitMaskImage: "url('/icons/credits.png')", maskImage: "url('/icons/credits.png')", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain" }} />
  );
}

/** The big lime action (Cartoon Drive By's Generate button). busy: a label shown with a spinner. */
export function ActionButton({ children, onClick, disabled = false, busy = null, variant = "primary", className = "" }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || Boolean(busy)}
      className={cx("bw-press flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-black transition lg:py-3", FOCUS,
        busy ? "cursor-wait bg-lime-300/15 text-lime-300/60"
          : variant === "secondary" ? "border border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/[0.08] disabled:opacity-40"
            : "bg-lime-300 text-[#11150D] hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-lime-300/15 disabled:text-lime-300/40",
        className)}>
      {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{busy}</> : children}
    </button>
  );
}
