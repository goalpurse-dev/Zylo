import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronUp, Copy, X } from "lucide-react";
import { clearHandoff, readHandoff } from "../../lib/directorHandoff";
import { directorPath } from "../../data/styles";
import { trackCreate } from "./useCatalog";

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ } }} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-white/[0.14]">
      {done ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

/**
 * THE PLAN CARD: on the template page a Director plan was sent to (and its results), a small card with the plan's
 * script + scene notes to copy, and "Change something", which sends the text back to the Director. Mounted once in
 * the workspace layout, so no template page is changed.
 */
export default function DirectorPlanCard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [h, setH] = useState(null);
  const [open, setOpen] = useState(true);
  const [ask, setAsk] = useState("");
  useEffect(() => { setH(readHandoff()); }, [location.pathname]);
  if (!h || !location.pathname.startsWith(h.path)) return null;

  const change = (e) => {
    e.preventDefault();
    if (!ask.trim()) return;
    trackCreate("plan_change_from_result", { style: h.styleId });
    navigate(`${directorPath(h.draftId)}?ask=${encodeURIComponent(ask.trim().slice(0, 400))}`);
  };

  return (
    <aside className="fixed bottom-[calc(86px+env(safe-area-inset-bottom))] right-3 z-[95] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-lime-300/25 bg-[#141618]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,.6)] backdrop-blur lg:bottom-28 lg:right-5" aria-label="Your plan" data-testid="plan-card">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-black text-[#11150D]">YOUR PLAN</span>
          <span className="truncate text-[13px] font-semibold text-white">{h.title || h.topic}</span>
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-white/50" /> : <ChevronUp className="h-4 w-4 shrink-0 text-white/50" />}
          <span className="sr-only">{open ? "Fold" : "Open"}</span>
        </button>
        <button type="button" onClick={() => { clearHandoff(); setH(null); }} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-white/45 hover:text-white"><X className="h-3.5 w-3.5" />Close</button>
      </div>
      {open && (
        <div className="mt-2">
          <p className="text-[12px] leading-snug text-white/60">
            {h.inputKind === "topic" ? "Your idea is filled in. Want the plan's exact words? Copy them in." : "Paste the script into this page's script box to use your plan's exact words."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton text={h.script} label="Copy script" />
            <CopyButton text={h.notes} label="Copy script + scene notes" />
            <button type="button" onClick={() => navigate(directorPath(h.draftId))} className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-lime-200 hover:bg-lime-300/10">Back to the plan</button>
          </div>
          <form onSubmit={change} className="mt-3 flex gap-2">
            <label htmlFor="plan-card-ask" className="sr-only">Change something</label>
            <input id="plan-card-ask" value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={400} placeholder="Change something…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[13px] text-white placeholder:text-white/35 focus:border-lime-300/40 focus:outline-none" />
            <button type="submit" className="rounded-lg bg-lime-300 px-3 py-2 text-[12px] font-bold text-[#11150D]">Send</button>
          </form>
        </div>
      )}
    </aside>
  );
}
