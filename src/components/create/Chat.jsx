import { useEffect, useRef } from "react";
import Logo from "../../assets/logo-mark.webp";

/**
 * THE CHAT LAYOUT every studio result uses (AI Studio, the Director): your messages on the right, Zyvo's on the left
 * with its logo, results arriving inside Zyvo's messages, and the composer pinned to the bottom (above the phone bar).
 */
export function ChatScroll({ children, deps = [] }) {
  const end = useRef(null);
  const seen = useRef(JSON.stringify(deps));
  // new message: scroll it into view (smooth unless the device asks for less motion). Only when the messages really
  // changed (not on opening the page, which always opens at the top; also safe when React runs effects twice)
  useEffect(() => {
    const key = JSON.stringify(deps);
    if (key === seen.current) return undefined;
    seen.current = key;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // the workspace scrolls inside #workspace-scroll (not the window): scroll that to the bottom, after paint
    const id = requestAnimationFrame(() => {
      const sc = document.getElementById("workspace-scroll");
      if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: reduce ? "auto" : "smooth" });
      else end.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4 px-3 pb-6 pt-4 sm:px-4" data-testid="chat-thread">
      {children}
      <div ref={end} />
    </div>
  );
}

export function UserBubble({ children, meta }) {
  return (
    <div className="flex justify-end" data-role="user">
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div className="rounded-[20px] rounded-br-md bg-gradient-to-br from-lime-300 to-lime-400 px-4 py-2.5 text-[15px] font-medium leading-snug text-[#11150D] shadow-[0_8px_30px_rgba(190,242,100,.18)]">{children}</div>
        {meta && <div className="mt-1 flex flex-wrap justify-end gap-1">{meta}</div>}
      </div>
    </div>
  );
}

export function ZyvoBubble({ children, wide = false }) {
  return (
    <div className="flex items-start gap-2.5" data-role="assistant">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-lime-300/30 bg-[#16191b] shadow-[0_0_18px_rgba(190,242,100,.15)]">
        <img src={Logo} alt="Zyvo" className="h-5 w-5 object-contain" />
      </span>
      <div className={`min-w-0 ${wide ? "flex-1" : "max-w-[88%] sm:max-w-[75%]"}`}>
        <div className="rounded-[20px] rounded-tl-md border border-white/[0.09] bg-[#15181a] px-4 py-3 text-[15px] leading-relaxed text-white/90">{children}</div>
      </div>
    </div>
  );
}

export function MetaChip({ children }) {
  return <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-white/70">{children}</span>;
}

/** "Zyvo is typing" dots */
export function Thinking({ label = "Working on it" }) {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] text-white/80">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-lime-300" style={{ animationDelay: `${i * 120}ms` }} />)}
      </span>
      {label}
    </span>
  );
}

/** the composer's frame: pinned to the bottom of the page, above the phone's bottom bar */
export function ComposerDock({ children }) {
  return (
    <div className="sticky bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 px-3 pb-3 lg:bottom-0 lg:px-6 lg:pb-5">
      <div className="mx-auto w-full max-w-[820px] rounded-[22px] border border-white/[0.12] bg-[#141618]/95 p-3 shadow-[0_-12px_50px_rgba(0,0,0,.55),0_0_0_1px_rgba(190,242,100,.04)] backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}
