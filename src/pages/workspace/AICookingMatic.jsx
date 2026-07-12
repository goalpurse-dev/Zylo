import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import AICookingMaticBuilder from "../../components/viral-tools/ai-cooking-matic/AICookingMaticBuilder";
import AICookingMaticResults from "../../components/viral-tools/ai-cooking-matic/AICookingMaticResults";
import { VoiceStep, CaptionStep, FinalStep } from "../../components/viral-tools/ai-cooking-matic/WorkflowSteps";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import useAICookingMaticJob from "../../components/viral-tools/ai-cooking-matic/hooks/useAICookingMaticJob";
import {
  createCookingMaticGeneration,
  listCookingMaticGenerations,
  saveVoiceToGeneration,
  CLIP_VIDEO_PROMPTS,
  VIBES,
  extractIngredient,
} from "../../components/viral-tools/ai-cooking-matic/api/cookingMaticApi";

const MAX_RECENT      = 8;
const PLAN_CACHE_KEY  = "zyvo_cooking_plan";
const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);

function getCachedPlan(userId) {
  try {
    const keys = [PLAN_CACHE_KEY, "zyvo_face_plan", "zyvo_fruit_plan", "zyvo_micro_cam_plan"];
    let fallback = null;
    for (const k of keys) {
      const d = JSON.parse(localStorage.getItem(k) || "{}");
      if (d.id !== userId || !d.code) continue;
      const code = String(d.code).toLowerCase();
      if (PAID_PLAN_CODES.has(code)) return code;
      fallback = code;
    }
    return fallback;
  } catch { return null; }
}
function setCachedPlan(userId, code) {
  try {
    if (!code) localStorage.removeItem(PLAN_CACHE_KEY);
    else localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ id: userId, code }));
  } catch {}
}

