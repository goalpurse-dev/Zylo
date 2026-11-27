import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Zap } from "lucide-react";
import { creditsFor, totalSeconds } from "../../data/styles";
import { markSent } from "../../lib/director";
import { handoffToZyvo } from "../../lib/directorHandoff";
import { trackCreate } from "./useCatalog";

/** "Make it on Zyvo": one click, the style's own template page with the plan handed over */
export function ZyvoOption({ draft, style, navigate }) {
  const [busy, setBusy] = useState(false);
  const credits = creditsFor(style, totalSeconds(draft) || draft.length_sec);
  const go = async () => {
    setBusy(true);
    const to = handoffToZyvo(draft, style);
    trackCreate("video_started", { style: style.id, where: "zyvo", target: "zyvo" });
    await markSent(draft.id, "zyvo", to).catch(() => {});
    navigate(to);
  };
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="choice-zyvo">
      <p className="flex items-center gap-2 text-[17px] font-black text-white"><Zap className="h-5 w-5 text-lime-300" />Make it on Zyvo</p>
      <p className="mt-1 text-[14px] text-white/65">We make the whole video for you: pictures, motion, voice, captions and music.</p>
      <p className="mt-3 text-[14px] text-white/80">about <span className="font-bold text-white">{credits}</span> credits</p>
      <p className="mt-1 text-[12px] text-white/45">You see the exact price on the next page before anything is charged.</p>
      <button type="button" onClick={go} disabled={busy} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-[15px] font-black text-[#11150D] hover:bg-lime-200 disabled:opacity-70">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}Make it on Zyvo
      </button>
    </div>
  );
}

/** the choice after the Director: where the video gets made */
export default function MakeChoice({ draft, style, plan, onClose, navigate, ClaudeOption = null }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/75 backdrop-blur-[6px]" onClick={onClose} />
      <section role="dialog" aria-label="Where should we make it?" className="relative max-h-[92dvh] w-full max-w-[860px] overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#121416] p-4 sm:rounded-[26px] sm:p-5" data-testid="make-choice">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-black text-white">Where should we make it?</h2>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-white/70 hover:text-white"><X className="h-3.5 w-3.5" />Close</button>
        </div>
        {/* the side the user picked in the prompt bar comes first, with a ring */}
        <div className={`mt-4 grid gap-3 ${ClaudeOption && style.worksInClaude ? "md:grid-cols-2" : ""}`}>
          {(() => {
            const claudeFirst = draft.extras?.where === "claude" && ClaudeOption && style.worksInClaude;
            const zyvo = <div key="z" className={!claudeFirst && draft.extras?.where === "zyvo" ? "rounded-2xl ring-2 ring-lime-300/60" : ""}><ZyvoOption draft={draft} style={style} navigate={navigate} /></div>;
            const claude = ClaudeOption && style.worksInClaude
              ? <div key="c" className={claudeFirst ? "rounded-2xl ring-2 ring-[#D97757]/70" : ""}><ClaudeOption draft={draft} style={style} plan={plan} /></div>
              : null;
            return claudeFirst ? [claude, zyvo] : [zyvo, claude];
          })()}
        </div>
      </section>
    </div>,
    document.body,
  );
}
