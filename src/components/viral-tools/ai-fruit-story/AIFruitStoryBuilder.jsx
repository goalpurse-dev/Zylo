import React, { useMemo, useState } from "react";
import FruitStepStory from "./steps/FruitStepStory";
import FruitStepScenes from "./steps/FruitStepScenes";
import FruitStepAnimate from "./steps/FruitStepAnimate";
import { getFruitSceneCountForLength, isFruitVideoPromptReady } from "./api/fruitStoryApi";
import Credit from "/icons/whitecredit.png";
import NoCreditsModal from "../shared/NoCreditsModal";

// Credits per 6-second clip by model
// WAN: $0.4556/clip × 2 markup / $0.02 per credit = 46 credits
// Veo: $0.9/clip × 2 markup / $0.02 per credit = 90 credits
const VIDEO_CREDITS_PER_CLIP = {
  "zyvo-video-v2": 48,   // Wan 2.6 Flash — 8 credits/s × 6s (matches providers.ts)
  "zyvo-video-v3": 90,   // Veo 3.1 Fast  — 15 credits/s × 6s
};

const STEPS = [
  {
    id:          "idea",
    label:       "Idea",
    title:       "Story Idea",
    description: "Set up the fruit drama idea, characters, and story direction.",
  },
  {
    id:          "scenes",
    label:       "Scenes",
    title:       "Generate Scenes",
    description: "Choose the story length and image model, then generate scene images.",
  },
  {
    id:          "animate",
    label:       "Animate",
    title:       "Animate Scenes",
    description: "Turn each scene image into a talking video clip with sound.",
  },
];

const READY_BORDER = {
  borderTop:    "1px solid rgba(255,255,255,0.28)",
  borderBottom: "1px solid rgba(122,59,255,0.90)",
  borderLeft:   "1px solid rgba(184,150,255,0.30)",
  borderRight:  "1px solid rgba(184,150,255,0.30)",
};

const STORY_LENGTH_SCENE_COUNTS = {
  "15s": getFruitSceneCountForLength("15s"),
  "30s": getFruitSceneCountForLength("30s"),
  "45s": getFruitSceneCountForLength("45s"),
  "60s": getFruitSceneCountForLength("60s"),
};

function getCharacterAvatar(character) {
  return character?.image || character?.imageUrl || character?.src || character?.previewUrl || character?.url || null;
}

function getExpectedSceneCount(form, scenes) {
  // 1. Explicit sceneCount on form (set by FruitStepScenes when user picks length)
  if (Number(form?.sceneCount) > 0) return Number(form.sceneCount);
  // 2. Derive from storyLength selection
  if (form?.storyLength && STORY_LENGTH_SCENE_COUNTS[form.storyLength]) {
    return STORY_LENGTH_SCENE_COUNTS[form.storyLength];
  }
  // 3. Use however many scenes the planner actually produced
  if (Array.isArray(scenes) && scenes.length > 0) return scenes.length;
  // 4. Emergency fallback only
  return 6;
}

