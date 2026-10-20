import { useState } from "react";
import CutawayBuilder from "./CutawayBuilder";
import CutawayResults from "./CutawayResults";
import CutawaySummary from "./CutawaySummary";
import useCutawayRun from "./hooks/useCutawayRun";
import useIsDesktop from "./hooks/useIsDesktop";
import { DEFAULT_LENGTH, endCardFor, LENGTHS, quoteTopic } from "./api/cutawayApi";

const EMPTY = { topic: "", lengthSec: DEFAULT_LENGTH, soundEffects: true, removeWatermark: false };
import "./cutaway-motion.css";

/**
 * The Cutaway Explainer workspace: generate on the left, the result on the right; on phones one panel at a time
 * (Generate / Result), like the other short-form templates. Only ONE layout is mounted (useIsDesktop): a layout
 * hidden by CSS would still mount its player, and two players would play at once.
 */
export default function CutawayStudio({ onBeforeGenerate, planCode = null, access = "unknown", onSignUp, onUpgrade }) {
  const isDesktop = useIsDesktop();
  const [mobilePanel, setMobilePanel] = useState("builder");
  const [values, setValues] = useState(EMPTY);
  const { run, recent, start, open, reset, remove } = useCutawayRun();
  // a finished video or an example is open: the Generate side shows what it was made with, read-only
  const finished = Boolean(run && run.step === "done" && run.finalUrl);
  const phase = !run ? "idle" : run.step === "done" ? "done" : "working";
  const scrollTop = () => document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  const show = (panel) => { setMobilePanel(panel); scrollTop(); };

  const handleGenerate = (input) => {
    if (onBeforeGenerate && !onBeforeGenerate()) return;
    show("results");
    const q = quoteTopic(input.topic, input.lengthSec);
    // demo only: the real pipeline sends removeWatermark as a request and the server decides from the plan
    start(input.topic, input.lengthSec, input.soundEffects, endCardFor(planCode, input.removeWatermark === true), { credits: q.credits, kind: q.kind });
  };
  const handleOpen = (id) => { show("results"); open(id); };
  const handleReset = () => { reset(); show("builder"); };
  const handleBack = () => { reset(); show("results"); };
  // "New video": the normal, empty, editable builder
  const handleNew = () => { setValues(EMPTY); reset(); show("builder"); };
  // "Make one like this": the builder pre-filled with the same settings (examples are ~40 s: the nearest length)
  const handleMakeLike = (r) => {
    setValues({ topic: r.topic, lengthSec: LENGTHS.includes(r.lengthSec) ? r.lengthSec : DEFAULT_LENGTH, soundEffects: r.soundEffects !== false, removeWatermark: r.endCard === false });
    reset(); show("builder");
  };
  const handleDelete = (id) => { remove(id); show("results"); };

  const builder = finished ? (
    <CutawaySummary run={run} onNew={handleNew} onMakeLike={handleMakeLike} />
  ) : (
    <CutawayBuilder
      values={values}
      planCode={planCode}
      access={access}
      onSignUp={onSignUp}
      onUpgrade={onUpgrade}
      usedTopics={recent.map((r) => r.topic)}
      onValuesChange={setValues}
      onGenerate={handleGenerate}
      onReset={handleReset}
      phase={phase}
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