/* ── Step indicator strip ─────────────────────────────────────────────────── */
const STEPS = ["Scenes", "Voice", "Captions"];
function StepBar({ current }) {
  // current: 1 | 2 | 3
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06]">
      {STEPS.map((label, i) => {
        const n    = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black shrink-0 transition-all ${
              done   ? "bg-emerald-500 text-white" :
              active ? "bg-orange-500 text-white" :
                       "bg-white/[0.08] text-white/30"
            }`}>{done ? "✓" : n}</div>
            <span className={`text-[11px] font-semibold flex-1 ${active ? "text-white" : done ? "text-emerald-400" : "text-white/25"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`w-4 h-px mx-1 ${done ? "bg-emerald-500/50" : "bg-white/[0.08]"}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1 panel (shown while generating / after scenes done) ────────────── */
function Step1Panel({ phase, scenes, clips, onNext, onBack, onRestart }) {
  const scenesReady = scenes.filter(s => s.imageStatus === "succeeded").length;
  const clipsReady  = clips.filter(c => c.videoStatus === "succeeded").length;
  const isGenerating = phase === "images" || phase === "videos" || phase === "retrying";
  const canNext = phase === "done" && scenesReady > 0;

  return (
    <div className="flex flex-col h-full bg-[#0D0F11] rounded-2xl border border-white/[0.07] overflow-hidden">
      <StepBar current={1} />

      {/* Back to start */}
      <div className="shrink-0 px-4 pt-3">
        <button type="button" onClick={onRestart}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.06] text-white/40 hover:text-white text-[12px] font-semibold transition w-full">
          ← New generation
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5 px-5 py-4 pb-[170px] lg:pb-4">
        {/* Progress */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-white/50">Scenes</span>
              <span className="text-[11px] text-white/30">{scenesReady}/10</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-700"
                style={{ width: `${(scenesReady / 10) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-white/50">Clips</span>
              <span className="text-[11px] text-white/30">{clipsReady}/5</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
                style={{ width: `${(clipsReady / 5) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="text-center">
          {isGenerating ? (
            <p className="text-white/40 text-[13px]">
              {phase === "images" ? "Generating scenes…" : phase === "videos" ? "Animating clips…" : "Retrying…"}
            </p>
          ) : phase === "done" ? (
            <p className="text-emerald-400 text-[13px] font-semibold">
              ✓ {scenesReady} scenes · {clipsReady} clips ready
            </p>
          ) : null}
        </div>
      </div>

      {/* Footer: Next */}
      <div className="fixed inset-x-3 bottom-[72px] z-40 rounded-2xl border border-white/[0.08] bg-[#101213]/96 px-4 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.50)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-5 lg:pb-5 lg:shadow-none">
        <button type="button" onClick={onNext} disabled={!canNext}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-[15px] hover:opacity-90 active:scale-[0.98] transition disabled:opacity-30 disabled:cursor-not-allowed">
          {canNext ? "Next → Voice" : "Waiting for scenes…"}
        </button>
        {!canNext && isGenerating && (
          <p className="text-center text-white/25 text-[11px] mt-2">Next unlocks when generation completes</p>
        )}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function AICookingMatic() {
  const navigate = useNavigate();
  const [mobileTab, setMobileTab] = useState("controls"); // "controls" | "scenes"

  const { user, loading: authLoading } = useAuth();
  const [planCode, setPlanCode] = useState(() => authLoading ? null : !user ? "guest" : getCachedPlan(user?.id) ?? "free");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallGuest, setPaywallGuest] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setPlanCode("guest"); setPaywallOpen(true); setPaywallGuest(true); return; }
    supabase.from("profiles").select("plan_code").eq("id", user.id).single()
      .then(({ data }) => {
        const code = (data?.plan_code || "free").toLowerCase();
        setCachedPlan(user.id, code);
        setPlanCode(code);
        if (code === "free") setPaywallOpen(true);
      });
  }, [user, authLoading]);

  const needsUpgrade = authLoading || !PAID_PLAN_CODES.has(planCode);
  const showPaywall  = () => { setPaywallGuest(!user || planCode === "guest"); setPaywallOpen(true); };

  // ── Workflow steps ──
  // "setup" | "step1" | "step2" | "step3" | "done"
  const [workflowStep, setWorkflowStep] = useState("setup");
  const [voiceData, setVoiceData]       = useState(null);
  const [voiceDraft, setVoiceDraft]     = useState(null);
  const [captionData, setCaptionData]   = useState(null);
  const [captionDraft, setCaptionDraft] = useState(null);

  // ── Job ──
  const { phase, scenes, clips, error, dishLabel, start, reset, showGeneration, startVideoOnly } = useAICookingMaticJob();

  // ── Recent ──
  const [recentGenerations, setRecentGenerations] = useState([]);
  const savedSignatureRef    = useRef(null);
  const isViewingRecentRef   = useRef(false);
  const savedVibeRef         = useRef("dark-moody");
  const currentGenerationIdRef = useRef(null);

  const loadRecent = useCallback(async () => {
    if (!user) { setRecentGenerations([]); return; }
    try { setRecentGenerations(await listCookingMaticGenerations(MAX_RECENT)); } catch {}
  }, [user]);

  useEffect(() => { void loadRecent(); }, [loadRecent]);

  // Auto-save when fresh generation completes
  useEffect(() => {
    if (!user || phase !== "done" || scenes.length === 0 || isViewingRecentRef.current) return;
    const sig = scenes.map(s => `${s.index}:${s.imageUrl ?? ""}`).join("|");
    if (!sig || sig === savedSignatureRef.current) return;
    savedSignatureRef.current = sig;
    let cancelled = false;
    (async () => {
      try {
        const saved = await createCookingMaticGeneration({ dishName: dishLabel, vibeId: savedVibeRef.current, scenes, clips });
        if (cancelled || !saved) return;
        currentGenerationIdRef.current = saved.id;
        setRecentGenerations(prev => [saved, ...prev.filter(r => r.id !== saved.id)].slice(0, MAX_RECENT));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [phase, scenes, user, dishLabel]);

  // Auto-advance to step2 when generation completes (fresh only)
  useEffect(() => {
    if (phase === "done" && workflowStep === "step1" && !isViewingRecentRef.current) {
      // Don't auto-advance — user sees progress and clicks Next themselves
    }
  }, [phase, workflowStep]);

  // Switch to Scenes tab automatically when generation starts
  useEffect(() => {
    if (phase === "images" || phase === "videos") setMobileTab("scenes");
  }, [phase]);

  // ── Handlers ──
  const handleGenerate = ({ dishName, vibeId }) => {
    if (needsUpgrade) { showPaywall(); return; }
    isViewingRecentRef.current   = false;
    savedSignatureRef.current    = null;
    currentGenerationIdRef.current = null;
    savedVibeRef.current        = vibeId;
    setWorkflowStep("step1");
    setVoiceData(null);
    setVoiceDraft(null);
    setCaptionData(null);
    setCaptionDraft(null);
    setMobileTab("scenes");
    start({ dishName, vibeId });
  };

  const handleRestart = () => {
    reset();
    isViewingRecentRef.current   = false;
    currentGenerationIdRef.current = null;
    setWorkflowStep("setup");
    setVoiceData(null);
    setVoiceDraft(null);
    setCaptionData(null);
    setCaptionDraft(null);
    setMobileTab("controls");
  };

  const handleLoadRecent = (gen) => {
    isViewingRecentRef.current     = true;
    currentGenerationIdRef.current = gen.id;
    showGeneration(gen);
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    const savedClips = Array.isArray(gen.clips) ? gen.clips : [];
    const hasClips = savedClips.some(c => c.videoUrl);
    const savedVoice = gen.voice && gen.voice.audioUrl ? gen.voice : null;
    setMobileTab(hasClips ? "controls" : "scenes");
    setVoiceData(savedVoice);
    setVoiceDraft(savedVoice);
    setCaptionData(null);
    setWorkflowStep(hasClips ? "step2" : "step1");
  };

  // ── Left panel based on step ──
  const leftPanel = (() => {
    if (workflowStep === "setup") {
      return (
        <AICookingMaticBuilder
          phase={phase}
          onGenerate={handleGenerate}
          recentGenerations={recentGenerations}
          onLoadRecent={handleLoadRecent}
        />
      );
    }
    if (workflowStep === "step1") {
      return (
        <Step1Panel
          phase={phase}
          scenes={scenes}
          clips={clips}
          onNext={() => { setWorkflowStep("step2"); setMobileTab("controls"); }}
          onRestart={handleRestart}
        />
      );
    }
    if (workflowStep === "step2") {
      return (
        <VoiceStep
          dish={dishLabel}
          scenes={scenes}
          clips={clips}
          draft={voiceDraft}
          onDraftChange={setVoiceDraft}
          onBack={() => { setWorkflowStep("step1"); setMobileTab("controls"); }}
          onSkip={() => { setWorkflowStep("step3"); setMobileTab("controls"); }}
          onGenerate={async (data) => {
            setVoiceData(data);
            setVoiceDraft(data);
            setWorkflowStep("step3");
            setMobileTab("controls");
            try {
              const updated = await saveVoiceToGeneration({
                generationId: currentGenerationIdRef.current,
                voiceId: data.voiceId,
                voiceLabel: data.voiceLabel,
                script: data.script,
                audioBlob: data.audioBlob,
              });
              if (updated) {
                setRecentGenerations(prev => prev.map(r => r.id === updated.id ? updated : r));
              }
            } catch (e) {
              console.error("[cooking-matic] failed to save voiceover:", e);
            }
          }}
        />
      );
    }
    if (workflowStep === "step3") {
      const vibeToken = (VIBES.find(v => v.id === savedVibeRef.current) ?? VIBES[0]).token;
      const ingredient = extractIngredient(dishLabel || "dish");
      const clipPrompts = CLIP_VIDEO_PROMPTS.map((fn, i) => ({
        index: i,
        prompt: fn(dishLabel || "dish", ingredient, vibeToken),
      }));
      return (
        <CaptionStep
          dish={dishLabel}
          scenes={scenes}
          clips={clips}
          clipPrompts={clipPrompts}
          voiceData={voiceData}
          draft={captionDraft}
          onDraftChange={setCaptionDraft}
          onVoiceDataChange={setVoiceData}
          onBack={() => { setWorkflowStep("step2"); setMobileTab("controls"); }}
          onSkip={() => { setWorkflowStep("done"); setMobileTab("controls"); }}
          onApply={async (data) => {
            setCaptionData(data);
            setCaptionDraft(data);
            setWorkflowStep("done");
            setMobileTab("controls");
          }}
        />
      );
    }
    // done
    return <FinalStep clips={clips} dishLabel={dishLabel} onRestart={handleRestart} />;
  })();

  const resultsPanel = (
    <AICookingMaticResults
      workflowStep={workflowStep}
      voiceData={voiceData}
      captionDraft={captionDraft}
      onCaptionStyleChange={(styleId) => setCaptionDraft(prev => ({ ...(prev ?? {}), captionStyle: styleId }))}
      onCaptionDraftChange={setCaptionDraft}
      onChangeAudio={workflowStep === "step3" ? () => { setWorkflowStep("step2"); setMobileTab("controls"); } : undefined}
      phase={phase}
      scenes={scenes}
      clips={clips}
      dishLabel={dishLabel}
      error={error}
      recentGenerations={recentGenerations}
      onLoadRecent={handleLoadRecent}
      onNew={workflowStep !== "setup" ? handleRestart : undefined}
      onRegenerate={workflowStep !== "setup" ? () => { reset(); isViewingRecentRef.current = false; savedSignatureRef.current = null; currentGenerationIdRef.current = null; setVoiceData(null); setVoiceDraft(null); setCaptionData(null); setCaptionDraft(null); setWorkflowStep("step1"); start({ dishName: dishLabel, vibeId: savedVibeRef.current }); } : undefined}
    />
  );

  // Mobile tab labels
  const tabLabels = {
    setup:  ["Create", "Recent"],
    step1:  ["Step 1", "Scenes"],
    step2:  ["Step 2 · Voice", "Scenes"],
    step3:  ["Step 3 · Captions", "Scenes"],
    done:   ["Export", "Scenes"],
  };
  const [leftLabel, rightLabel] = tabLabels[workflowStep] ?? ["Controls", "Scenes"];

  return (
    <>
      {/* ── Desktop ── */}
      <div className="hidden lg:flex w-full h-full overflow-hidden p-3 gap-3 bg-[#0B0D0F]">
        <div className={`flex flex-col shrink-0 h-full transition-all duration-300 ${workflowStep === "setup" ? "w-[380px] xl:w-[420px]" : "w-[300px]"}`}>
          {leftPanel}
        </div>
        <div className="flex flex-1 min-w-0 h-full overflow-y-auto">
          {resultsPanel}
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="lg:hidden flex flex-col w-full bg-[#0B0D0F] min-h-full">
        {/* Tab strip */}
        <div className="sticky top-0 z-20 px-3 pt-3 pb-3 border-b border-white/10 bg-[#0B0D0F]">
          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              onClick={() => { setMobileTab("controls"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
              className={`rounded-full px-3 py-2 text-[12px] font-semibold transition truncate ${mobileTab === "controls" ? "bg-white text-black" : "text-white/60"}`}>
              {leftLabel}
            </button>
            <button
              onClick={() => { setMobileTab("scenes"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
              className={`rounded-full px-3 py-2 text-[12px] font-semibold transition ${mobileTab === "scenes" ? "bg-white text-black" : "text-white/60"}`}>
              {rightLabel}
            </button>
          </div>
        </div>

        <div className={mobileTab === "controls" ? "px-3 pb-3" : ""}>
          {mobileTab === "controls" ? leftPanel : resultsPanel}
        </div>
      </div>

      <FaceAsmrPaywall
        open={paywallOpen}
        onClose={() => { if (needsUpgrade) navigate("/workspace/home"); else setPaywallOpen(false); }}
        isGuest={paywallGuest}
        dismissable={!needsUpgrade}
        toolName="AI Cooking Matic"
        previewSrc="/face/preview.mp4"
      />
    </>
  );
}
