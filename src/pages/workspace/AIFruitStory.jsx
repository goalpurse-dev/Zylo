import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ToolGenerationLayout from "../viral/shared/ToolGenerationLayout";
import AIFruitStoryBuilder from "../../components/viral-tools/ai-fruit-story/AIFruitStoryBuilder";
import AIFruitStoryResults from "../../components/viral-tools/ai-fruit-story/AIFruitStoryResults";
import FruitStoryPaywall from "../../components/viral-tools/ai-fruit-story/FruitStoryPaywall";
import NoCreditsModal from "../../components/viral-tools/shared/NoCreditsModal";
import useFruitStoryJob from "../../components/viral-tools/ai-fruit-story/hooks/useFruitStoryJob";
import { isFruitVideoPromptReady, sceneCountToLength, FRUIT_VIDEO_CREDITS_PER_CLIP } from "../../components/viral-tools/ai-fruit-story/api/fruitStoryApi";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

const FRUIT_PLAN_CACHE_KEY = "zyvo_fruit_plan";
function getCachedPlan(userId) {
  try { const d = JSON.parse(localStorage.getItem(FRUIT_PLAN_CACHE_KEY) || "{}"); return d.id === userId ? d.code : null; } catch { return null; }
}
function setCachedPlan(userId, code) {
  try { localStorage.setItem(FRUIT_PLAN_CACHE_KEY, JSON.stringify({ id: userId, code })); } catch {}
}

