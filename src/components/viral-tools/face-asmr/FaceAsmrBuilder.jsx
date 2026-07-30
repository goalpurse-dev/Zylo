import { useEffect, useRef, useState } from "react";
import { Upload, X, ChevronRight, ChevronLeft, Lock, VolumeX, Volume2 } from "lucide-react";
import ReferenceImageModal from "../../reference-images/ReferenceImageModal.jsx";
import { useReferenceImages } from "../../reference-images/useReferenceImages";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import {
  generateFaceAsmrCharacterNames,
  IMAGE_FALLBACK_CREDITS,
  VIDEO_MODELS,
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODEL_MIN_PLAN,
  PLAN_LABELS,
  getAllowedVideoModels,
} from "./api/faceAsmrApi";
import NoCreditsModal from "../shared/NoCreditsModal";
import FaceAsmrUpgradeModal from "./FaceAsmrUpgradeModal";

const LENGTH_OPTIONS = [
  { value: "15s", label: "15 sec", scenes: 3 },
  { value: "30s", label: "30 sec", scenes: 6 },
  { value: "45s", label: "45 sec", scenes: 9 },
];

const BACKGROUNDS = [
  { id: "white-marble",   emoji: "🤍", label: "White Marble",      preview: "/face/cleanwhitemarbe.png" },
  { id: "black-marble",  emoji: "🖤", label: "Black Marble",       preview: "/face/black marbe.png" },
  { id: "light-oak",     emoji: "🪵", label: "Light Oak Wood",     preview: "/face/lightoakwood.png" },
  { id: "dark-walnut",   emoji: "🌰", label: "Dark Walnut",        preview: "/face/darkwalnutwood.png" },
  { id: "brushed-steel", emoji: "⚙️", label: "Brushed Steel",      preview: "/face/brushedsteel.png" },
  { id: "frosted-glass", emoji: "🧊", label: "Frosted Glass",      preview: "/face/frostedglass.png" },
  { id: "concrete",      emoji: "🩶", label: "Polished Concrete",  preview: "/face/polishedconcrete.png" },
  { id: "white-ceramic", emoji: "🍽️", label: "White Ceramic",      preview: "/face/whiteceramic.png" },
  { id: "travertine",    emoji: "🏛️", label: "Travertine Stone",   preview: "/face/travertinestone.png" },
  { id: "matte-black",   emoji: "🌑", label: "Matte Black",        preview: "/face/matteblackstone.png" },
];

const CELEBRITIES = ["Ronaldo", "Messi", "Taylor Swift", "Drake", "Elon Musk",
  "Billie Eilish", "LeBron James", "Rihanna", "Kanye West"];

const PREVIEWS = [
  "/face/ronaldo.png",
  "/face/messi.png",
  "/face/mbappe.png",
  "/face/haaland.png",
  "/face/neymar.png",
  "/face/taylor.png",
  "/face/ariana.png",
  "/face/billie.png",
  "/face/the rock.png",
];

/* ── Active length button: white border + inset glow ── */
function LengthButton({ option, active, onClick }) {
  if (active) {
    return (
      <div
        className="p-[1px] rounded-lg"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.85) 0%, rgba(168,85,247,0.95) 100%)" }}
      >
        <button
          onClick={onClick}
          className="relative block px-4 py-2 rounded-[7px] bg-[#0D0F11] text-white text-[13px] font-bold overflow-hidden whitespace-nowrap"
        >
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0px 2px 5px rgba(255,255,255,0.15)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(168,85,247,0.35) 0%, transparent 50%)" }} />
          <span className="relative">{option.label}</span>
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white/40 hover:text-white/80 bg-white/[0.05] hover:bg-white/[0.09] transition whitespace-nowrap"
    >
      {option.label}
    </button>
  );
}

