import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { StepBar } from "../../ui/zyvo";
import { BLOCKY_WORLDS_ENABLED } from "../../../data/blockyWorlds";
import useIsDesktop from "../cutaway-explainer/hooks/useIsDesktop";
import useBlockyWorlds from "./hooks/useBlockyWorlds";
import ResultPanel from "./ResultPanel";
import ScriptStep from "./ScriptStep";
import StoryStep from "./StoryStep";
import "./blockyWorlds.css";

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
  const [peek, setPeek] = useState(null); // the idea card under the pointer: the preview plays its first line

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

  // what the live preview plays: the hovered idea, else the script, else our sample openers
  const preview = useMemo(() => {
    if (peek) return { lines: [peek.opener, peek.teaser], label: peek.title };
    if (flow.draft) return { lines: flow.draft.lines.map((l) => l.text), label: "Your script", meta: `Read by ${flow.access?.narrator?.name ?? "the narrator"} · about ${Math.round(flow.draft.check?.seconds ?? flow.lengthSec)} s` };
    return { lines: null, label: "Preview", meta: "Narrated, captioned and built in blocks. Vertical, ready to post." };
  }, [peek, flow.draft, flow.access, flow.lengthSec]);

  // the template is behind its own switch: wait for the server's answer, and send visitors it isn't open to away
  if (!flow.access) return <div className="grid h-full w-full place-items-center bg-[#0B0D0F]" aria-busy="true" aria-label="Loading"><span className="h-10 w-10 animate-pulse rounded-full bg-lime-300/20" /></div>;
  if (!flow.access.visible && !BLOCKY_WORLDS_ENABLED) return <Navigate to="/" replace />;

  const step = flow.run ? 2 : flow.draft ? 1 : 0;
  const builder = (
    <div className={isDesktop ? "flex h-full flex-col gap-5 overflow-y-auto px-8 pb-8 pt-6 xl:px-12" : "flex flex-col gap-5"}>
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
        <StepBar steps={STEPS} current={step} />
        <div key={flow.draft ? `script-${flow.draft.id}` : "story"} className="bw-step-in">
          {flow.draft
            ? <ScriptStep flow={flow} notice={notice} onGenerate={handleGenerate} onBack={() => { flow.startOver(); setNotice(null); setPeek(null); }} />
            : <StoryStep flow={flow} onGate={gated} onPeek={isDesktop ? setPeek : undefined} />}
        </div>
      {!flow.draft && notice && <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-[11.5px] text-white/70" role="status">{notice}</p>}
      {flow.access?.mock && <p className="text-center text-[10px] text-amber-200/60">Test mode: sample ideas and scripts, nothing is charged.</p>}
      </div>
    </div>
  );
  const result = <ResultPanel run={flow.run} recent={flow.recent} preview={preview} onOpen={(r) => { flow.openRun(r); setPanel("result"); }} onEvent={flow.sendEvent} />;

  if (isDesktop) {
    return (
      <div className="relative flex h-full w-full gap-3 overflow-hidden bg-[radial-gradient(120%_80%_at_20%_0%,#122016_0%,#0A0D0B_45%,#08090A_100%)] p-3">
        <Glow />
        <div className="relative h-full min-w-0 flex-1">{builder}</div>
        <div className="relative h-full w-[380px] shrink-0 xl:w-[420px]">{result}</div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[radial-gradient(140%_70%_at_30%_0%,#122016_0%,#0A0D0B_50%,#08090A_100%)]">
      <Glow />
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0D0B]/85 px-3 py-3 backdrop-blur">
        <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {[["create", "Create"], ["result", "Video"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPanel(id)} aria-pressed={panel === id} className={`rounded-full px-3 py-2 text-[13px] font-bold transition-all duration-300 ${panel === id ? "bg-lime-300 text-[#11150D] shadow-[0_0_18px_rgba(190,242,100,0.35)]" : "text-white/60"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(110px+env(safe-area-inset-bottom))] pt-4"><div key={panel} className="bw-step-in">{panel === "create" ? builder : result}</div></div>
    </div>
  );
}

/** Two soft green glows drifting slowly behind everything (only a transform moves). */
function Glow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="bw-glow absolute -left-24 -top-32 h-[520px] w-[520px] rounded-full bg-lime-300/[0.09] blur-[110px]" />
      <div className="bw-glow absolute -bottom-40 right-[18%] h-[460px] w-[460px] rounded-full bg-emerald-400/[0.07] blur-[120px]" style={{ animationDelay: "-7s" }} />
    </div>
  );
}
