import { useState } from "react";
import CutawayBuilder from "./CutawayBuilder";
import CutawayResults from "./CutawayResults";
import useCutawayRun from "./hooks/useCutawayRun";
import useIsDesktop from "./hooks/useIsDesktop";
import { DEFAULT_LENGTH, endCardFor } from "./api/cutawayApi";
import "./cutaway-motion.css";

/**
 * The Cutaway Explainer workspace: generate on the left, the result on the right; on phones one panel at a time
 * (Generate / Result), like the other short-form templates. Only ONE layout is mounted (useIsDesktop): a layout
 * hidden by CSS would still mount its player, and two players would play at once.
 */
export default function CutawayStudio({ onBeforeGenerate, planCode = null, access = "unknown", onSignUp, onUpgrade }) {
  const isDesktop = useIsDesktop();
  const [mobilePanel, setMobilePanel] = useState("builder");
  const [values, setValues] = useState({ topic: "", lengthSec: DEFAULT_LENGTH, soundEffects: true, removeWatermark: false });
  const [viewingRecent, setViewingRecent] = useState(false);
  const { run, recent, start, open, reset, remove } = useCutawayRun();
  // an example only plays: the form keeps the viewer's own inputs and stays usable
  const example = Boolean(run?.example);
  const phase = !run || example ? "idle" : run.step === "done" ? "done" : "working";
  const scrollTop = () => document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  const show = (panel) => { setMobilePanel(panel); scrollTop(); };

  const handleGenerate = (input) => {
    if (onBeforeGenerate && !onBeforeGenerate()) return;
    setViewingRecent(false);
    show("results");
    // demo only: the real pipeline sends removeWatermark as a request and the server decides from the plan
    start(input.topic, input.lengthSec, input.soundEffects, endCardFor(planCode, input.removeWatermark === true));
  };
  const handleOpen = (id) => { setViewingRecent(true); show("results"); open(id); };
  const handleReset = () => { setViewingRecent(false); reset(); show("builder"); };
  const handleBack = () => { setViewingRecent(false); reset(); show("results"); };
  // "Make one like this": the same topic in the form, back to the builder
  const handleMakeLike = (r) => { setValues((v) => ({ ...v, topic: r.topic })); setViewingRecent(false); reset(); show("builder"); };
  const handleDelete = (id) => { remove(id); setViewingRecent(false); show("results"); };

  const builder = (
    <CutawayBuilder
      values={viewingRecent && run && !example ? { topic: run.topic, lengthSec: run.lengthSec, soundEffects: run.soundEffects, removeWatermark: run.endCard === false } : values}
      planCode={planCode}
      access={access}
      onSignUp={onSignUp}
      onUpgrade={onUpgrade}
      usedTopics={recent.map((r) => r.topic)}
      onValuesChange={setValues}
      onGenerate={handleGenerate}
      onReset={handleReset}
      phase={phase}
      historyMode={viewingRecent && !example}
      onDone={handleBack}
    />
  );
  const results = <CutawayResults run={run} recent={recent} onOpen={handleOpen} onBack={handleBack} onMakeLike={handleMakeLike} onDelete={handleDelete} />;

  if (isDesktop) {
    return (
      <div className="flex h-full w-full gap-3 overflow-hidden bg-[#0B0D0F] p-3">
        <div className="h-full w-[420px] shrink-0 xl:w-[460px]">{builder}</div>
        <div className="h-full min-w-0 flex-1 overflow-hidden">{results}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0B0D0F]">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0D0F] px-3 py-3">
        <div className="relative grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
          <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white transition-transform duration-200 ease-out motion-reduce:transition-none ${mobilePanel === "results" ? "translate-x-full" : ""}`} />
          {[["builder", "Generate"], ["results", "Result"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => show(id)} aria-pressed={mobilePanel === id} className={`relative rounded-full px-3 py-2 text-[13px] font-semibold transition-colors duration-200 ${mobilePanel === id ? "text-black" : "text-white/60"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* the builder's sticky Generate bar sits above the bottom nav; this padding keeps the last content above both.
          Only the Result panel animates in: an animating parent would carry the builder's fixed bar with it. */}
      <div key={mobilePanel} className={`min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(110px+env(safe-area-inset-bottom))] pt-3 ${mobilePanel === "results" ? "cw-view" : ""}`}>{mobilePanel === "builder" ? builder : results}</div>
    </div>
  );
}
