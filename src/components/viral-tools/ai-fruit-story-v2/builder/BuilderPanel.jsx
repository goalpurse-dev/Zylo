import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useNiche } from "../niches";

/**
 * Left builder panel (Cartoon Drive By shell).
 * Mobile: plain page content — #workspace-scroll is the only scroller — with
 * the footer fixed above the bottom nav. Desktop: the body scrolls on its own
 * and the footer sits at the bottom of the panel.
 */
export default function BuilderPanel({ top, children, footer, bodyKey }) {
  const reduce = useReducedMotion();
  const niche = useNiche();
  const panelRef = useRef(null);
  const footRef = useRef(null);

  // Keep the body's bottom padding equal to the fixed footer's real height on
  // mobile, so the last control is never hidden behind it.
  useLayoutEffect(() => {
    const foot = footRef.current;
    const panel = panelRef.current;
    if (!foot || !panel) return undefined;
    const sync = () => panel.style.setProperty("--fv2-foot", `${Math.ceil(foot.getBoundingClientRect().height)}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(foot);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={panelRef}
      aria-label="Story builder"
      className="relative flex flex-col rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(190,242,100,.05)] lg:h-full lg:min-h-0 lg:overflow-hidden"
    >
      <header className="shrink-0 border-b border-white/[0.06] px-5 pb-4 pt-4 lg:pb-3 lg:pt-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-lime-300/20 bg-lime-300/10">
            <Sparkles className="h-4 w-4 text-lime-300" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[18px] font-black tracking-[-0.03em] text-white">{niche.name}</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-300/65">{niche.tagline}</p>
          </div>
        </div>
        {top && <div className="mt-3 flex flex-col gap-3">{top}</div>}
      </header>

      <div className="px-5 pb-[max(150px,calc(var(--fv2-foot,72px)+96px+env(safe-area-inset-bottom)))] pt-4 [scrollbar-color:rgba(255,255,255,.2)_transparent] [scrollbar-width:thin] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pb-5">
        <AnimatePresence mode="wait" initial={false}>
          <Motion.div
            key={bodyKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
            transition={{ duration: reduce ? 0.01 : 0.18, ease: "easeOut" }}
            className="flex flex-col gap-5"
          >
            {children}
          </Motion.div>
        </AnimatePresence>
      </div>

      <div
        ref={footRef}
        className="fixed bottom-[calc(78px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5"
      >
        {footer}
      </div>
    </section>
  );
}

/** Step heading inside the builder body. */
export function StepHeading({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-[17px] font-black tracking-[-0.02em] text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-[12px] leading-relaxed text-white/45">{subtitle}</p>}
    </div>
  );
}

/** Small helper line under a footer button. */
export function FootNote({ children, tone = "muted" }) {
  return (
    <p className={`mt-2 text-center text-[10px] font-semibold leading-relaxed ${tone === "warn" ? "text-orange-300/80" : "text-white/35"}`}>
      {children}
    </p>
  );
}
