import { useState, useEffect, useId } from "react";
import { ChevronRight, ChevronDown, Settings2, CheckCircle2, XCircle, Lock, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import { emitCreditSpend } from "../../../lib/creditPopEvents";
import {
  SCENE_COUNT_OPTIONS,
  DEFAULT_SCENE_COUNT,
  MAX_SCENES,
  EXPRESSION_OPTIONS,
  VIDEO_STYLE_OPTIONS,
  VIDEO_DURATION,
  VIDEO_MODELS,
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODEL_MIN_PLAN,
  PLAN_LABELS,
  getAllowedVideoModels,
  calcCredits,
} from "./api/footballerNationalitySwapApi";
import NoCreditsModal from "../shared/NoCreditsModal";
import FootballerUpgradeModal from "./FootballerUpgradeModal";

const MAX_CHARS = 24;

const PRESETS = [
  { footballer: "Haaland",   nationality: "Mexico" },
  { footballer: "Mbappe",    nationality: "Japan" },
  { footballer: "Messi",     nationality: "Nigeria" },
  { footballer: "Ronaldo",   nationality: "Brazil" },
  { footballer: "De Bruyne", nationality: "South Korea" },
];

function makeEmptyScene(i) {
  return {
    footballer: "",
    nationality: "",
    expression: "confident",
    videoStyle: "stadium-tunnel",
    customName: "",
    customJersey: "",
    customLine: "",
    _preset: PRESETS[i % PRESETS.length],
  };
}

function makeInitialScenes() {
  return Array.from({ length: MAX_SCENES }, (_, i) => makeEmptyScene(i));
}

// Scene 1 only — animated "ghost" placeholder that types a name, deletes it,
// then types the next one, cycling through 4 examples on a loop.
const FOOTBALLER_CYCLE  = ["Haaland", "Mbappe", "Messi", "Ronaldo"];
const NATIONALITY_CYCLE = ["Mexico", "Japan", "Brazil", "Nigeria"];

function useTypewriterGhost(words, enabled, { typeMs = 65, deleteMs = 35, holdMs = 1300, gapMs = 300 } = {}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!enabled) { setText(""); return; }
    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId;

    const tick = () => {
      const word = words[wordIndex % words.length];
      if (!deleting) {
        charIndex += 1;
        setText(word.slice(0, charIndex));
        timeoutId = setTimeout(tick, charIndex >= word.length ? holdMs : typeMs);
        if (charIndex >= word.length) deleting = true;
      } else {
        charIndex -= 1;
        setText(word.slice(0, charIndex));
        if (charIndex <= 0) {
          deleting = false;
          wordIndex += 1;
          timeoutId = setTimeout(tick, gapMs);
        } else {
          timeoutId = setTimeout(tick, deleteMs);
        }
      }
    };

    timeoutId = setTimeout(tick, typeMs);
    return () => clearTimeout(timeoutId);
  // Timing knobs are constant defaults, not reactive props — only re-run on enabled/words change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, words]);

  return text;
}

function TypewriterGhost({ text }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center gap-[2px] text-[13px] text-white/45">
      {text}
      <span className="inline-block w-[1.5px] h-[14px] bg-[#FBBF24]/80 animate-pulse" />
    </span>
  );
}

