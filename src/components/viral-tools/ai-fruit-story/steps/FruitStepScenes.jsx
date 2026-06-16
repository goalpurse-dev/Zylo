import React, { useMemo, useState } from "react";
import Credit from "/icons/whitecredit.png";
import { getFruitImageCreditsPerImage, getFruitSceneCountForLength } from "../api/fruitStoryApi";
import { useProfileCredits } from "../../../../hooks/useProfileCredits";
import NoCreditsModal from "../../shared/NoCreditsModal";

// Style is fixed internally — not exposed to the user.
// "cinematic" is the premium TikTok fruit drama default used by the planner.
const DEFAULT_STYLE_ID = "cinematic";

const READY_BORDER = {
  borderTop: "1px solid rgba(255,255,255,0.28)",
  borderBottom: "1px solid rgba(122,59,255,0.90)",
  borderLeft: "1px solid rgba(184,150,255,0.30)",
  borderRight: "1px solid rgba(184,150,255,0.30)",
};

const STORY_LENGTHS = [
  {
    id: "15s",
    label: "15s",
    scenes: getFruitSceneCountForLength("15s"),
  },
  {
    id: "30s",
    label: "30s",
    scenes: getFruitSceneCountForLength("30s"),
  },
  {
    id: "45s",
    label: "45s",
    scenes: getFruitSceneCountForLength("45s"),
  },
  {
    id: "60s",
    label: "60s",
    scenes: getFruitSceneCountForLength("60s"),
  },
];
const SIZE_OPTIONS = [
  {
    id: "9:16",
    label: "9:16",
    description: "Vertical",
  },
  {
    id: "16:9",
    label: "16:9",
    description: "Wide",
  },
];

const IMAGE_MODELS = [
  {
    id: "zyvo-v2",
    label: "Zyvo V2",
    description: "Fast, clean, and affordable scene generation.",
    tag: "Fast",
    creditsPerImage: 2,
  },
  {
    id: "zyvo-v3",
    label: "Zyvo V3",
    description: "Higher-resolution GPT Image 2 scenes with stronger detail.",
    tag: "Best quality",
    creditsPerImage: 8,
  },
];

const GenerateScenesButton = React.memo(function GenerateScenesButton({
  onClick,
  estimatedCredits,
  isGenerating = false,
  scenesGenerated = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isGenerating}
      className={`
        relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl py-4
        transition-all duration-200
        ${isGenerating
          ? "cursor-not-allowed bg-white/10"
          : "bg-gradient-to-b from-[#A855F7] to-[#7A3BFF] hover:brightness-110 active:scale-[0.99]"
        }
      `}
      style={isGenerating ? {} : READY_BORDER}
    >
      <div className="absolute inset-1 rounded-xl">
        <div className="mode-glow" />
      </div>

      <div className="generate-shine" />

      <span className="relative z-10 flex items-center gap-3 text-[15px] font-medium text-white">
        {isGenerating ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
            <span>Generating Scenes...</span>
          </>
        ) : (
          <>
            <span>{scenesGenerated ? "Regenerate Scenes" : "Generate Scenes"}</span>
            <span className="flex items-center gap-1 text-white/90">
              <img
                src={Credit}
                alt="credits"
                className="h-5 w-auto scale-125 object-contain brightness-125 contrast-125"
              />
              <span>{estimatedCredits}</span>
            </span>
          </>
        )}
      </span>
    </button>
  );
});

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
  onGenerateScenes,
  scenesGenerated,
  isGenerating = false,
  isContinuationMode = false,
}) {
  const creditBalance = useProfileCredits();
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);

  const selectedLengthId = form.storyLength || "30s";
  const selectedModelId = form.sceneImageModel || "zyvo-v2";
  const selectedAspect = form.sceneAspect || "9:16";

  const selectedLength =
    STORY_LENGTHS.find((item) => item.id === selectedLengthId) ||
    STORY_LENGTHS[1];

  const selectedModel =
    IMAGE_MODELS.find((item) => item.id === selectedModelId) ||
    IMAGE_MODELS[0];

  const selectedLengthIndex = Math.max(
    0,
    STORY_LENGTHS.findIndex((item) => item.id === selectedLength.id)
  );

  const sliderPercent = useMemo(() => {
    if (STORY_LENGTHS.length <= 1) return 0;
    return (selectedLengthIndex / (STORY_LENGTHS.length - 1)) * 100;
  }, [selectedLengthIndex]);

