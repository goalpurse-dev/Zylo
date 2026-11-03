import { useState } from "react";
import { Navigate } from "react-router-dom";
import { StepBar } from "../../ui/zyvo";
import { BLOCKY_WORLDS_ENABLED } from "../../../data/blockyWorlds";
import useIsDesktop from "../cutaway-explainer/hooks/useIsDesktop";
import useBlockyWorlds from "./hooks/useBlockyWorlds";
import ResultPanel from "./ResultPanel";
import ScriptStep from "./ScriptStep";
import StoryStep from "./StoryStep";

const STEPS = ["Story", "Script", "Video"];

/**
 * The Blocky Worlds workspace (the same layout as the other short-form templates): create on the left, the video on the
 * right; on phones one panel at a time. Refusals from the server open the app's own flows: SIGN_IN -> sign up,
 * UPGRADE -> the upgrade popup, CREDITS -> add credits; anything else is a calm notice. Nothing is charged before Generate.
 */
export default function BlockyWorldsStudio({ access: pageAccess, onSignUp, onUpgrade, onNoCredits, balance = 0 }) {
  const isDesktop = useIsDesktop();
  const flow = useBlockyWorlds();
  const [panel, setPanel] = useState("create");
  const [notice, setNotice] = useState(null);

  const handleError = (error) => {
    if (!error) return;
    if (error.code === "SIGN_IN") onSignUp?.();
    else if (error.code === "UPGRADE") onUpgrade?.();
    else if (error.code === "CREDITS") onNoCredits?.(error.credits ?? flow.access?.prices?.[flow.lengthSec]);
    else setNotice(error.code === "NOT_READY" ? error.problems?.[0] ?? error.message : error.message);
  };
  /** Run an action behind the page's gates (signed out -> sign up; writing on the free plan -> upgrade). */
  const gated = async (fn, { write = false } = {}) => {
    if (pageAccess === "guest") { onSignUp?.(); return; }
    if (write && pageAccess === "free") { onUpgrade?.(); return; }
    setNotice(null);
    const r = await fn();
    if (r && !r.ok) handleError(r.error);
  };
  const handleGenerate = async () => {
    const price = flow.access?.prices?.[flow.lengthSec] ?? 0;
    if (balance > 0 && balance < price) { onNoCredits?.(price); return; }
    await gated(async () => { const r = await flow.generate(); if (r.ok) setPanel("result"); return r; }, { write: true });
  };

  // the template is behind its own switch: wait for the server's answer, and send visitors it isn't open to away
  if (!flow.access) return <div className="grid h-full w-full place-items-center bg-[#0B0D0F]" aria-busy="true" aria-label="Loading"><span className="h-10 w-10 animate-pulse rounded-full bg-lime-300/20" /></div>;
  if (!flow.access.visible && !BLOCKY_WORLDS_ENABLED) return <Navigate to="/" replace />;

  const step = flow.run ? 2 : flow.draft ? 1 : 0;
  const builder = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#0E1012] p-4">
      <StepBar steps={STEPS} current={step} />
      {flow.draft
        ? <ScriptStep flow={flow} notice={notice} onGenerate={handleGenerate} onBack={() => { flow.startOver(); setNotice(null); }} />
        : <StoryStep flow={flow} onGate={gated} />}
      {!flow.draft && notice && <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-[11.5px] text-white/70" role="status">{notice}</p>}
      {flow.access?.mock && <p className="text-center text-[10px] text-amber-200/60">Test mode: sample ideas and scripts, nothing is charged.</p>}
    </div>
  );
  const result = <ResultPanel run={flow.run} recent={flow.recent} onOpen={(r) => { flow.openRun(r); setPanel("result"); }} onEvent={flow.sendEvent} />;

  if (isDesktop) {
    return (
      <div className="flex h-full w-full gap-3 overflow-hidden bg-[#0B0D0F] p-3">
        <div className="h-full w-[440px] shrink-0 xl:w-[480px]">{builder}</div>
        <div className="h-full min-w-0 flex-1 overflow-hidden">{result}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0B0D0F]">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0D0F] px-3 py-3">
        <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {[["create", "Create"], ["result", "Video"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPanel(id)} aria-pressed={panel === id} className={`rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${panel === id ? "bg-white text-black" : "text-white/60"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(110px+env(safe-area-inset-bottom))] pt-3">{panel === "create" ? builder : result}</div>
    </div>
  );
}
