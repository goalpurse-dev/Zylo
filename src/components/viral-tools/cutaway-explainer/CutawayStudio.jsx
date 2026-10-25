import { useState } from "react";
import { Play } from "lucide-react";
import CutawayBuilder from "./CutawayBuilder";
import useCutawayPremade from "./api/cutawayPremade";
import CutawayHero from "./CutawayHero";
import CutawayResults from "./CutawayResults";
import CutawaySummary from "./CutawaySummary";
import useCutawayRun from "./hooks/useCutawayRun";
import useIsDesktop from "./hooks/useIsDesktop";
import { DEFAULT_LENGTH, endCardFor, EXAMPLES, isWorking, LENGTHS, quoteTopic } from "./api/cutawayApi";
import { premadeByKey } from "../../../data/cutawayTopics";

const EMPTY = { topic: "", lengthSec: DEFAULT_LENGTH, soundEffects: true, removeWatermark: false };
import "./cutaway-motion.css";

// "We can't build this one yet": the server may name the closest premade topics by key or by name.
const topicNames = (list = []) => list.map((k) => premadeByKey(k)?.topic ?? k).filter(Boolean).slice(0, 3);

/**
 * The Cutaway Explainer workspace: generate on the left, the result on the right; on phones one panel at a time
 * (Generate / Result), like the other short-form templates. Only ONE layout is mounted (useIsDesktop): a layout
 * hidden by CSS would still mount its player, and two players would play at once.
 *
 * Generate: the page's gates first (sign up / upgrade), then the credit check, then start(). A refusal from the
 * server is mapped here: SIGN_IN -> sign-up, UPGRADE -> the upgrade popup, CREDITS -> add credits (with what the
 * video needs), CANT_BUILD -> "We can't build this one yet" with the closest premade topics, anything else
 * (LIMIT, BUSY, ...) -> a calm message above the button. Nothing is charged in any of these.
 */
