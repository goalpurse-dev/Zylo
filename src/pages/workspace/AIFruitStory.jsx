import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ToolGenerationLayout from "../viral/shared/ToolGenerationLayout";
import AIFruitStoryBuilder from "../../components/viral-tools/ai-fruit-story/AIFruitStoryBuilder";
import AIFruitStoryResults from "../../components/viral-tools/ai-fruit-story/AIFruitStoryResults";
import FruitStoryPaywall from "../../components/viral-tools/ai-fruit-story/FruitStoryPaywall";
import useFruitStoryJob from "../../components/viral-tools/ai-fruit-story/hooks/useFruitStoryJob";
import { isFruitVideoPromptReady, sceneCountToLength } from "../../components/viral-tools/ai-fruit-story/api/fruitStoryApi";
import { supabase } from "../../lib/supabaseClient";

export default function AIFruitStory() {
  const navigate = useNavigate();
  const [stepIndex,       setStepIndex]       = useState(0);
  const [mobilePanel,     setMobilePanel]     = useState("builder");
  const [mobileTab,       setMobileTab]       = useState("generate"); // "generate" | "recent"
  const [loadedFromRecent, setLoadedFromRecent] = useState(false);
  const [paywallOpen,     setPaywallOpen]     = useState(false);
  const [paywallGuest,    setPaywallGuest]    = useState(false);
  const [planCode,        setPlanCode]        = useState(null); // null = not yet checked

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

  // Check auth + plan on mount — open paywall immediately if not on a paid plan
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      if (!user) {
        setPlanCode("guest");
        setPaywallGuest(true);
        setPaywallOpen(true);
        return;
      }
      supabase.from("profiles").select("plan_code").eq("id", user.id).single()
        .then(({ data }) => {
          if (!mounted) return;
          const code = (data?.plan_code || "free").toLowerCase();
          setPlanCode(code);
          if (code === "free") {
            setPaywallGuest(false);
            setPaywallOpen(true);
          }
        });
    });
    return () => { mounted = false; };
  }, []);

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
    startAnimation();
    showMobileResults();
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

    // Mark that this is a restored session so Back→Step 1 triggers a clean reset
    setLoadedFromRecent(true);

    // Show Step 2 as a completed/restored scene state before animation.
    setStepIndex(1);
    setMobileTab("generate");
    setTimeout(() => setMobilePanel("results"), 100);
  };

  /* ─── Delete a saved generation ─── */
  const handleDeleteGeneration = async (id) => {
    await deleteGeneration(id);
  };

  const goMobileBack = () => {
    if (isFirstStep || isBusy) return;
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const goMobileNext = () => {
    if (isBusy) return;
    if (stepIndex === 0) {
      if (!hasEnoughCharacters) { setMobilePanel("builder"); return; }
      if (needsUpgrade) { showPaywall(); return; }
      setStepIndex(1); setMobilePanel("builder"); return;
    }
    if (stepIndex === 1) {
      if (!allRequiredScenesReady) return;
      setStepIndex(2); setMobilePanel("results"); return;
    }
    if (stepIndex === 2) {
      if (!allRequiredScenesReady || isAnimating || !videoPromptsReady) return;
      if (phase === "done") { setMobilePanel("results"); return; }
      handleAnimateScenes();
    }
  };

  const mobilePrimaryLabel =
    stepIndex === 0 ? "Next Step" :
    stepIndex === 1 ? "Next: Animate" :
    isAnimating ? `Animating${totalProgress > 0 ? ` ${totalProgress}%` : ""}` :
    phase === "done" ? "Finish" : "Animate Clips";

  const mobilePrimaryDisabled =
    isBusy ||
    (stepIndex === 0 && !hasEnoughCharacters) ||
    (stepIndex === 1 && !allRequiredScenesReady) ||
    (stepIndex === 2 && (!allRequiredScenesReady || !videoPromptsReady));

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
    <ToolGenerationLayout
      left={
        <>
          {/* ── Mobile ── */}
          <div className="lg:hidden">
            <div className="sticky top-0 z-30 mb-3 border-b border-white/10 bg-[#0B0D0F]/95 py-3 backdrop-blur">
              {/* Step 0 gets a three-tab toggle: Options / Results / Recent */}
              {stepIndex === 0 ? (
                <div className="grid grid-cols-3 rounded-full border border-white/10 bg-white/[0.04] p-1">
                  <button type="button"
                    onClick={() => { setMobilePanel("builder"); setMobileTab("generate"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
                    className={`rounded-full px-2 py-2 text-[13px] font-semibold transition ${mobilePanel === "builder" ? "bg-white text-black" : "text-white/60"}`}
                  >
                    Options
                  </button>
                  <button type="button"
                    onClick={() => { setMobilePanel("results"); setMobileTab("generate"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
                    className={`rounded-full px-2 py-2 text-[13px] font-semibold transition ${mobilePanel === "results" && mobileTab === "generate" ? "bg-white text-black" : "text-white/60"}`}
                  >
                    Results
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
              showChangeOptions={mobilePanel === "results"}
              onBack={goMobileBack}
              onChangeOptions={() => setMobilePanel("builder")}
              onPrimary={goMobileNext}
            />
          </div>

          {/* ── Desktop ── */}
          <div className="hidden lg:block">
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
  showChangeOptions, onBack, onChangeOptions, onPrimary,
}) {
  return (
    <div className="fixed bottom-[calc(70px+env(safe-area-inset-bottom))] left-0 right-0 z-[95] border-t border-white/10 bg-[#101213]/95 px-4 pb-1 pt-3 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex w-full max-w-[900px] gap-2 px-3">
        <button type="button" onClick={onBack} disabled={isFirstStep || isBusy}
          className={`h-12 rounded-2xl px-4 text-sm font-bold transition ${isFirstStep || isBusy ? "cursor-not-allowed border border-white/5 bg-white/[0.02] text-white/20" : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"}`}
        >
          Back
        </button>
        {showChangeOptions && (
          <button type="button" onClick={onChangeOptions} disabled={isBusy}
            className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white/75 transition hover:bg-white/[0.08] disabled:opacity-35"
          >
            Change options
          </button>
        )}
        <button type="button" onClick={onPrimary} disabled={!canUsePrimary}
          className={`h-12 flex-1 rounded-2xl text-sm font-black transition ${canUsePrimary ? "bg-white text-black hover:bg-white/90" : "cursor-not-allowed bg-white/10 text-white/35"}`}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