/* ── Single scene card ── */
function SceneCard({ index, scene, onChange, onOpenPicker, anyUploaded }) {
  const hasCustom = !!scene.imagePreview;
  const thumbSrc  = scene.imagePreview || PREVIEWS[index % PREVIEWS.length];
  // dim non-uploaded scenes once any scene has been uploaded
  const placeholderOpacity = anyUploaded ? "opacity-20" : "opacity-100";

  return (
    <div className="rounded-2xl bg-[#111315] border border-white/[0.08] overflow-hidden">
      {/* scene label bar */}
      <div className="flex items-center gap-2.5 px-4 pt-2.5 pb-2 lg:pt-3.5 lg:pb-3 border-b border-white/[0.05]">
        <div className="w-6 h-6 rounded-full bg-[#7A3BFF]/25 border border-[#7A3BFF]/50 flex items-center justify-center shrink-0">
          <span className="text-[#C4A3FF] text-[11px] font-black leading-none">{index + 1}</span>
        </div>
        <span className="text-white font-semibold text-[14px]">Scene {index + 1}</span>
      </div>

      {/* content row */}
      <div className="flex gap-3 p-3 lg:p-4">
        {/* thumbnail */}
        {hasCustom ? (
          /* ── UPLOADED: clear image, purple ring, checkmark ── */
          <div className="relative shrink-0 w-[90px] h-[110px] rounded-xl overflow-visible group cursor-pointer">
            {/* purple glow ring */}
            <div className="absolute -inset-[2px] rounded-[14px] bg-gradient-to-b from-white/60 to-[#7A3BFF] z-0" />
            <div className="relative w-full h-full rounded-xl overflow-hidden z-10" onClick={() => onOpenPicker(index)}>
              <img src={thumbSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
              {/* very light hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition text-white text-[11px] font-bold">Change</span>
              </div>
            </div>
            {/* checkmark badge */}
            <div className="absolute -top-1.5 -right-1.5 z-20 w-5 h-5 rounded-full bg-[#7A3BFF] border-2 border-[#111315] flex items-center justify-center">
              <span className="text-white text-[9px] font-black leading-none">✓</span>
            </div>
            {/* remove */}
            <button
              onClick={(e) => { e.stopPropagation(); onChange({ ...scene, imagePreview: null }); }}
              className="absolute -bottom-1.5 -right-1.5 z-20 w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center hover:bg-red-500/80 transition"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          </div>
        ) : (
          /* ── NOT UPLOADED: dim placeholder ── */
          <div
            className="relative shrink-0 w-[90px] h-[110px] rounded-xl overflow-hidden group cursor-pointer border border-dashed border-white/20 hover:border-[#7A3BFF]/60 transition"
            onClick={() => onOpenPicker(index)}
          >
            <img src={thumbSrc} alt="" loading="lazy" className={`w-full h-full object-cover transition-opacity duration-500 ${placeholderOpacity}`} />
            <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <Upload className="w-4 h-4 text-white/70" />
              <span className="text-white/60 text-[10px] font-semibold">Upload</span>
            </div>
          </div>
        )}

        {/* text input — disabled when image uploaded */}
        <div className="flex-1">
          <textarea
            value={hasCustom ? "" : scene.description}
            onChange={(e) => !hasCustom && onChange({ ...scene, description: e.target.value })}
            disabled={hasCustom}
            placeholder={hasCustom
              ? "Using uploaded photo ✓"
              : "Describe the face you want"}
            rows={4}
            className={`w-full rounded-xl px-3.5 py-3 text-[13px] resize-none outline-none transition leading-relaxed ${
              hasCustom
                ? "bg-white/[0.04] text-white/30 placeholder-white/30 cursor-not-allowed"
                : "bg-[#0C0E10] text-white placeholder-white/20 focus:ring-1 focus:ring-[#7A3BFF]/60"
            }`}
          />
        </div>
      </div>
    </div>
  );
}

export default function FaceAsmrBuilder({ onGenerate, onBack, scenes, setScenes, selectedLength, setSelectedLength, forcedStep, savedDone = false, phase = "idle", planCode }) {
  const [step, setStep] = useState(0);
  const [selectedBg, setSelectedBg] = useState("white-marble");
  const [videoModel, setVideoModel] = useState(DEFAULT_VIDEO_MODEL);
  const [upgradeModelId, setUpgradeModelId] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const creditBalance = useProfileCredits();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingSceneIdx, setEditingSceneIdx] = useState(null);
  const [aiWriting, setAiWriting] = useState(false);
  const bodyScrollRef = useRef(null);

  const { images, selected, addImage, toggleSelect, setSelected } = useReferenceImages(1);

  useEffect(() => {
    if (typeof forcedStep === "number") setStep(forcedStep);
  }, [forcedStep]);

  // The scrollable body div persists across steps (same DOM node, new
  // content), so it keeps whatever scrollTop the user left step 0 at instead
  // of resetting to the top of step 1 — reset it explicitly on step change.
  useEffect(() => {
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  const allowedModels = getAllowedVideoModels(planCode);
  const selectedVideoModel = VIDEO_MODELS[videoModel] ?? VIDEO_MODELS[DEFAULT_VIDEO_MODEL];

  const handleSelectVideoModel = (modelId) => {
    if (!allowedModels.includes(modelId)) {
      setUpgradeModelId(modelId);
      return;
    }
    setVideoModel(modelId);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addImage({ id: `${Date.now()}`, url });
  };

  const handleOpenPicker = (sceneIndex) => {
    setEditingSceneIdx(sceneIndex);
    setSelected([]); // clear previous selection
    setPickerOpen(true);
  };

  const handlePickerClose = () => {
    if (selected.length > 0 && editingSceneIdx !== null) {
      updateScene(editingSceneIdx, {
        ...scenes[editingSceneIdx],
        imagePreview: selected[0].url,
        description: "", // reset any typed prompt when image is imported
      });
    }
    setPickerOpen(false);
    setEditingSceneIdx(null);
  };

  const sceneCount = LENGTH_OPTIONS.find((l) => l.value === selectedLength)?.scenes ?? 6;
  const activeScenes = scenes.slice(0, sceneCount);

  const updateScene = (i, val) => {
    setScenes((prev) => prev.map((s, idx) => (idx === i ? val : s)));
    if (validationError) setValidationError("");
  };

  const typeSceneName = (sceneIndex, name) => new Promise((resolve) => {
    let pos = 0;
    const tick = () => {
      pos += 1;
      setScenes((prev) =>
        prev.map((s, idx) => (
          idx === sceneIndex ? { ...s, description: name.slice(0, pos) } : s
        ))
      );
      if (pos >= name.length) resolve();
      else setTimeout(tick, 22);
    };
    tick();
  });

  const handleAiWrite = async () => {
    if (aiWriting) return;
    const emptyIndexes = activeScenes
      .map((scene, i) => ({ scene, i }))
      .filter(({ scene }) => !scene.imagePreview && !scene.description.trim())
      .map(({ i }) => i);

    if (!emptyIndexes.length) return;

    setValidationError("");
    setAiWriting(true);
    try {
      const existingNames = new Set(
        activeScenes
          .map((scene) => scene.description.trim().toLowerCase())
          .filter(Boolean)
      );
      const names = (await generateFaceAsmrCharacterNames({ count: emptyIndexes.length }))
        .filter((name) => {
          const key = name.trim().toLowerCase();
          if (!key || existingNames.has(key)) return false;
          existingNames.add(key);
          return true;
        });
      if (names.length < emptyIndexes.length) throw new Error("AI returned duplicate names. Try again.");
      for (let i = 0; i < emptyIndexes.length; i += 1) {
        const name = names[i];
        await typeSceneName(emptyIndexes[i], name);
      }
    } catch (e) {
      setValidationError(e?.message || "AI could not write names. Try again.");
    } finally {
      setAiWriting(false);
    }
  };

  const filledCount   = activeScenes.filter((s) => s.description.trim() || s.imagePreview).length;
  const allFilled     = filledCount === activeScenes.length;
  const partialFilled = filledCount > 0 && !allFilled;

  const totalCost        = (IMAGE_FALLBACK_CREDITS + selectedVideoModel.credits) * sceneCount;
  const hasEnoughCredits = creditBalance >= totalCost;
  const isGenerating     = phase === "images" || phase === "videos";
  const isDone           = phase === "done";

  const handleNext = () => {
    if (!allFilled) {
      setValidationError("Fill every scene before continuing.");
      return;
    }
    setValidationError("");
    setStep(1);
    // scroll the internal scene list back to top when advancing steps
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };
  const bgLabel = BACKGROUNDS.find((b) => b.id === selectedBg)?.label ?? "";

  return (
    <>
    <div className="flex flex-col bg-[#0D0F11] rounded-2xl border border-white/[0.07] overflow-hidden h-full">

      {/* ══ HEADER (non-scrollable) ══ */}
      <div className="shrink-0">

        {/* ── Row 1: title + sample strip (desktop only — mobile saves the space) ── */}
        <div className="hidden lg:block px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-4">
            {/* Hero face image — larger, with gradient border to separate from the strip below */}
            <div
              className="shrink-0 w-[60px] h-[60px] rounded-2xl overflow-hidden p-[2px] shadow-[0_0_20px_rgba(122,59,255,0.5)]"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(122,59,255,0.9) 100%)" }}
            >
              <img
                src="/face/ronaldo.png"
                alt=""
                className="w-full h-full object-cover rounded-[10px]"
              />
            </div>
            <div>
              <h1 className="text-white font-black text-[18px] leading-tight tracking-tight">Face ASMR</h1>
              <p className="text-white/50 text-[12px] mt-0.5">Turn any face into a viral ASMR video</p>
            </div>
          </div>

          {/* sample output strip — desktop only */}
          <div className="hidden lg:flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {PREVIEWS.slice(0, 6).map((src, i) => (
              <div key={i} className="relative shrink-0 w-10 h-12 rounded-lg overflow-hidden ring-1 ring-white/10">
                <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
            ))}
            <div className="shrink-0 w-10 h-12 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
              <span className="text-white/30 text-[13px] font-bold">+</span>
            </div>
          </div>
        </div>

        <div className="hidden lg:block h-px bg-white/[0.06] mx-5" />

        {/* ── Row 2: step indicator ── */}
        <div className="flex items-center gap-2 px-5 py-2 lg:py-3.5">
          {[{ label: "1  Scenes" }, { label: savedDone ? "Done" : "2  Background" }].map((s, i) => (
            <button
              key={i}
              onClick={() => (i < step || (i === 1 && canNext)) ? setStep(i) : null}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition ${
                i === step
                  ? "bg-[#7A3BFF] text-white"
                  : i < step
                  ? "bg-[#7A3BFF]/20 text-[#A87AFF] cursor-pointer"
                  : "bg-white/[0.05] text-white/30"
              }`}
            >
              {i < step ? "✓  " : ""}{s.label}
            </button>
          ))}
        </div>

        {/* ── Row 3: length selector (step 0 only) ── */}
        {step === 0 && (
          <>
            <div className="h-px bg-white/[0.06] mx-5" />
            <div className="px-5 py-2 lg:py-3.5">
              <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest mb-1.5 lg:mb-2.5">Video Length</p>
              <div className="flex items-center gap-2">
                {LENGTH_OPTIONS.map((opt) => (
                  <LengthButton key={opt.value} option={opt} active={selectedLength === opt.value} onClick={() => setSelectedLength(opt.value)} />
                ))}
                <span className="hidden sm:inline text-white/30 text-[12px] ml-1">{sceneCount} scenes · 5 sec each</span>
              </div>
            </div>

            <div className="h-px bg-white/[0.06] mx-5" />

            {/* ── Row 4: AI write button ── */}
            <div className="px-5 py-1.5 lg:py-2">
              <button
                onClick={handleAiWrite}
                disabled={aiWriting}
                className="flex w-full items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-white/75 hover:text-white text-[12px] font-semibold transition disabled:cursor-wait disabled:opacity-60"
              >
                <img src="/icons/ailogo.png" alt="" className="w-3.5 h-3.5 object-contain shrink-0 opacity-80" />
                {aiWriting ? "Writing famous people..." : "Let AI write the characters"}
              </button>
            </div>
          </>
        )}

        {step === 1 && savedDone && (
          <>
            <div className="h-px bg-white/[0.06] mx-5" />
            <div className="px-5 py-3.5">
              <p className="text-emerald-400 text-[11px] font-bold uppercase tracking-widest mb-1">Done</p>
              <p className="text-white/60 text-[13px]">This saved ASMR video is ready to preview on the right.</p>
            </div>
          </>
        )}

        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ══ SCROLLABLE BODY ══
           Outer div: constrained height + scroll.
           Inner div: grows freely — cards never shrink.        */}
      <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="px-5 pt-3 pb-[160px] lg:pt-4 lg:pb-4 flex flex-col gap-2 lg:gap-3">

          {/* Step 0 — scene cards */}
          {step === 0 && (() => {
            const anyUploaded = activeScenes.some((s) => s.imagePreview);
            return activeScenes.map((scene, i) => (
              <SceneCard
                key={i}
                index={i}
                scene={scene}
                onChange={(val) => updateScene(i, val)}
                onOpenPicker={handleOpenPicker}
                anyUploaded={anyUploaded}
              />
            ));
          })()}

          {/* Step 1 — background grid */}
          {step === 1 && savedDone && (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/25">
                <span className="text-2xl font-black">✓</span>
              </div>
              <p className="text-[18px] font-black text-white">Done</p>
              <p className="mt-2 max-w-[320px] text-[13px] leading-relaxed text-white/45">
                The videos are already made. Use the preview panel to watch, download, or open them fullscreen.
              </p>
            </div>
          )}

          {step === 1 && !savedDone && (
            <>
              {/* Video model — pill selector, plan-gated. Lives in the normal
                  scrollable content, not sticky. */}
              <div className="mb-1">
                <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest mb-1.5">Video Model</p>
                <div className="flex items-center gap-2 bg-[#0e1012] border border-white/[0.07] rounded-xl p-1">
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
                            ? "bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white shadow-lg shadow-[#7A3BFF]/20"
                            : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        <span className={`text-[12px] font-bold tracking-wide ${active ? "text-white" : ""}`}>{model.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          active ? "bg-white/20 text-white" : "bg-white/[0.05] text-white/30"
                        }`}>{model.tag}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedVideoModel.withSound ? (
                  <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">Audio included</span>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25">
                    <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-red-300">No audio generated</span>
                  </div>
                )}
              </div>

              <div className="mt-2">
                <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest mb-1">Background Surface</p>
                <p className="text-white/60 text-[13px] mb-2">Choose the surface your ASMR video plays on.</p>
              </div>
            <div className="grid grid-cols-2 gap-2">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setSelectedBg(bg.id)}
                  className={`relative overflow-hidden rounded-2xl text-left border transition aspect-[4/3] ${
                    selectedBg === bg.id
                      ? "border-[#7A3BFF] shadow-[0_0_12px_rgba(122,59,255,0.5)]"
                      : "border-white/[0.07] hover:border-white/25"
                  }`}
                >
                  {/* bg preview image */}
                  <img src={bg.preview} alt={bg.label} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  {/* overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {/* selected checkmark */}
                  {selectedBg === bg.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#7A3BFF] flex items-center justify-center">
                      <span className="text-white text-[9px] font-black">✓</span>
                    </div>
                  )}
                  {/* label */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <span className="text-white text-[12px] font-semibold leading-tight drop-shadow">{bg.label}</span>
                  </div>
                </button>
              ))}
            </div>
            </>
          )}

        </div>
      </div>

      {/* ══ FOOTER ══ fixed on mobile (above nav bar, with blur), static on desktop */}
      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.06] bg-[#0D0F11]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-transparent lg:backdrop-blur-0 lg:py-4">
        {step === 1 && savedDone && (
          <button
            onClick={() => { setStep(0); onBack?.(); }}
            className="flex w-full items-center justify-center gap-2 py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/70 hover:text-white font-bold text-[15px] transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {step === 1 && !savedDone && !hasEnoughCredits && (
          <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-red-300 text-[12px] font-semibold">
              Need {totalCost} credits · you have {creditBalance}
            </span>
            <a href="/workspace/pricing" className="text-red-200 text-[11px] font-bold underline shrink-0">
              Add Credits →
            </a>
          </div>
        )}
        {savedDone ? null : step === 0 ? (
          <>
            {validationError && (
              <p className="text-red-400 text-[12px] font-medium text-center mb-2">{validationError}</p>
            )}
            <button
              onClick={handleNext}
              className={`w-full py-2.5 lg:py-3.5 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all duration-500 ${
                allFilled
                  ? "bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white hover:opacity-90"
                  : partialFilled
                  ? "bg-gradient-to-r from-[#7A3BFF]/40 to-[#9F5CFF]/40 text-white/60"
                  : "bg-white/[0.05] text-white/20"
              }`}
            >
              Next: Choose Background <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setStep(0); onBack?.(); }}
              className="flex items-center justify-center w-12 py-2.5 lg:py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white transition shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => { if (isGenerating) return; if (!hasEnoughCredits) { setNoCreditsOpen(true); return; } onGenerate({ length: selectedLength, scenes: activeScenes, background: selectedBg, backgroundLabel: bgLabel, videoModel }); }}
              disabled={isGenerating}
              className={`flex-1 py-2.5 lg:py-3.5 rounded-xl font-bold text-[15px] transition flex items-center justify-center gap-2.5 ${
                isDone
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                  : isGenerating
                  ? "bg-[#7A3BFF]/25 text-white/40 cursor-not-allowed"
                  : hasEnoughCredits
                  ? "text-white bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] hover:opacity-90"
                  : "bg-white/[0.05] text-white/30 cursor-not-allowed"
              }`}
            >
              {isDone ? "✓  All Done — Generate New" : isGenerating ? "Generating…" : hasEnoughCredits ? "Generate ASMR Video" : "Not enough credits"}
              {!isDone && (
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[14px] font-bold ${
                  isGenerating ? "bg-white/5 text-white/20" : hasEnoughCredits ? "bg-white/20 text-white" : "bg-white/5 text-white/30"
                }`}>
                  <img src="/icons/whitecredit.png" alt="" className="w-4 h-4 object-contain" />
                  {totalCost}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Global reference image modal — same as Image/Video generators */}
    {pickerOpen && (
      <ReferenceImageModal
        open={pickerOpen}
        onClose={handlePickerClose}
        images={images}
        selected={selected}
        maxSelectable={1}
        onUpload={handleUpload}
        onToggle={toggleSelect}
      />
    )}

    <NoCreditsModal
      open={noCreditsOpen}
      onClose={() => setNoCreditsOpen(false)}
      creditsNeeded={totalCost}
      creditBalance={creditBalance}
    />

    <FaceAsmrUpgradeModal
      open={!!upgradeModelId}
      onClose={() => setUpgradeModelId(null)}
      modelId={upgradeModelId}
      requiredPlan={upgradeModelId ? VIDEO_MODEL_MIN_PLAN[upgradeModelId] : null}
    />
    </>
  );
}
