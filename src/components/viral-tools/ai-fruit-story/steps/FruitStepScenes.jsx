import React, { useMemo, useState } from "react";
import { Lock, VolumeX, Volume2 } from "lucide-react";
import {
  getFruitSceneCountForLength,
  FRUIT_VIDEO_MODELS,
  DEFAULT_FRUIT_VIDEO_MODEL,
  FRUIT_VIDEO_MODEL_MIN_PLAN,
  PLAN_LABELS,
  getAllowedFruitVideoModels,
} from "../api/fruitStoryApi";
import FruitStoryUpgradeModal from "../FruitStoryUpgradeModal";

const STORY_LENGTHS = [
  { id: "15s", label: "15s", scenes: getFruitSceneCountForLength("15s") },
  { id: "30s", label: "30s", scenes: getFruitSceneCountForLength("30s") },
  { id: "45s", label: "45s", scenes: getFruitSceneCountForLength("45s") },
  { id: "60s", label: "60s", scenes: getFruitSceneCountForLength("60s") },
];

const SIZE_OPTIONS = [
  { id: "9:16", label: "9:16", description: "Vertical" },
  { id: "16:9", label: "16:9", description: "Wide" },
];

function ActiveGlow({ children, className = "" }) {
  return (
    <div
      className={`
        relative overflow-hidden
        border border-[#D8B4FE]/55
        bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,rgba(224,194,255,0.16)_30%,rgba(168,85,247,0.22)_65%,rgba(124,58,237,0.34)_100%)]
        shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_34px_rgba(124,58,237,0.18)]
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[inherit] ring-1 ring-inset ring-white/18" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_-1px_0_rgba(168,85,247,0.22)]" />
      {children}
    </div>
  );
}

export default function FruitStepScenes({
  form,
  setForm,
  scenesGenerated,
  isGenerating = false,
  isContinuationMode = false,
  planCode,
  imageCredits = 0,
  videoCredits = 0,
  totalCredits = 0,
}) {
  const [upgradeModelId, setUpgradeModelId] = useState(null);

  const selectedLengthId = form.storyLength || "30s";
  const selectedVideoModelId = form.animationModel || DEFAULT_FRUIT_VIDEO_MODEL;
  const selectedAspect = form.sceneAspect || "9:16";

  const allowedModels = getAllowedFruitVideoModels(planCode);

  const selectedLength =
    STORY_LENGTHS.find((item) => item.id === selectedLengthId) ||
    STORY_LENGTHS[1];

  const selectedVideoModel =
    FRUIT_VIDEO_MODELS[selectedVideoModelId] ?? FRUIT_VIDEO_MODELS[DEFAULT_FRUIT_VIDEO_MODEL];

  const selectedLengthIndex = Math.max(
    0,
    STORY_LENGTHS.findIndex((item) => item.id === selectedLength.id)
  );

  const sliderPercent = useMemo(() => {
    if (STORY_LENGTHS.length <= 1) return 0;
    return (selectedLengthIndex / (STORY_LENGTHS.length - 1)) * 100;
  }, [selectedLengthIndex]);

  const clipCount = selectedLength.scenes;
  const restoredSceneCount = Number(form.sceneCount || selectedLength.scenes);

  const updateFormValue = (key, value) => {
    if (isGenerating) return;
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSelectVideoModel = (modelId) => {
    if (isGenerating) return;
    if (!allowedModels.includes(modelId)) {
      setUpgradeModelId(modelId);
      return;
    }
    updateFormValue("animationModel", modelId);
  };

  if (isContinuationMode && scenesGenerated && !isGenerating) {
    return (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-green-300/20 bg-green-500/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white">Story Ready</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                Your fruit story images and clips are already generated.
              </p>
            </div>
            <span className="rounded-full border border-green-300/25 bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-200">
              Ready
            </span>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#151719] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/35">
            Loaded story
          </div>
          <div className="mt-2 text-lg font-black text-white">
            {restoredSceneCount} scenes -&gt; {restoredSceneCount} animation clips
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Scenes and clips are restored from Recent Generations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {/* STORY LENGTH */}
      <div className="rounded-[20px] border border-white/10 bg-[#151719] p-3">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Story length</h3>
            <p className="mt-1 text-xs text-white/40">
              Choose how long the final story should be.
            </p>
          </div>

          <div className="text-right leading-none">
            <div className="text-lg font-bold text-white">
              {selectedLength.label}
            </div>
            <div className="mt-1 text-[11px] font-bold text-white/35">
              {selectedLength.scenes} scenes / {clipCount} clips
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {STORY_LENGTHS.map((item) => {
            const active = selectedLengthId === item.id;

            if (active) {
              return (
                <ActiveGlow key={item.id} className="rounded-[18px]">
                  <button
                    type="button"
                    onClick={() => updateFormValue("storyLength", item.id)}
                    className="w-full rounded-[18px] px-2 py-2.5 text-center"
                  >
                    <div className="text-[15px] font-semibold tracking-[0.01em] text-white drop-shadow-[0_1px_10px_rgba(255,255,255,0.10)]">
                      {item.label}
                    </div>
                  </button>
                </ActiveGlow>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateFormValue("storyLength", item.id)}
                className="rounded-[18px] border border-white/10 bg-white/[0.03] px-2 py-2.5 text-center text-white/70 transition-all duration-300 hover:bg-white/[0.06]"
              >
                <div className="text-[15px] font-semibold">{item.label}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-[18px] border border-white/10 bg-[#0F1113] px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">Duration</span>
            <span className="text-xl font-bold text-white">
              {selectedLength.label}
            </span>
          </div>

          <div className="relative px-1">
            <div className="relative h-2 rounded-full bg-white/15">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-white via-[#D8B4FE] to-[#7C3AED] transition-all duration-300 ease-out"
                style={{ width: `${sliderPercent}%` }}
              />

              {STORY_LENGTHS.map((item, index) => {
                const left =
                  STORY_LENGTHS.length === 1
                    ? 0
                    : (index / (STORY_LENGTHS.length - 1)) * 100;

                const active = index <= selectedLengthIndex;
                const isCurrent = index === selectedLengthIndex;

                return (
                  <span
                    key={item.id}
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ${
                      isCurrent
                        ? "h-5 w-5 border-2 border-white bg-[#9F67FF] shadow-[0_0_18px_rgba(159,103,255,0.55)]"
                        : active
                        ? "h-2.5 w-2.5 border border-purple-200/80 bg-[#C4B5FD]"
                        : "h-2.5 w-2.5 border border-white/20 bg-white/10"
                    }`}
                    style={{ left: `${left}%` }}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-medium text-white/30">
            <span>15</span>
            <span>30</span>
            <span>45</span>
            <span>60</span>
          </div>
        </div>
      </div>

      {/* VIDEO MODEL — pill selector, plan-gated */}
      <div>
        <h3 className="text-sm font-semibold text-white">Video model</h3>
        <p className="mt-1 text-xs text-white/40">
          This model animates each scene into a clip.
        </p>

        <div className="mt-3 flex items-center gap-2 bg-[#0e1012] border border-white/[0.07] rounded-xl p-1">
          {Object.values(FRUIT_VIDEO_MODELS).map((model) => {
            const active = selectedVideoModelId === model.id;
            const locked = !allowedModels.includes(model.id);

            if (locked) {
              return (
                <button
                  key={model.id}
                  onClick={() => handleSelectVideoModel(model.id)}
                  title={`${model.label} requires the ${PLAN_LABELS[FRUIT_VIDEO_MODEL_MIN_PLAN[model.id]]} plan`}
                  className="relative flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-white/25 hover:text-white/40 transition-all"
                >
                  <Lock className="w-3 h-3 shrink-0" />
                  <span className="text-[12px] font-bold tracking-wide">{model.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-gradient-to-r from-[#F5C042]/25 to-[#F59E0B]/25 text-[#F5C042] border border-[#F5C042]/30">
                    {PLAN_LABELS[FRUIT_VIDEO_MODEL_MIN_PLAN[model.id]]}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={model.id}
                onClick={() => handleSelectVideoModel(model.id)}
                disabled={isGenerating}
                className={`relative flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all ${
                  active
                    ? "bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white shadow-lg shadow-[#7A3BFF]/20"
                    : "border border-white/[0.14] bg-white/[0.05] text-white/80 hover:border-white/25 hover:bg-white/[0.09] hover:text-white"
                }`}
              >
                <span className={`text-[12px] font-bold tracking-wide ${active ? "text-white" : ""}`}>{model.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  active ? "bg-white/20 text-white" : "bg-white/[0.14] text-white/70"
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

      {/* SIZE */}
      <div>
        <h3 className="text-sm font-semibold text-white">Size</h3>
        <p className="mt-1 text-xs text-white/40">
          Choose how your generated scenes should be framed.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {SIZE_OPTIONS.map((option) => {
            const active = selectedAspect === option.id;

            if (active) {
              return (
                <ActiveGlow key={option.id} className="rounded-[16px]">
               <button
  type="button"
  onClick={() => updateFormValue("sceneAspect", option.id)}
  className="w-full rounded-[16px] px-3 py-2.5 text-center"
>
  <div className="text-sm font-semibold leading-none text-white">
    {option.label}
  </div>
  <div className="mt-1 text-[11px] font-medium leading-none text-white/45">
    {option.description}
  </div>
</button>
                </ActiveGlow>
              );
            }

            return (
            <button
  key={option.id}
  type="button"
  onClick={() => updateFormValue("sceneAspect", option.id)}
  className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center transition hover:border-white/15 hover:bg-white/[0.06]"
>
  <div className="text-sm font-semibold leading-none text-white/80">
    {option.label}
  </div>
  <div className="mt-1 text-[11px] font-medium leading-none text-white/35">
    {option.description}
  </div>
</button>
            );
          })}
        </div>
      </div>

      {/* COST SUMMARY — read-only; the Generate button itself lives in the sticky footer */}
      <div className="rounded-[24px] border border-white/10 bg-[#151719] p-4">
        <div className="text-sm font-semibold text-white">
          Full story cost
        </div>
        <p className="mt-1 text-xs text-white/40">
          {selectedLength.scenes} images ({imageCredits}cr) + {clipCount} clips ({videoCredits}cr) • {selectedAspect} • {selectedVideoModel.label}
        </p>
        <div className="mt-2 text-2xl font-black text-white">
          {totalCredits} <span className="text-sm font-semibold text-white/40">credits</span>
        </div>
      </div>

      {scenesGenerated && (
        <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-3">
          <div className="text-sm font-semibold text-green-200">
            Story generated
          </div>
          <p className="mt-1 text-xs text-green-100/60">
            Your scene images and video clips are ready below.
          </p>
        </div>
      )}
    </div>

    <FruitStoryUpgradeModal
      open={!!upgradeModelId}
      onClose={() => setUpgradeModelId(null)}
      modelId={upgradeModelId}
      requiredPlan={upgradeModelId ? FRUIT_VIDEO_MODEL_MIN_PLAN[upgradeModelId] : null}
    />
    </>
  );
}