export default function AIFruitStoryBuilder({
  form,
  setForm,
  // Generation callbacks
  onGenerateScenes,
  onAnimateScenes,
  onSceneVideoPromptChange,
  onRegenerateSceneVideoPrompt,
  onRegenerateVideoPrompts,
  onEnsureVideoPrompts,
  onReset,
  // Phase / loading state from useFruitStoryJob
  phase            = "idle",
  isPlanning       = false,
  isGeneratingScenes = false,
  isAnimating      = false,
  scenesDone       = false,
  scenes           = [],
  videoClips       = [],
  totalProgress    = 0,
  error            = null,
  // Step nav
  stepIndex,
  setStepIndex,
  hideMobileFooter = false,
  isContinuationMode = false,
  hasEnoughCredits = true,
  totalAnimationCost = 0,
  creditBalance = 0,
}) {
  const [stepError, setStepError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);

  const currentStep  = STEPS[stepIndex] || STEPS[0];
  const isFirstStep  = stepIndex === 0;
  const isLastStep   = stepIndex === STEPS.length - 1;

  const selectedCharacters  = form.selectedCharacters || [];
  const hasEnoughCharacters = selectedCharacters.length >= 2;
  const headerAvatar = getCharacterAvatar(selectedCharacters[0]) || "/viral-builder/ai-fruit/characters/ananasgirl.png";

  // Loose check — used for Animate step and mobile footer
  const hasScenesReady = scenesDone || scenes.some((s) => s.imageUrl);

  // Strict check — "Next: Animate" is only enabled when EVERY expected scene
  // has imageStatus === "succeeded" and a real imageUrl.
  // Partial failures, generating states, and missing images keep it disabled.
  const expectedSceneCount = getExpectedSceneCount(form, scenes);
  const allScenesSucceeded = useMemo(() => {
    if (!Array.isArray(scenes) || scenes.length < expectedSceneCount) return false;
    return scenes
      .slice(0, expectedSceneCount)
      .every((s) => s.imageStatus === "succeeded" && !!s.imageUrl);
  }, [scenes, expectedSceneCount]);
  const videoPromptsReady = useMemo(() => {
    if (!allScenesSucceeded) return false;
    return scenes
      .slice(0, expectedSceneCount)
      .every((scene) => isFruitVideoPromptReady(scene.videoPrompt));
  }, [allScenesSucceeded, scenes, expectedSceneCount]);

  const progressPercent = useMemo(
    () => ((stepIndex + 1) / STEPS.length) * 100,
    [stepIndex],
  );
  const stepTitle =
    currentStep.id === "scenes" && isContinuationMode && hasScenesReady
      ? "Scenes Ready"
      : currentStep.title;
  const stepDescription =
    currentStep.id === "scenes" && isContinuationMode && hasScenesReady
      ? "Your story scenes are already generated. Continue to animate them."
      : currentStep.description;

  const canContinueCurrentStep = useMemo(() => {
    if (currentStep.id === "idea")   return hasEnoughCharacters;
    if (currentStep.id === "scenes") return allScenesSucceeded;
    return true;
  }, [currentStep.id, hasEnoughCharacters, allScenesSucceeded]);

  const showCharacterError = () => {
    setStepError("Choose at least 2 characters before continuing.");
  };

  const goNext = () => {
    if (currentStep.id === "idea" && !hasEnoughCharacters) {
      showCharacterError();
      return;
    }
    if (currentStep.id === "scenes" && !allScenesSucceeded) {
      setStepError(`Generate all ${expectedSceneCount} scene images before animating.`);
      return;
    }
    setStepError("");
    if (!isLastStep) setStepIndex((prev) => prev + 1);
  };

  const goBack = () => {
    setStepError("");
    if (!isFirstStep) {
      // If videos are done, always jump straight to step 1 — no reason to visit step 2
      if (phase === "done") { setStepIndex(0); return; }
      setStepIndex((prev) => prev - 1);
    }
  };

  const handleStepClick = (targetIndex) => {
    if (targetIndex > stepIndex && stepIndex === 0 && !hasEnoughCharacters) {
      showCharacterError();
      return;
    }
    setStepError("");
    setStepIndex(targetIndex);
  };

  // FruitStepScenes passes its local selection values as overrides so the hook
  // always receives the latest sceneCount / storyLength without stale-closure issues
  const handleGenerateScenes = (overrides = {}) => {
    if (isPlanning || isGeneratingScenes) return;

    if (!hasEnoughCharacters) {
      setStepIndex(0);
      setStepError("Choose at least 2 characters before generating scenes.");
      return;
    }
    setStepError("");
    onGenerateScenes?.(overrides);
  };

  const handleAnimateScenes = () => {
    if (!allScenesSucceeded) {
      setStepError(`Generate all ${expectedSceneCount} scene images before animating.`);
      return;
    }
    if (!videoPromptsReady) {
      setStepError("Generate prompts first.");
      return;
    }
    if (!hasEnoughCredits) {
      setNoCreditsOpen(true);
      return;
    }
    setStepError("");
    onAnimateScenes?.();
  };

  /* ─── Busy state: a job phase is actively running ─── */
  const isBusy = isPlanning || isGeneratingScenes || isAnimating;

  /* ─── Phase label for loading pill ─── */
  const phaseLabel = isPlanning
    ? "Planning story…"
    : isGeneratingScenes
    ? `Generating scenes… ${totalProgress > 0 ? `${totalProgress}%` : ""}`
    : isAnimating
    ? `Animating… ${totalProgress > 0 ? `${totalProgress}%` : ""}`
    : null;

  return (
    <>
    <div className="relative flex h-full flex-col rounded-[28px] border border-white/10 bg-[#111315] shadow-2xl shadow-black/30">
      {/* ── Header ── */}
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-orange-300/20 bg-gradient-to-br from-orange-400/25 to-purple-500/20">
            {headerAvatar ? (
              <img
                src={headerAvatar}
                alt=""
                className="h-full w-full object-cover"
                onError={(event) => {
                  if (!event.currentTarget.src.includes("/viral-builder/ai-fruit/characters/ananasgirl.png")) {
                    event.currentTarget.src = "/viral-builder/ai-fruit/characters/ananasgirl.png";
                  } else {
                    event.currentTarget.style.display = "none";
                  }
                }}
              />
            ) : (
              <span className="text-2xl font-black text-white/70">AI</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-white">AI Fruit Story</h1>
            <p className="mt-1 text-sm text-white/45">
              Generate viral fruit drama scenes and animate them after.
            </p>
          </div>
        </div>

        {/* ── Progress bar + step indicators ── */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((step, index) => {
              const active = index === stepIndex;
              const done   = index < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleStepClick(index)}
                  className="flex items-center gap-2"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black transition ${
                      active
                        ? "border-white/70 bg-gradient-to-r from-white via-[#D8B4FE] to-[#7C3AED] text-black shadow-[0_8px_24px_rgba(192,132,252,0.30)]"
                        : done
                        ? "border-purple-400/50 bg-purple-500/20 text-purple-100"
                        : "border-white/10 bg-white/[0.03] text-white/35"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`hidden text-xs font-bold sm:block ${
                      active ? "text-white" : "text-white/35"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-white via-[#D8B4FE] to-[#7C3AED] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[200px] sm:p-5 sm:pb-[200px] lg:pb-5">
        <div className="mb-5">
          <h2 className="text-lg font-black text-white">{stepTitle}</h2>
          <p className="mt-1 text-sm text-white/45">{stepDescription}</p>
        </div>

        {/* Not enough credits banner (animate step only) */}
        {currentStep.id === "animate" && allScenesSucceeded && !hasEnoughCredits && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3">
            <div>
              <div className="text-sm font-bold text-red-200">Not enough credits</div>
              <div className="text-xs text-red-300/70">
                You need {totalAnimationCost} credits to animate {scenes.slice(0, expectedSceneCount).filter(s => s.imageUrl).length} clips.
              </div>
            </div>
            <a
              href="/workspace/pricing"
              className="shrink-0 rounded-xl border border-red-400/30 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-500/30"
            >
              Add Credits →
            </a>
          </div>
        )}

        {/* Step error */}
        {stepError && (
          <div className="mb-4 rounded-2xl border border-orange-300/20 bg-orange-500/10 p-3 text-sm font-bold text-orange-200">
            {stepError}
          </div>
        )}

        {/* Job error */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm font-bold text-red-200">
            {error}
          </div>
        )}

        {/* Phase loading pill */}
        {phaseLabel && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-500/10 p-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
            <span className="text-sm font-semibold text-purple-200">{phaseLabel}</span>
          </div>
        )}

        {currentStep.id === "idea" && (
          <FruitStepStory form={form} setForm={setForm} />
        )}

        {currentStep.id === "scenes" && (
          <FruitStepScenes
            form={form}
            setForm={setForm}
            onGenerateScenes={handleGenerateScenes}
            scenesGenerated={allScenesSucceeded}
            isGenerating={isPlanning || isGeneratingScenes}
            isContinuationMode={isContinuationMode}
          />
        )}

        {currentStep.id === "animate" && (
          <FruitStepAnimate
            form={form}
            setForm={setForm}
            scenes={scenes}
            videoClips={videoClips}
            onSceneVideoPromptChange={onSceneVideoPromptChange}
            onRegenerateSceneVideoPrompt={onRegenerateSceneVideoPrompt}
            onRegenerateVideoPrompts={onRegenerateVideoPrompts}
            onEnsureVideoPrompts={onEnsureVideoPrompts}
            isAnimating={isAnimating}
            scenesGenerated={hasScenesReady}
          />
        )}
      </div>

      {/* ── Sticky footer buttons ── */}
      <div
        className={`
          ${hideMobileFooter ? "hidden lg:block" : ""}
          fixed bottom-[calc(70px+env(safe-area-inset-bottom))] left-0 right-0 z-[90]
          border-t border-white/10 bg-[#101213]/95 px-4 pb-1 pt-3 backdrop-blur-xl
          sm:px-5 sm:pb-1 sm:pt-3
          lg:static lg:border-t lg:bg-transparent lg:backdrop-blur-0
        `}
      >
        <div className="mx-auto flex w-full max-w-[900px] gap-3 px-3 lg:max-w-none lg:px-0">
          {/* Back */}
          <button
            type="button"
            onClick={goBack}
            disabled={isFirstStep || isBusy}
            className={`h-12 rounded-2xl px-5 text-sm font-bold transition ${
              isFirstStep || isBusy
                ? "cursor-not-allowed border border-white/5 bg-white/[0.02] text-white/20"
                : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            }`}
          >
            Back
          </button>

          {/* Next / Animate */}
          {!isLastStep ? (
            <button
              type="button"
              onClick={goNext}
              disabled={isBusy}
              className={`h-12 flex-1 rounded-2xl text-sm font-black transition ${
                canContinueCurrentStep && !isBusy
                  ? "bg-white text-black hover:bg-white/90 active:scale-[0.99]"
                  : "cursor-not-allowed bg-white/10 text-white/35"
              }`}
            >
              {currentStep.id === "scenes" ? "Next: Animate" : "Next Step"}
            </button>
          ) : (
            <button
              type="button"
              onClick={phase === "done" ? undefined : handleAnimateScenes}
              disabled={phase !== "done" && (isAnimating || !allScenesSucceeded || !videoPromptsReady || !hasEnoughCredits)}
              className={`
                relative flex h-12 flex-1 items-center justify-center gap-3 overflow-hidden rounded-2xl
                text-sm font-medium text-white transition-all duration-200
                ${phase === "done"
                  ? "cursor-default bg-gradient-to-b from-green-500/80 to-green-600/80"
                  : isAnimating || !allScenesSucceeded || !videoPromptsReady || !hasEnoughCredits
                  ? "cursor-not-allowed bg-white/10"
                  : "bg-gradient-to-b from-[#A855F7] to-[#7A3BFF] hover:brightness-110 active:scale-[0.99]"
                }
              `}
              style={phase === "done" || isAnimating || !allScenesSucceeded || !videoPromptsReady ? {} : READY_BORDER}
            >
              {phase !== "done" && !isAnimating && (
                <>
                  <div className="absolute inset-1 rounded-xl"><div className="mode-glow" /></div>
                  <div className="generate-shine" />
                </>
              )}

              <span className="relative z-10 flex items-center gap-2">
                {phase === "done" ? (
                  <>
                    <span>✓</span>
                    <span>Videos Ready</span>
                  </>
                ) : isAnimating ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
                    <span>Animating… {totalProgress > 0 ? `${totalProgress}%` : ""}</span>
                  </>
                ) : (
                  <>
                    <span>Animate Clips</span>
                    {(() => {
                      const clipCount = scenes.slice(0, expectedSceneCount).filter(s => s.imageUrl).length;
                      const creditsPerClip = VIDEO_CREDITS_PER_CLIP[form.animationModel ?? "zyvo-video-v2"] ?? 48;
                      const total = clipCount * creditsPerClip;
                      if (total <= 0) return null;
                      return (
                        <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                          <img src={Credit} alt="" className="h-3.5 w-3.5 opacity-90" />
                          {total}
                        </span>
                      );
                    })()}
                  </>
                )}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>

    <NoCreditsModal
      open={noCreditsOpen}
      onClose={() => setNoCreditsOpen(false)}
      creditsNeeded={totalAnimationCost}
      creditBalance={creditBalance}
    />
    </>
  );
}
