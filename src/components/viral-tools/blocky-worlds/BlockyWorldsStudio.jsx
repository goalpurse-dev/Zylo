import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Boxes, ChevronLeft } from "lucide-react";
import { BLOCKY_WORLDS_ENABLED } from "../../../data/blockyWorlds";
import useIsDesktop from "../cutaway-explainer/hooks/useIsDesktop";
import useBlockyWorlds from "./hooks/useBlockyWorlds";
import ResultPanel from "./ResultPanel";
import ScriptStep from "./ScriptStep";
import { ActionBar, ActionButton } from "./StepShell";
import StoryStep from "./StoryStep";
import "./blockyWorlds.css";

const STEPS = ["Story", "Script", "Video"];

/**
 * The Blocky Worlds workspace, in Cartoon Drive By's layout: one calm builder panel on the left (a small header, the
 * step's content, its action pinned at the bottom), the video on the right; on phones one panel at a time. Refusals
 * from the server open the app's own flows: SIGN_IN -> sign up, UPGRADE -> the upgrade popup, CREDITS -> add credits;
 * anything else is a calm notice. Nothing is charged before Generate.
 */
export default function BlockyWorldsStudio({ access: pageAccess, onSignUp, onUpgrade, onNoCredits, balance = 0 }) {
  const isDesktop = useIsDesktop();
  const flow = useBlockyWorlds();
  const [panel, setPanel] = useState("create");
  const [notice, setNotice] = useState(null);
  const [peek, setPeek] = useState(null); // the idea card under the pointer: the preview plays its first line
  const [selected, setSelected] = useState(null); // the idea card picked for "Write this story"
  const mobileScroll = useRef(null);

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
  const startOver = () => { flow.startOver(); setNotice(null); setPeek(null); setSelected(null); setPanel("create"); };

  // what the live preview plays: the hovered idea, else the picked one, else the script, else our sample openers
  const shown = peek ?? selected;
  const preview = useMemo(() => {
    if (shown && !flow.draft) return { lines: [shown.opener, shown.teaser], label: shown.title };
    if (flow.draft) return { lines: flow.draft.lines.map((l) => l.text), label: "Your script", meta: `Read by ${flow.access?.narrator?.name ?? "the narrator"} · about ${Math.round(flow.draft.check?.seconds ?? flow.lengthSec)} s` };
    return { lines: null, label: "Preview", meta: "Narrated, captioned and built in blocks. Vertical, ready to post." };
  }, [shown, flow.draft, flow.access, flow.lengthSec]);

  const step = flow.run ? 2 : flow.draft ? 1 : 0;
  // every step (and every panel switch on phones) opens at its top
  const stepKey = flow.draft ? `script-${flow.draft.id}` : "story";
  useEffect(() => { mobileScroll.current?.scrollTo?.(0, 0); }, [stepKey, panel]);

  // the template is behind its own switch: wait for the server's answer, and send visitors it isn't open to away
  if (!flow.access) return <div className="grid h-full w-full place-items-center bg-[#0B0D0F]" aria-busy="true" aria-label="Loading"><span className="h-10 w-10 animate-pulse rounded-full bg-lime-300/20" /></div>;
  if (!flow.access.visible && !BLOCKY_WORLDS_ENABLED) return <Navigate to="/" replace />;

  const builder = (
    <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(190,242,100,.05)] lg:h-full lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-lime-300/20 bg-lime-300/10"><Boxes className="h-4 w-4 text-lime-300" aria-hidden="true" /></span>
          <div>
            <p className="text-[16px] font-black tracking-[-0.03em] text-white">Blocky Worlds</p>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-lime-300/65">Story videos, built in blocks</p>
          </div>
        </div>
        <ol className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of 3: ${STEPS[step]}`}>
          {STEPS.map((s, i) => (
            <li key={s} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-5 bg-lime-300" : i < step ? "w-1.5 bg-lime-300/50" : "w-1.5 bg-white/15"}`} title={s} />
          ))}
        </ol>
      </div>
      {/* opacity only: a transform here would pin the fixed action bar to the step instead of the screen */}
      <div key={stepKey} className="bw-fade-in flex min-h-0 flex-1 flex-col">
        {flow.draft
          ? <ScriptStep flow={flow} notice={notice} onGenerate={handleGenerate} onBack={startOver} made={Boolean(flow.run)} onNew={startOver} />
          : <StoryStep flow={flow} onGate={gated} onPeek={isDesktop ? setPeek : undefined} selected={selected} onSelect={setSelected} />}
      </div>
      {!flow.draft && notice && <p className="absolute inset-x-5 bottom-[84px] rounded-lg bg-[#1a1d1b] px-3 py-2 text-center text-[11.5px] text-white/75 lg:bottom-[76px]" role="status">{notice}</p>}
    </section>
  );
  const result = <ResultPanel run={flow.run} recent={flow.recent} preview={preview} onOpen={(r) => { flow.openRun(r); setPanel("result"); }} onEvent={flow.sendEvent} />;

  if (isDesktop) {
    return (
      <div className="flex h-full w-full gap-3 overflow-hidden bg-[#0B0D0F] p-3">
        <div className="h-full w-[480px] shrink-0 xl:w-[540px]">{builder}</div>
        <div className="h-full min-w-0 flex-1 overflow-hidden">{result}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0B0D0F]">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0D0F] px-3 py-3">
        <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {[["create", "Create"], ["result", "Video"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPanel(id)} aria-pressed={panel === id} className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${panel === id ? "bg-white text-black" : "text-white/60"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div ref={mobileScroll} className="min-h-0 flex-1 overflow-y-auto px-3 pb-[110px]">
        {panel === "create" ? builder : (
          <>
            {result}
            <ActionBar>
              {flow.draft
                ? <ActionButton variant="secondary" onClick={() => setPanel("create")}><ChevronLeft className="h-4 w-4" />Back to the script</ActionButton>
                : <ActionButton onClick={() => setPanel("create")}>Pick a world</ActionButton>}
            </ActionBar>
          </>
        )}
      </div>
    </div>
  );
}