const creditsPerImage = getFruitImageCreditsPerImage(selectedModel.id, form.selectedCharacters);
const sceneCredits = selectedLength.scenes * creditsPerImage;
const clipCount = selectedLength.scenes;
const restoredSceneCount = Number(form.sceneCount || selectedLength.scenes);
const restoredClipCount = restoredSceneCount;

  const updateFormValue = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleGenerate = () => {
    if (isGenerating) return;
    if (creditBalance < sceneCredits) { setNoCreditsOpen(true); return; }

    setForm((prev) => ({
      ...prev,
      storyLength:     selectedLength.id,
      sceneCount:      selectedLength.scenes,
      sceneImageModel: selectedModel.id,
      sceneAspect:     selectedAspect,
      style:           DEFAULT_STYLE_ID,
      sceneCredits,
      creditsPerImage,
    }));

    onGenerateScenes?.({
      storyLength:     selectedLength.id,
      sceneCount:      selectedLength.scenes,
      sceneImageModel: selectedModel.id,
      sceneAspect:     selectedAspect,
      style:           DEFAULT_STYLE_ID,
      creditsPerImage,
    });
  };

  if (isContinuationMode && scenesGenerated && !isGenerating) {
    return (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-green-300/20 bg-green-500/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white">Scenes Ready</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                Your story scenes are already generated. Continue to animate them.
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
            {restoredSceneCount} scenes -&gt; {restoredClipCount} animation clips
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Scene images are restored from Recent Generations. Use Next: Animate to create talking clips.
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

      {/* IMAGE MODEL */}
      <div>
        <h3 className="text-sm font-semibold text-white">Image model</h3>
        <p className="mt-1 text-xs text-white/40">
          This model generates each fruit story scene.
        </p>

        <div className="mt-3 grid gap-3">
          {IMAGE_MODELS.map((model) => {
            const active = selectedModelId === model.id;

            if (active) {
              return (
                <ActiveGlow key={model.id} className="rounded-[20px]">
                  <button
                    type="button"
                    onClick={() => updateFormValue("sceneImageModel", model.id)}
                    className="w-full rounded-[20px] p-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {model.label}
                        </div>
                        <p className="mt-1 text-xs text-white/60">
                          {model.description}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                        {model.tag}
                      </span>
                    </div>
                  </button>
                </ActiveGlow>
              );
            }

            return (
              <button
                key={model.id}
                type="button"
                onClick={() => updateFormValue("sceneImageModel", model.id)}
                className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                      {model.label}
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      {model.description}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                    {model.tag}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* COST + BUTTON */}
      <div className="rounded-[24px] border border-white/10 bg-[#151719] p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-white">
            Scene generation cost
          </div>
          <p className="mt-1 text-xs text-white/40">
            {selectedLength.scenes} images / {clipCount} clips • {selectedAspect} •{" "}
            {selectedModel.label} • {sceneCredits} credits
          </p>
        </div>

        <GenerateScenesButton
          onClick={handleGenerate}
          estimatedCredits={sceneCredits}
          isGenerating={isGenerating}
          scenesGenerated={scenesGenerated}
        />
      </div>

      {scenesGenerated && (
        <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-3">
          <div className="text-sm font-semibold text-green-200">
            Scenes generated
          </div>
          <p className="mt-1 text-xs text-green-100/60">
            Your scene images are ready. Click Next to animate them.
          </p>
        </div>
      )}
    </div>

    <NoCreditsModal
      open={noCreditsOpen}
      onClose={() => setNoCreditsOpen(false)}
      creditsNeeded={sceneCredits}
      creditBalance={creditBalance}
    />
    </>
  );
}
