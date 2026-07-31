import React, { useEffect, useMemo, useRef, useState } from "react";
import FruitStepStory from "./steps/FruitStepStory";
import FruitStepScenes from "./steps/FruitStepScenes";
import Credit from "/icons/whitecredit.png";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import NoCreditsModal from "../shared/NoCreditsModal";
import { emitCreditSpend } from "../../../lib/creditPopEvents";
import {
  getFruitSceneCountForLength,
  getFruitImageCreditsPerImage,
  FRUIT_VIDEO_MODELS,
  DEFAULT_FRUIT_VIDEO_MODEL,
} from "./api/fruitStoryApi";

const STEPS = [
  {
    id:          "idea",
    label:       "Idea",
    title:       "Story Idea",
    description: "Set up the fruit drama idea, characters, and story direction.",
  },
  {
    id:          "scenes",
    label:       "Generate",
    title:       "Generate Story",
    description: "Choose the story length, video model, and size, then generate your story.",
  },
];

const IMAGE_MODEL_ID = "zyvo-v2";
const DEFAULT_STYLE_ID = "cinematic";

const STORY_LENGTH_SCENE_COUNTS = {
  "15s": getFruitSceneCountForLength("15s"),
  "30s": getFruitSceneCountForLength("30s"),
  "45s": getFruitSceneCountForLength("45s"),
  "60s": getFruitSceneCountForLength("60s"),
};

