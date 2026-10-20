import { useState } from "react";
import CutawayBuilder from "./CutawayBuilder";
import CutawayResults from "./CutawayResults";
import useCutawayRun from "./hooks/useCutawayRun";
import { DEFAULT_LENGTH, endCardFor } from "./api/cutawayApi";

/** The Cutaway Explainer workspace: generate on the left, the result on the right (one panel at a time on phones). */
export default function CutawayStudio({ onBeforeGenerate, planCode = null, access = "unknown", onSignUp, onUpgrade }) {
  const [mobilePanel, setMobilePanel] = useState("builder");
  const [values, setValues] = useState({ topic: "", lengthSec: DEFAULT_LENGTH, soundEffects: true, removeWatermark: false });
  const [viewingRecent, setViewingRecent] = useState(false);
  const { run, recent, start, open, reset } = useCutawayRun();
  // an example only plays: the form keeps the viewer's own inputs and stays usable
  const example = Boolean(run?.example);
  const phase = !run || example ? "idle" : run.step === "done" ? "done" : "working";
  const scrollTop = () => document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });

  const handleGenerate = (input) => {
    if (onBeforeGenerate && !onBeforeGenerate()) return;
    setViewingRecent(false);
    setMobilePanel("results");
    scrollTop();
    // demo only: the real pipeline sends removeWatermark as a request and the server decides from the plan
    start(input.topic, input.lengthSec, input.soundEffects, endCardFor(planCode, input.removeWatermark === true));
  };
  const handleOpen = (id) => { setViewingRecent(true); setMobilePanel("results"); scrollTop(); open(id); };
  const handleReset = () => { setViewingRecent(false); reset(); setMobilePanel("builder"); };
  const handleBack = () => { setViewingRecent(false); reset(); setMobilePanel("results"); };

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
  const results = <CutawayResults run={run} recent={recent} onOpen={handleOpen} onReset={handleReset} viewingRecent={viewingRecent} onBack={handleBack} />;

  return (
    <>
      <div className="hidden h-full w-full gap-3 overflow-hidden bg-[#0B0D0F] p-3 lg:flex">
        <div className="h-full w-[420px] shrink-0 xl:w-[460px]">{builder}</div>
        <div className="h-full min-w-0 flex-1 overflow-hidden">{results}</div>
      </div>

      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0B0D0F] lg:hidden">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0D0F] px-3 py-3">
          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {[["builder", "Generate"], ["results", "Result"]].map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setMobilePanel(id); scrollTop(); }} className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === id ? "bg-white text-black" : "text-white/60"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[110px]">{mobilePanel === "builder" ? builder : results}</div>
      </div>
    </>
  );
}