/* ── Scene count pill selector — sliding highlight ── */
function SceneCountSelector({ value, onChange }) {
  // FootballerNationalitySwapBuilder is mounted twice at once (desktop +
  // mobile layout, only one visible via CSS at a time) — a hardcoded
  // layoutId here would be shared by both simultaneously-live instances,
  // which is exactly what caused the flash/lag on load: Framer Motion's
  // shared-layout animation assumes one instance per id. useId() keeps each
  // mounted copy's pill independent.
  const instanceId = useId();
  return (
    <div className="relative grid grid-cols-3 rounded-full border border-white/10 bg-white/[0.04] p-1">
      {SCENE_COUNT_OPTIONS.map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="relative z-10 py-2 rounded-full text-[13px] font-bold transition-colors"
          >
            {active && (
              <motion.div
                layoutId={`footballer-scene-count-pill-${instanceId}`}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className="absolute inset-0 rounded-full bg-[#F59E0B]"
                style={{ zIndex: -1 }}
              />
            )}
            <span className={active ? "text-black" : "text-white/50"}>
              {n} scenes
              <span className={active ? "text-black/50" : "text-white/30"}> ({n * VIDEO_DURATION}s)</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Per-scene advanced settings — independent, never shared ── */
function AdvancedSettings({ scene, onField }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="border-t border-white/[0.05] px-3 pb-3 pt-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest mb-1.5">Expression</p>
            <div className="flex flex-wrap gap-1">
              {EXPRESSION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onField("expression", opt.value)}
                  title={opt.hint}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                    scene.expression === opt.value
                      ? "bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#FBBF24]"
                      : "bg-white/[0.04] border-white/[0.06] text-white/35 hover:text-white/60 hover:bg-white/[0.07]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest mb-1.5">Video style</p>
            <div className="flex flex-wrap gap-1">
              {VIDEO_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onField("videoStyle", opt.value)}
                  title={opt.hint}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                    scene.videoStyle === opt.value
                      ? "bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#FBBF24]"
                      : "bg-white/[0.04] border-white/[0.06] text-white/35 hover:text-white/60 hover:bg-white/[0.07]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-0.5">Custom name</span>
            <input
              type="text"
              value={scene.customName}
              maxLength={MAX_CHARS}
              onChange={(e) => onField("customName", e.target.value)}
              placeholder="Auto-generated"
              className="w-full rounded-lg px-2.5 py-1.5 text-[12px] bg-[#0C0E10] text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#F59E0B]/60 border border-white/[0.07] focus:border-[#F59E0B]/30 transition"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-0.5">Jersey #</span>
            <input
              type="text"
              value={scene.customJersey}
              maxLength={3}
              onChange={(e) => onField("customJersey", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Auto"
              className="w-full rounded-lg px-2.5 py-1.5 text-[12px] bg-[#0C0E10] text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#F59E0B]/60 border border-white/[0.07] focus:border-[#F59E0B]/30 transition"
            />
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-0.5">Spoken line override</span>
          <input
            type="text"
            value={scene.customLine}
            maxLength={140}
            onChange={(e) => onField("customLine", e.target.value)}
            placeholder="Auto-generated in the local language"
            className="w-full rounded-lg px-2.5 py-1.5 text-[12px] bg-[#0C0E10] text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#F59E0B]/60 border border-white/[0.07] focus:border-[#F59E0B]/30 transition"
          />
        </div>
      </div>
    </motion.div>
  );
}

function SceneCard({ index, scene, onChange }) {
  const [open, setOpen] = useState(false);
  const num = index + 1;
  const isFirst = index === 0;

  const onField = (field, value) => onChange(index, field, value);

  const footballerGhost  = useTypewriterGhost(FOOTBALLER_CYCLE, isFirst && !scene.footballer);
  const nationalityGhost = useTypewriterGhost(NATIONALITY_CYCLE, isFirst && !scene.nationality);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border overflow-hidden bg-[#111315] border-white/[0.08]"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-5 h-5 rounded-full bg-[#F59E0B]/25 border border-[#F59E0B]/50 flex items-center justify-center shrink-0 mt-3">
          <span className="text-[#FBBF24] text-[10px] font-black leading-none">{num}</span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-white/45 text-[9px] font-bold uppercase tracking-widest px-0.5">Footballer</span>
          <div className="relative">
            <input
              type="text"
              value={scene.footballer}
              maxLength={MAX_CHARS}
              onChange={(e) => onField("footballer", e.target.value)}
              placeholder={isFirst ? "" : (scene._preset?.footballer ?? "e.g. Haaland")}
              className="w-full rounded-lg px-2.5 py-1.5 text-[13px] bg-[#0C0E10] text-white placeholder-white/45 outline-none focus:ring-1 focus:ring-[#F59E0B]/60 border border-white/[0.07] focus:border-[#F59E0B]/30 transition"
            />
            {isFirst && !scene.footballer && <TypewriterGhost text={footballerGhost} />}
          </div>
        </div>

        <span className="text-white/20 text-[11px] shrink-0 mt-3">→</span>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-white/45 text-[9px] font-bold uppercase tracking-widest px-0.5">Nationality</span>
          <div className="relative">
            <input
              type="text"
              value={scene.nationality}
              maxLength={MAX_CHARS}
              onChange={(e) => onField("nationality", e.target.value)}
              placeholder={isFirst ? "" : (scene._preset?.nationality ?? "e.g. Mexico")}
              className="w-full rounded-lg px-2.5 py-1.5 text-[13px] bg-[#0C0E10] text-white placeholder-white/45 outline-none focus:ring-1 focus:ring-[#F59E0B]/60 border border-white/[0.07] focus:border-[#F59E0B]/30 transition"
            />
            {isFirst && !scene.nationality && <TypewriterGhost text={nationalityGhost} />}
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition mt-3 ${
            open ? "bg-[#F59E0B]/25 text-[#FBBF24]" : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
          }`}
          title="Advanced settings"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Collapsed hint row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-1 py-1 text-white/20 hover:text-white/40 transition"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && <AdvancedSettings scene={scene} onField={onField} />}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FootballerNationalitySwapBuilder({ onGenerate, onReset, phase, viewingRecent = false, planCode }) {
  const [sceneCount, setSceneCount] = useState(DEFAULT_SCENE_COUNT);
  // Always hold MAX_SCENES worth of state — switching the count only changes
  // how many are sliced for display/submission, so hidden scene data is never lost.
  const [scenes, setScenes] = useState(() => makeInitialScenes());
  const [validationError, setValidationError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [videoModel, setVideoModel] = useState(DEFAULT_VIDEO_MODEL);
  const [upgradeModelId, setUpgradeModelId] = useState(null);
  const creditBalance = useProfileCredits();

  const allowedModels = getAllowedVideoModels(planCode);

  const visibleScenes = scenes.slice(0, sceneCount);
  const totalCredits  = calcCredits(sceneCount, videoModel);
  const hasEnough     = creditBalance >= totalCredits;
  const isGenerating  = phase === "images" || phase === "videos";
  const isDone        = phase === "done";
  const isError       = phase === "error";
  // On small screens the "Setup" tab and the results are mutually exclusive
  // (no side-by-side view like desktop), so showing the full multi-field
  // form again right after a generation finishes/fails reads as if nothing
  // happened. Swap it for a compact status + "start a new one" CTA instead.
  const showStatus = isDone || isError;
  // Desktop keeps the full form visible after finishing YOUR OWN run (you
  // might want to tweak and regenerate) — but when browsing a past
  // generation, the form has nothing to do with what's on screen, so
  // collapse it there too, not just on mobile.
  const showStatusOnDesktop = viewingRecent && showStatus;

  const handleChange = (index, field, value) => {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setValidationError("");
  };

  const handleSelectVideoModel = (modelId) => {
    if (isGenerating) return;
    if (!allowedModels.includes(modelId)) {
      setUpgradeModelId(modelId);
      return;
    }
    setVideoModel(modelId);
  };

  const handleGenerate = () => {
    if (!hasEnough) { setNoCreditsOpen(true); return; }
    const invalid = visibleScenes.find((s) => !s.footballer.trim() || !s.nationality.trim());
    if (invalid) { setValidationError("Fill in a footballer and nationality for every scene."); return; }
    setValidationError("");
    emitCreditSpend(totalCredits);
    onGenerate({ sceneInputs: visibleScenes, sceneCount, videoModel });
  };

  return (
    <>
    <div className="flex flex-col bg-[#0D0F11] rounded-2xl border border-white/[0.07] lg:overflow-hidden lg:h-full">

      {/* ── HEADER (desktop only) ── */}
      <div className="shrink-0">
        <div className="hidden lg:block px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="shrink-0 w-[52px] h-[52px] rounded-2xl overflow-hidden p-[2px] shadow-[0_0_20px_rgba(245,158,11,0.5)]"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(245,158,11,0.9) 100%)" }}
            >
              <img src="/face/ronaldo.png" alt="" className="w-full h-full object-cover rounded-[10px]" />
            </div>
            <div>
              <h1 className="text-white font-black text-[17px] leading-tight tracking-tight">Nationality Swap</h1>
              <p className="text-white/45 text-[12px] mt-0.5">Reimagine any footballer for a new nation</p>
            </div>
          </div>
        </div>
        <div className="hidden lg:block h-px bg-white/[0.06] mx-5" />
        <div className="flex items-center gap-2 px-5 py-2 lg:py-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#F59E0B] text-black">
            1  Your Scenes
          </div>
        </div>
        <div className="h-px bg-white/[0.06] mx-5" />
      </div>

      {/* ── STATUS — replaces the form on small screens once done/failed, and on
           desktop too when browsing a past generation (its form is unrelated). ── */}
      {showStatus && (
        <div className={`${showStatusOnDesktop ? "" : "lg:hidden"} flex-1 flex flex-col items-center justify-center gap-4 px-6 py-16 text-center`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
            isError ? "bg-red-500/15" : "bg-emerald-500/15"
          }`}>
            {isError
              ? <XCircle className="w-7 h-7 text-red-400" />
              : <CheckCircle2 className="w-7 h-7 text-emerald-400" />}
          </div>
          <p className="text-white font-bold text-[16px]">
            {isError ? "This generation failed" : "This generation is successfully done"}
          </p>
          <button
            onClick={onReset}
            className="px-5 py-2.5 rounded-xl font-bold text-[13px] text-black bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:opacity-90 transition"
          >
            Start a new one
          </button>
        </div>
      )}

      {/* ── SCROLLABLE BODY — hidden on mobile once done/failed, and on desktop too when browsing a past generation ── */}
      <div className={`${showStatus ? (showStatusOnDesktop ? "hidden" : "hidden lg:block") : ""} lg:flex-1 lg:min-h-0 lg:overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb]:rounded-full`}>
        <div className="px-5 pt-4 pb-[160px] lg:pb-5 flex flex-col gap-3">

          {/* Video model — pill selector, plan-gated */}
          <div>
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">Video Model</p>
            <div className="flex items-center gap-2 bg-[#0e1012] border border-white/10 rounded-xl p-1">
              {Object.values(VIDEO_MODELS).map((model) => {
                const active = videoModel === model.id;
                const locked = !allowedModels.includes(model.id);

                if (locked) {
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelectVideoModel(model.id)}
                      title={`${model.label} requires the ${PLAN_LABELS[VIDEO_MODEL_MIN_PLAN[model.id]]} plan`}
                      className="relative flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 overflow-hidden text-white/25 hover:text-white/40 transition-all"
                    >
                      <span className="pointer-events-none absolute inset-0 animate-shimmer" />
                      <Lock className="w-3 h-3 shrink-0" />
                      <span className="text-[12px] font-bold tracking-wide">{model.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-gradient-to-r from-[#F5C042]/25 to-[#F59E0B]/25 text-[#F5C042] border border-[#F5C042]/30">
                        {PLAN_LABELS[VIDEO_MODEL_MIN_PLAN[model.id]]}
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={model.id}
                    onClick={() => handleSelectVideoModel(model.id)}
                    className={`relative flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all ${
                      active
                        ? "bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] text-black shadow-lg shadow-[#F59E0B]/20"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    <span className={`text-[12px] font-bold tracking-wide ${active ? "text-black" : ""}`}>{model.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      active ? "bg-black/15 text-black" : "bg-white/[0.05] text-white/30"
                    }`}>{model.tag}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">Audio included</span>
            </div>
          </div>

          {/* Scene count */}
          <div>
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">Number of scenes</p>
            <SceneCountSelector value={sceneCount} onChange={setSceneCount} />
          </div>

          {/* Scene cards */}
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {visibleScenes.map((scene, i) => (
                <SceneCard key={i} index={i} scene={scene} onChange={handleChange} />
              ))}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* ── FOOTER — hidden whenever the status block above is showing; it has its own CTA ── */}
      <div className={`${showStatus ? (showStatusOnDesktop ? "hidden" : "hidden lg:block") : ""} fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.06] bg-[#0D0F11]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-transparent lg:backdrop-blur-0 lg:py-4`}>
        {!hasEnough && (
          <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-red-300 text-[12px] font-semibold">Need {totalCredits} credits · you have {creditBalance}</span>
            <a href="/workspace/pricing" className="text-red-200 text-[11px] font-bold underline shrink-0">Add Credits →</a>
          </div>
        )}
        {validationError && (
          <p className="text-red-400 text-[12px] font-medium text-center mb-2">{validationError}</p>
        )}
        <button
          onClick={isDone ? onReset : handleGenerate}
          disabled={isGenerating}
          className={`w-full py-2.5 lg:py-3.5 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-300 ${
            isDone
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
              : isGenerating
              ? "bg-[#F59E0B]/25 text-white/40 cursor-not-allowed"
              : "text-black bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:opacity-90"
          }`}
        >
          {isGenerating ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />Generating…</>
          ) : isDone ? "✓  All Done — Generate New" : (
            <>Generate Nationality Swap <ChevronRight className="w-4 h-4" /></>
          )}
          {!isDone && (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[14px] font-bold ${
              isGenerating ? "bg-white/5 text-white/20" : "bg-black/15 text-black"
            }`}>
              <img src={isGenerating ? "/icons/whitecredit.png" : "/icons/credit.png"} alt="" className="w-4 h-4 object-contain" />
              {totalCredits}
            </span>
          )}
        </button>
      </div>
    </div>

    <NoCreditsModal
      open={noCreditsOpen}
      onClose={() => setNoCreditsOpen(false)}
      creditsNeeded={totalCredits}
      creditBalance={creditBalance}
    />

    <FootballerUpgradeModal
      open={!!upgradeModelId}
      onClose={() => setUpgradeModelId(null)}
      modelId={upgradeModelId}
      requiredPlan={upgradeModelId ? VIDEO_MODEL_MIN_PLAN[upgradeModelId] : null}
    />
    </>
  );
}