function getExpectedSceneCount(form, scenes) {
  // 1. Explicit sceneCount on form (set once generation starts)
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
  onReset,
  // Phase / loading state from useFruitStoryJob
  phase            = "idle",
  isPlanning       = false,
  isGeneratingScenes = false,
  isAnimating      = false,
  scenesDone       = false,
  scenes           = [],
  totalProgress    = 0,
  error            = null,
  // Step nav
  stepIndex,
  setStepIndex,
  hideMobileFooter = false,
  isContinuationMode = false,
  planCode,
}) {
  const [stepError, setStepError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const creditBalance = useProfileCredits();
  const bodyScrollRef = useRef(null);

  // The scrollable body div persists across steps (same DOM node, new content),
  // so it keeps whatever scrollTop the user left step 1 at instead of resetting
  // to the top of step 2 — reset it explicitly whenever the step changes.
  useEffect(() => {
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [stepIndex]);

  const currentStep  = STEPS[stepIndex] || STEPS[0];
  const isFirstStep  = stepIndex === 0;
  const isLastStep   = stepIndex === STEPS.length - 1;

  // Characters are no longer picked manually — the planner invents the cast
  // from the story idea. Step 1 just needs a non-empty idea to continue.
  const hasStoryIdea = !!form.storyIdea?.trim();
  const headerAvatar = "/viral-builder/ai-fruit/characters/ananasgirl.png";

  // Loose check — used for continuation-mode messaging
  const hasScenesReady = scenesDone || scenes.some((s) => s.imageUrl);

  const expectedSceneCount = getExpectedSceneCount(form, scenes);
  const allScenesSucceeded = useMemo(() => {
    if (!Array.isArray(scenes) || scenes.length < expectedSceneCount) return false;
    return scenes
      .slice(0, expectedSceneCount)
      .every((s) => s.imageStatus === "succeeded" && !!s.imageUrl);
  }, [scenes, expectedSceneCount]);

  const stepTitle =
    currentStep.id === "scenes" && isContinuationMode && hasScenesReady
      ? "Story Ready"
      : currentStep.title;
  const stepDescription =
    currentStep.id === "scenes" && isContinuationMode && hasScenesReady
      ? "Your story is already generated. Check the results panel."
      : currentStep.description;

  // ─── Full-story cost (images + video clips), computed here so it can live
  //     on the sticky Generate button instead of buried in the scroll body ───
  const selectedLengthId = form.storyLength || "30s";
  const sceneCountForLength = STORY_LENGTH_SCENE_COUNTS[selectedLengthId] ?? 5;
  const selectedVideoModelId = form.animationModel || DEFAULT_FRUIT_VIDEO_MODEL;
  const selectedVideoModel = FRUIT_VIDEO_MODELS[selectedVideoModelId] ?? FRUIT_VIDEO_MODELS[DEFAULT_FRUIT_VIDEO_MODEL];
  // AI-invented casts default to the 2-character rate; the planner may add a
  // synthetic third character for cheating-style stories, in which case the
  // actual per-image cost can run slightly higher than this estimate.
  const creditsPerImage = getFruitImageCreditsPerImage(IMAGE_MODEL_ID, form.selectedCharacters);
  const imageCredits = sceneCountForLength * creditsPerImage;
  const videoCredits = sceneCountForLength * selectedVideoModel.credits;
  // Each cast member also gets one solo reference portrait before scenes
  // start (2cr each, flat rate — see generateCharacterPortrait). Cast size
  // isn't known until the planner runs, so estimate worst case: 3 characters
  // (cheating-style stories synthesize a 3rd) = 6cr.
  const characterPortraitCredits = 6;
  const totalCredits = imageCredits + videoCredits + characterPortraitCredits;

  const showStoryIdeaError = () => {
    setStepError("Write or pick a story idea before continuing.");
  };

  const goNext = () => {
    if (currentStep.id === "idea" && !hasStoryIdea) {
      showStoryIdeaError();
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
    if (targetIndex > stepIndex && stepIndex === 0 && !hasStoryIdea) {
      showStoryIdeaError();
      return;
    }
    setStepError("");
    setStepIndex(targetIndex);
  };

  /* ─── Busy state: a job phase is actively running ─── */
  const isBusy = isPlanning || isGeneratingScenes || isAnimating;

  const handleGenerateClick = () => {
    if (isBusy) return;
    if (phase === "done") { onReset?.(); return; }
    if (!hasStoryIdea) {
      setStepIndex(0);
      setStepError("Write or pick a story idea before generating your story.");
      return;
    }
    if (creditBalance < totalCredits) { setNoCreditsOpen(true); return; }

    setStepError("");
    const overrides = {
      storyLength:     selectedLengthId,
      sceneCount:      sceneCountForLength,
      sceneImageModel: IMAGE_MODEL_ID,
      animationModel:  selectedVideoModelId,
      sceneAspect:     form.sceneAspect || "9:16",
      style:           DEFAULT_STYLE_ID,
      creditsPerImage,
    };
    setForm((prev) => ({ ...prev, ...overrides, sceneCredits: imageCredits }));
    emitCreditSpend(totalCredits);
    onGenerateScenes?.(overrides);
  };

  /* ─── Phase label for loading pill ─── */
  const phaseLabel = isPlanning
    ? "Planning story…"
    : isGeneratingScenes && isAnimating
    ? `Generating your story… ${totalProgress > 0 ? `${totalProgress}%` : ""}`
    : isGeneratingScenes
    ? `Generating scenes… ${totalProgress > 0 ? `${totalProgress}%` : ""}`
    : isAnimating
    ? `Animating… ${totalProgress > 0 ? `${totalProgress}%` : ""}`
    : null;

  return (
    <>
    <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#111315] shadow-2xl shadow-black/30 lg:h-full">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-white/10 p-4 sm:p-5">
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
              Generate viral fruit drama scenes and clips in one go.
            </p>
          </div>
        </div>

        {/* ── Step indicator — compact segmented pill, not spread across the row ── */}
        <div className="mt-4 flex items-center gap-2 bg-[#0e1012] border border-white/[0.07] rounded-xl p-1">
          {STEPS.map((step, index) => {
            const active = index === stepIndex;
            const done   = index < stepIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(index)}
                className={`relative flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all ${
                  active
                    ? "bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white shadow-lg shadow-[#7A3BFF]/20"
                    : done
                    ? "text-purple-200 hover:text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    active ? "bg-white/25 text-white" : done ? "bg-purple-500/25 text-purple-100" : "bg-white/10 text-white/40"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="text-[12px] font-bold tracking-wide">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body — the ONLY part of this panel that scrolls ──
          overscroll-contain stops wheel/touch scroll from "chaining" into
          the outer #workspace-scroll page container once this hits its own
          top/bottom edge — that chaining was the cause of the double-scroll
          glitch (scroll down, stop, scroll again and it creeps a bit further,
          then scrolling up needs an extra nudge to actually move). ── */}
      <div ref={bodyScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-black text-white">{stepTitle}</h2>
          <p className="mt-1 text-sm text-white/45">{stepDescription}</p>
        </div>

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
            isGenerating={isBusy}
            isContinuationMode={isContinuationMode}
            scenesGenerated={allScenesSucceeded}
            planCode={planCode}
            imageCredits={imageCredits}
            videoCredits={videoCredits}
            totalCredits={totalCredits}
          />
        )}
      </div>

      {/* ── Sticky footer — Back + Generate share one row, only this stays fixed ── */}
      <div
        className={`
          shrink-0
          ${hideMobileFooter ? "hidden lg:block" : ""}
          fixed bottom-[calc(70px+env(safe-area-inset-bottom))] left-0 right-0 z-[90]
          border-t border-white/10 bg-[#101213]/95 px-4 pb-1 pt-3 backdrop-blur-xl
          sm:px-5 sm:pb-1 sm:pt-3
          lg:static lg:border-t lg:bg-transparent lg:backdrop-blur-0
        `}
      >
        <div className="mx-auto flex w-full max-w-[900px] gap-3 px-3 pb-3 lg:max-w-none lg:px-0">
          {isFirstStep ? (
            <button
              type="button"
              onClick={goNext}
              className="h-12 flex-1 rounded-2xl bg-white text-sm font-black text-black transition hover:bg-white/90 active:scale-[0.99]"
            >
              Next Step
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={goBack}
                disabled={isBusy}
                className={`h-12 shrink-0 rounded-2xl px-5 text-sm font-bold transition ${
                  isBusy
                    ? "cursor-not-allowed border border-white/5 bg-white/[0.02] text-white/20"
                    : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                }`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={isBusy}
                className={`relative flex h-12 flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-2xl text-sm font-black transition-all active:scale-[0.99] ${
                  phase === "done"
                    ? "bg-gradient-to-b from-green-500/80 to-green-600/80 text-white"
                    : isBusy
                    ? "cursor-not-allowed bg-white/10 text-white/40"
                    : "bg-gradient-to-b from-[#A855F7] to-[#7A3BFF] text-white hover:brightness-110"
                }`}
              >
                {phase === "done" ? (
                  <><span>✓</span><span>Start New Story</span></>
                ) : isBusy ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
                    <span>Generating…{totalProgress > 0 ? ` ${totalProgress}%` : ""}</span>
                  </>
                ) : (
                  <>
                    <span>{allScenesSucceeded ? "Regenerate Story" : "Generate Story"}</span>
                    <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[13px] font-bold text-white">
                      <img src={Credit} alt="" className="h-3.5 w-3.5 object-contain" />
                      {totalCredits}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>

    <NoCreditsModal
      open={noCreditsOpen}
      onClose={() => setNoCreditsOpen(false)}
      creditsNeeded={totalCredits}
      creditBalance={creditBalance}
    />
    </>
  );
}