export default function CutawayStudio({ onBeforeGenerate, planCode = null, access = "unknown", balance = 0, mode = "server", mock = null, listOnMount = false, onSignUp, onUpgrade, onNoCredits }) {
  const isDesktop = useIsDesktop();
  const approved = useCutawayPremade(mode);
  const [mobilePanel, setMobilePanel] = useState(mock?.run ? "results" : "builder");
  const [values, setValues] = useState(mock?.values ? { ...EMPTY, ...mock.values } : EMPTY);
  const [notice, setNotice] = useState(mock?.notice ?? null); // a refusal from the server, shown above Generate
  const { run, recent, starting, start, open, reset, remove, approveLayout } = useCutawayRun({ mode, listOnMount, initialRun: mock?.run ?? null, initialRecent: mock?.recent ?? [] });
  // a finished video or an example is open: the Generate side shows what it was made with, read-only
  const finished = Boolean(run && run.step === "done" && run.finalUrl);
  const phase = !run ? "idle" : run.step === "done" ? "done" : run.step === "failed" ? "failed" : "working";
  const scrollTop = () => document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  const show = (panel) => { setMobilePanel(panel); scrollTop(); };

  const handleGenerate = async (input) => {
    if (onBeforeGenerate && !onBeforeGenerate()) return;
    const q = quoteTopic(input.topic, input.lengthSec, approved ?? []);
    // the balance is known to be short: the add-credits popup before any call (the server checks again on start)
    if (balance > 0 && balance < q.credits) { onNoCredits?.(q.credits); return; }
    setNotice(null);
    // the server decides the end card from the plan; the demo and the local runner mirror its rule
    const res = await start(input, { credits: q.credits, kind: q.kind, endCard: endCardFor(planCode, input.removeWatermark === true) });
    if (res.ok) { show("results"); return; }
    const e = res.error;
    if (e.code === "SIGN_IN") onSignUp?.();
    else if (e.code === "UPGRADE") onUpgrade?.();
    else if (e.code === "CREDITS") onNoCredits?.(e.credits ?? q.credits);
    else if (e.code === "CANT_BUILD") setNotice({ kind: "CANT_BUILD", topic: input.topic, missing: e.missing, closest: topicNames(e.closest) });
    else setNotice({ kind: e.code, message: e.message, retryAfterSec: e.retryAfterSec });
  };
  const handleOpen = (id) => { show("results"); open(id); };
  const handleReset = () => { reset(); show("builder"); };
  const handleBack = () => { reset(); show("results"); };
  // "New video": the normal, empty, editable builder
  const handleNew = () => { setValues(EMPTY); setNotice(null); reset(); show("builder"); };
  // "Make one like this": the builder pre-filled with the same settings (examples are ~40 s: the nearest length)
  const handleMakeLike = (r) => {
    setValues({ topic: r.topic, lengthSec: LENGTHS.includes(r.lengthSec) ? r.lengthSec : DEFAULT_LENGTH, soundEffects: r.soundEffects !== false, removeWatermark: r.endCard === false });
    setNotice(null); reset(); show("builder");
  };
  const handleDelete = (id) => { remove(id); show("results"); };
  // the hero's "Watch an example": the landfill (the video the hero is a frame of)
  const watchExample = () => handleOpen(EXAMPLES[1].id);

  // phones: the hero opens the builder (on desktop it fills the empty result side instead)
  // (someone with videos of their own gets a small link instead: the big hero is for new users)
  const phoneHero = !isDesktop && phase !== "working" ? (recent.length ? (
    <button type="button" onClick={watchExample} className="cw-press flex items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-white/75 hover:border-cutaway/30 hover:text-white">
      <Play className="h-3.5 w-3.5 fill-current" />Watch an example
    </button>
  ) : (
    <CutawayHero variant="tall" onWatch={watchExample} className="mx-auto aspect-[9/16] w-full max-w-[min(300px,78vw)]">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cutaway">Type a topic · get a 3D video</p>
      <h2 className="mt-1 overflow-hidden pb-[0.06em] text-[24px] font-black leading-[1.02] tracking-[-0.04em] text-white">
        <span className="cw-line-up" style={{ "--d": "250ms" }}>See inside how it works.</span>
      </h2>
    </CutawayHero>
  )) : null;

  const builder = finished ? (
    <CutawaySummary run={run} onNew={handleNew} onMakeLike={handleMakeLike} />
  ) : (
    <CutawayBuilder
      values={values}
      approved={approved}
      planCode={planCode}
      access={access}
      onSignUp={onSignUp}
      onUpgrade={onUpgrade}
      usedTopics={recent.map((r) => r.topic)}
      onValuesChange={(v) => { setValues(v); if (notice && v.topic !== values.topic) setNotice(null); }}
      onGenerate={handleGenerate}
      onReset={handleReset}
      phase={phase}
      starting={starting}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      onShowRun={() => show("results")}
      hero={phoneHero}
      onDone={handleBack}
    />
  );
  const results = <CutawayResults run={run} recent={recent} isDesktop={isDesktop} onOpen={handleOpen} onBack={handleBack} onMakeLike={handleMakeLike} onDelete={handleDelete} onApprove={approveLayout} onWatch={watchExample} />;

  if (isDesktop) {
    return (
      <div className="flex h-full w-full gap-3 overflow-hidden bg-[#0B0D0F] p-3">
        <div className="h-full w-[420px] shrink-0 xl:w-[460px]">{builder}</div>
        <div className="h-full min-w-0 flex-1 overflow-hidden">{results}</div>
      </div>
    );
  }
  const live = run && isWorking(run);
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0B0D0F]">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0D0F] px-3 py-3">
        <div className="relative grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
          <span aria-hidden="true" className={`cw-thumb absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white ${mobilePanel === "results" ? "translate-x-full" : ""}`} />
          {[["builder", "Generate"], ["results", "Result"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => show(id)} aria-pressed={mobilePanel === id} className={`relative flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors duration-200 ${mobilePanel === id ? "text-black" : "text-white/60"}`}>
              {label}
              {id === "results" && (live || (run?.doneAt && mobilePanel !== "results")) && (
                <span className="relative grid h-2 w-2 place-items-center" aria-label={live ? "making your video" : "your video is ready"}>
                  <span className="cw-ping absolute inset-0 rounded-full bg-cutaway" />
                  <span className="relative h-2 w-2 rounded-full bg-cutaway" />
                </span>
              )}
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