export default function AIFruitStory() {
  const navigate = useNavigate();
  const creditBalance = useProfileCredits();
  const [stepIndex,       setStepIndex]       = useState(0);
  const [mobilePanel,     setMobilePanel]     = useState("builder");
  const [mobileTab,       setMobileTab]       = useState("generate"); // "generate" | "recent"
  const [loadedFromRecent, setLoadedFromRecent] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const [planCode, setPlanCode] = useState(() => {
    if (authLoading) return null;
    if (!user) return "guest";
    return getCachedPlan(user.id) ?? null;
  });
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(() => {
    if (authLoading) return false;
    if (!user) return true;
    return getCachedPlan(user.id) === "free";
  });
  const [paywallGuest, setPaywallGuest] = useState(() => {
    if (authLoading) return false;
    return !user;
  });

  const [form, setForm] = useState({
    storyPreset:        "cheating",
    storyIdea:          "A fruit finds out their partner is cheating and plans an emotional reveal.",
    conflict:           "Cheating betrayal",
    selectedCharacters: [],
    mainFruit:          "Orange",
    villainFruit:       "Banana",
    setting:            "Fruit city",
    style:              "cinematic",
    storyLength:        "30s",
    sceneCount:         5,
    sceneAspect:        "9:16",
    sceneImageModel:    "zyvo-v2",
    animationModel:     "zyvo-video-v2",
  });

  const {
    phase,
    scenes,
    videoClips,
    error,
    totalProgress,
    generationId,
    recentGenerations,
    isLoadingRecent,
    isPlanning,
    isGeneratingScenes,
    isAnimating,
    scenesDone,
    startSceneGeneration,
    startAnimation,
    retryFailedClips,
    ensureVideoPrompts,
    updateSceneVideoPrompt,
    regenerateSceneVideoPrompt,
    regenerateScene,
    loadGeneration,
    deleteGeneration,
    reset,
  } = useFruitStoryJob({ form });

  // When the user navigates back to Step 1 while a recently-loaded generation
  // is active, clear the in-memory job state so Step 1 feels like a fresh story.
  // The saved row in the DB is NOT deleted — it stays in Recent Generations.
  useEffect(() => {
    if (stepIndex === 0 && loadedFromRecent) {
      reset();
      setLoadedFromRecent(false);
      setForm((prev) => ({
        ...prev,
        sceneCredits: undefined,
      }));
    }
  }, [stepIndex, loadedFromRecent, reset]);

  // Verify plan from DB in background — also handles authLoading-was-true-on-mount case
  useEffect(() => {
    if (authLoading) return;
    let mounted = true;

    if (!user) {
      setPlanCode("guest"); setPaywallGuest(true); setPaywallOpen(true);
      return;
    }

    supabase.from("profiles").select("plan_code").eq("id", user.id).single()
      .then(({ data }) => {
        if (!mounted) return;
        const code = (data?.plan_code || "free").toLowerCase();
        setCachedPlan(user.id, code);
        setPlanCode(code);
        if (code === "free") {
          setPaywallGuest(false);
          setPaywallOpen(true);
        } else {
          setPaywallOpen(false); // close if cached plan was stale
        }
      });

    return () => { mounted = false; };
  }, [user, authLoading]);

  // Auto-switch to results on mobile when animation finishes
  useEffect(() => {
    if (phase === "done" && stepIndex === 2 && window.innerWidth < 1024) {
      setMobilePanel("results");
      scrollTop();
    }
  }, [phase]);

  // Show paywall helper
  const showPaywall = () => {
    setPaywallGuest(planCode === "guest");
    setPaywallOpen(true);
  };
  const needsUpgrade = planCode === "free" || planCode === "guest" || planCode === null;

  const isBusy             = isPlanning || isGeneratingScenes || isAnimating;
  const hasEnoughCharacters = (form.selectedCharacters || []).length >= 2;
  const hasScenesReady     = scenesDone || scenes.some((scene) => scene.imageUrl);
  const expectedSceneCount = Number(form.sceneCount || scenes.length || 0);

  // Total credit cost for animating all ready scenes (must be after expectedSceneCount)
  const animationClipCount  = scenes.slice(0, expectedSceneCount).filter(s => s.imageUrl).length;
  const creditsPerClip      = FRUIT_VIDEO_CREDITS_PER_CLIP[form.animationModel ?? "zyvo-video-v1"] ?? 30;
  const totalAnimationCost  = animationClipCount * creditsPerClip;
  const hasEnoughCredits    = creditBalance >= totalAnimationCost;
  const allRequiredScenesReady =
    expectedSceneCount > 0 &&
    scenes.length >= expectedSceneCount &&
    scenes
      .slice(0, expectedSceneCount)
      .every((scene) => scene.imageStatus === "succeeded" && !!scene.imageUrl);
  const videoPromptsReady =
    allRequiredScenesReady &&
    scenes
      .slice(0, expectedSceneCount)
      .every((scene) => isFruitVideoPromptReady(scene.videoPrompt));
  const isFirstStep        = stepIndex === 0;

  useEffect(() => {
    if (stepIndex === 2 && allRequiredScenesReady) {
      ensureVideoPrompts(false);
    }
  }, [stepIndex, allRequiredScenesReady, ensureVideoPrompts]);

  const handleGenerateScenes = (overrides = {}) => {
    if (isBusy) return;
    if (needsUpgrade) { showPaywall(); return; }
    setLoadedFromRecent(false);
    startSceneGeneration(overrides);
    setMobileTab("generate");
    showMobileResults();
  };

  const handleAnimateScenes = () => {
    if (!hasEnoughCredits) { setNoCreditsOpen(true); return; }
    startAnimation();
    if (window.innerWidth < 1024) {
      setMobilePanel("results");
    }
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  function showMobileResults() {
    setMobilePanel("results");
    setTimeout(() => {
      document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    }, 80);
  }

  /* ─── Continue a saved generation ─── */
  const handleContinueGeneration = async (id) => {
    const row = await loadGeneration(id);
    if (!row) return;

    // Restore form values from saved generation
    setForm((prev) => ({
      ...prev,
      storyIdea:       row.story_idea      ?? prev.storyIdea,
      storyLength:     sceneCountToLength(row.scene_count),
      sceneCount:      row.scene_count     ?? prev.sceneCount,
      sceneAspect:     row.scene_aspect    ?? prev.sceneAspect,
      sceneImageModel: row.image_model     ?? prev.sceneImageModel,
      animationModel:  row.animation_model ?? prev.animationModel,
    }));

    setLoadedFromRecent(true);

    // If all scenes have videos → go straight to step 3 (animate/results)
    // If only images → go to step 2 (scenes ready to animate)
    const scenes = row.scenes ?? [];
    const hasVideos = scenes.some(s => s.videoUrl);
    const targetStep = hasVideos ? 2 : 1;

    setStepIndex(targetStep);
    setMobileTab("generate");
    scrollTop();
    setTimeout(() => setMobilePanel(hasVideos ? "results" : "builder"), 100);
  };

  /* ─── Delete a saved generation ─── */
  const handleDeleteGeneration = async (id) => {
    await deleteGeneration(id);
  };

  const goMobileBack = () => {
    if (isFirstStep || isBusy) return;
    // If videos are done, Back always goes straight to step 1 to start over
    if (phase === "done") {
      setStepIndex(0);
      setMobilePanel("builder");
      scrollTop();
      return;
    }
    setStepIndex((prev) => Math.max(0, prev - 1));
    scrollTop();
  };

  const scrollTop = () => document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });

  const goMobileNext = () => {
    if (isBusy) return;
    if (stepIndex === 0) {
      if (!hasEnoughCharacters) { setMobilePanel("builder"); return; }
      if (needsUpgrade) { showPaywall(); return; }
      setStepIndex(1); setMobilePanel("builder"); scrollTop(); return;
    }
    if (stepIndex === 1) {
      if (!allRequiredScenesReady) return;
      setStepIndex(2); setMobilePanel("builder"); scrollTop(); return;
    }
    if (stepIndex === 2) {
      if (!allRequiredScenesReady || isAnimating || !videoPromptsReady) return;
      if (phase === "done") { setMobilePanel("results"); scrollTop(); return; }
      handleAnimateScenes();
    }
  };

  const mobilePrimaryLabel =
    stepIndex === 0 ? "Next Step" :
    stepIndex === 1 ? "Next: Animate" :
    isAnimating ? `Animating${totalProgress > 0 ? ` ${totalProgress}%` : ""}` :
    phase === "done" ? "Watch Videos" : "Animate Clips";

  const mobilePrimaryDisabled =
    isBusy ||
    (stepIndex === 0 && !hasEnoughCharacters) ||
    (stepIndex === 1 && !allRequiredScenesReady) ||
    // On step 3: if done, Finish is always enabled. Otherwise check scenes + prompts (credits show a modal).
    (stepIndex === 2 && phase !== "done" && (!allRequiredScenesReady || !videoPromptsReady));

  const builderPanel = (
    <AIFruitStoryBuilder
      form={form}
      setForm={setForm}
      onGenerateScenes={handleGenerateScenes}
      onAnimateScenes={handleAnimateScenes}
      onSceneVideoPromptChange={updateSceneVideoPrompt}
      onRegenerateSceneVideoPrompt={regenerateSceneVideoPrompt}
      onRegenerateVideoPrompts={() => ensureVideoPrompts(true)}
      onEnsureVideoPrompts={ensureVideoPrompts}
      onReset={() => { reset(); setMobilePanel("builder"); setStepIndex(0); }}
      phase={phase}
      isPlanning={isPlanning}
      isGeneratingScenes={isGeneratingScenes}
      isAnimating={isAnimating}
      scenesDone={scenesDone}
      scenes={scenes}
      videoClips={videoClips}
      totalProgress={totalProgress}
      error={error}
      stepIndex={stepIndex}
      setStepIndex={setStepIndex}
      hideMobileFooter
      isContinuationMode={loadedFromRecent}
      hasEnoughCredits={hasEnoughCredits}
      totalAnimationCost={totalAnimationCost}
      creditBalance={creditBalance}
    />
  );

  const resultsPanel = (
    <AIFruitStoryResults
      form={form}
      scenes={scenes}
      videoClips={videoClips}
      phase={phase}
      stepIndex={stepIndex}
      recentGenerations={recentGenerations}
      isLoadingRecent={isLoadingRecent}
      onEditOptions={() => setMobilePanel("builder")}
      onRegenerateScene={regenerateScene}
      onContinueGeneration={handleContinueGeneration}
      onDeleteGeneration={handleDeleteGeneration}
      onRetryFailedClips={retryFailedClips}
    />
  );

  return (
    <>
    <FruitStoryPaywall
      open={paywallOpen}
      onClose={() => {
        if (needsUpgrade) {
          navigate("/workspace/home");
        } else {
          setPaywallOpen(false);
        }
      }}
      isGuest={paywallGuest}
      dismissable={!needsUpgrade}
    />
    <NoCreditsModal
      open={noCreditsOpen}
      onClose={() => setNoCreditsOpen(false)}
      creditsNeeded={totalAnimationCost}
      creditBalance={creditBalance}
    />
    <ToolGenerationLayout
      left={
        <>
          {/* ── Mobile ── */}
          <div className="lg:hidden">
            <div className="sticky top-0 z-30 mb-3 border-b border-white/10 bg-[#0B0D0F]/95 py-3 backdrop-blur">
              {/* Step 0: Options / Recent only (no Results) */}
              {stepIndex === 0 ? (
                <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
                  <button type="button"
                    onClick={() => { setMobilePanel("builder"); setMobileTab("generate"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
                    className={`rounded-full px-2 py-2 text-[13px] font-semibold transition ${mobilePanel === "builder" ? "bg-white text-black" : "text-white/60"}`}
                  >
                    Options
                  </button>
                  <button type="button"
                    onClick={() => { setMobilePanel("results"); setMobileTab("recent"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
                    className={`rounded-full px-2 py-2 text-[13px] font-semibold transition ${mobilePanel === "results" && mobileTab === "recent" ? "bg-white text-black" : "text-white/60"}`}
                  >
                    Recent
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
                  <button type="button"
                    onClick={() => { setMobilePanel("builder"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${mobilePanel === "builder" ? "bg-white text-black" : "text-white/60"}`}
                  >
                    Options
                  </button>
                  <button type="button"
                    onClick={() => { setMobilePanel("results"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${mobilePanel === "results" ? "bg-white text-black" : "text-white/60"}`}
                  >
                    Results
                  </button>
                </div>
              )}
            </div>

            {mobilePanel === "builder" ? builderPanel : (
              <AIFruitStoryResults
                form={form}
                scenes={scenes}
                videoClips={videoClips}
                phase={phase}
                stepIndex={stepIndex}
                recentGenerations={recentGenerations}
                isLoadingRecent={isLoadingRecent}
                onEditOptions={() => setMobilePanel("builder")}
                onRegenerateScene={regenerateScene}
                onContinueGeneration={handleContinueGeneration}
                onDeleteGeneration={handleDeleteGeneration}
                mobileRecentTab={mobileTab === "recent"}
              />
            )}

            <MobileFruitStoryFooter
              isFirstStep={isFirstStep}
              isBusy={isBusy}
              canUsePrimary={!mobilePrimaryDisabled}
              primaryLabel={mobilePrimaryLabel}
              onBack={goMobileBack}
              onPrimary={goMobileNext}
              isAnimateAction={stepIndex === 2 && !isAnimating && phase !== "done"}
              creditCost={stepIndex === 2 && !isAnimating && phase !== "done" ? totalAnimationCost : 0}
              hasEnoughCredits={hasEnoughCredits}
            />
          </div>

          {/* ── Desktop ── */}
          <div className="hidden lg:block lg:h-full">
            {builderPanel}
          </div>
        </>
      }
      right={
        <div id="ai-fruit-results">
          {resultsPanel}
        </div>
      }
    />
    </>
  );
}

function MobileFruitStoryFooter({
  isFirstStep, isBusy, canUsePrimary, primaryLabel,
  onBack, onPrimary,
  isAnimateAction = false, creditCost = 0, hasEnoughCredits = true,
}) {
  const isDone = primaryLabel === "Watch Videos";
  const showCreditWarning = creditCost > 0 && !hasEnoughCredits && !isDone;

  return (
    <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[95] lg:hidden">
      {/* Low-credit warning strip */}
      {showCreditWarning && (
        <div className="mx-4 mb-1.5 flex items-center justify-between gap-2 rounded-[12px] border border-red-400/20 bg-red-500/10 px-3 py-2">
          <span className="text-[11px] font-semibold text-red-300">Need {creditCost} credits</span>
          <a href="/workspace/pricing" className="text-[11px] font-bold text-red-200 underline">Add Credits →</a>
        </div>
      )}

      <div className="border-t border-white/[0.08] bg-[#101213]/96 px-4 pb-2 pt-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">

          {/* Back — compact icon button */}
          <button
            type="button"
            onClick={onBack}
            disabled={isFirstStep || isBusy}
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] transition text-lg ${
              isFirstStep || isBusy
                ? "bg-white/[0.03] text-white/15"
                : "bg-white/[0.06] text-white/60 active:scale-95"
            }`}
          >
            ←
          </button>

          {/* Primary action */}
          <button
            type="button"
            onClick={onPrimary}
            disabled={!canUsePrimary}
            className={`relative flex h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-[14px] text-[14px] font-black transition-all active:scale-[0.98] ${
              isDone
                ? "bg-[#16a34a] text-white"
                : !canUsePrimary
                ? "cursor-not-allowed bg-white/[0.06] text-white/25"
                : isAnimateAction
                ? "text-white"
                : "bg-white text-black"
            }`}
            style={canUsePrimary && isAnimateAction && !isDone ? {
              background: "linear-gradient(135deg, #A855F7, #7A3BFF)",
              boxShadow: "0 4px 16px rgba(122,59,255,0.4)",
            } : {}}
          >
            {isDone ? (
              <><span>✓</span><span>Videos Ready</span></>
            ) : (
              <>
                <span>{primaryLabel}</span>
                {creditCost > 0 && canUsePrimary && (
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    isAnimateAction ? "bg-white/20 text-white" : "bg-black/10 text-black/60"
                  }`}>
                    <img src="/icons/whitecredit.png" alt="" className={`h-3 w-3 ${!isAnimateAction ? "invert" : ""}`} />
                    {creditCost}
                  </span>
                )}
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}
