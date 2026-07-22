import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, Loader2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import AICookingMaticBuilder from "../../components/viral-tools/ai-cooking-matic/AICookingMaticBuilder";
import AICookingMaticResults from "../../components/viral-tools/ai-cooking-matic/AICookingMaticResults";
import { VoiceStep, CaptionStep, FinalStep } from "../../components/viral-tools/ai-cooking-matic/WorkflowSteps";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import useAICookingMaticJob from "../../components/viral-tools/ai-cooking-matic/hooks/useAICookingMaticJob";
import {
  beginCookingMaticGeneration,
  listCookingMaticGenerations,
  saveVoiceToGeneration,
  selectVoiceTakeForGeneration,
  saveCaptionDraftToVoiceTake,
  updateCookingMaticGenerationProgress,
  getCookingTotalCredits,
  getCookingVoiceLimit,
  CLIP_VIDEO_PROMPTS,
  VIBES,
  extractIngredient,
} from "../../components/viral-tools/ai-cooking-matic/api/cookingMaticApi";

const MAX_RECENT      = 8;
const PLAN_CACHE_KEY  = "zyvo_cooking_plan";
const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);
const COOKING_VOICE_TIMELINE_SEC = 30;

function buildCookingClipPrompts(dish, vibeId) {
  const safeDish = dish || "dish";
  const vibeToken = (VIBES.find(v => v.id === vibeId) ?? VIBES[0]).token;
  const ingredient = extractIngredient(safeDish);
  return CLIP_VIDEO_PROMPTS.map((buildPrompt, index) => ({
    index,
    prompt: buildPrompt(safeDish, ingredient, vibeToken),
  }));
}

function normalizeGeneratedVoiceTimeline(take) {
  if (!take || take.imported || take.captionScript?.timelineNormalized) return take;
  const words = Array.isArray(take.captionScript?.words) ? take.captionScript.words : [];
  const alignedDuration = words.reduce((maximum, word) => Math.max(maximum, Number(word?.end) || 0), 0);
  const sourceDuration = Number(take.durationSec) > 0 ? Number(take.durationSec) : alignedDuration;
  if (!sourceDuration || !words.length) return take;

  const playbackRate = Math.max(0.5, Math.min(2, sourceDuration / COOKING_VOICE_TIMELINE_SEC));
  const scaleTime = value => Number(((Number(value) || 0) / playbackRate).toFixed(3));
  const scaleItems = items => Array.isArray(items)
    ? items.map(item => ({ ...item, start: scaleTime(item.start), end: scaleTime(item.end) }))
    : [];
  return {
    ...take,
    playbackRate,
    timelineDurationSec: COOKING_VOICE_TIMELINE_SEC,
    captionScript: {
      ...take.captionScript,
      words: scaleItems(words),
      segments: scaleItems(take.captionScript?.segments),
      clipSegments: scaleItems(take.captionScript?.clipSegments),
      beatSegments: scaleItems(take.captionScript?.beatSegments),
      playbackRate,
      timelineDurationSec: COOKING_VOICE_TIMELINE_SEC,
      timelineNormalized: true,
      timingSource: `${take.captionScript?.timingSource || "alignment"}+30s-timeline`,
    },
  };
}

function sanitizeSelectedVoiceTake(take) {
  if (!take?.imported) return normalizeGeneratedVoiceTimeline(take);
  const duration = Number(take.durationSec);
  if (!Number.isFinite(duration) || duration <= 0) return take;
  const words = Array.isArray(take.captionScript?.words) ? take.captionScript.words : [];
  const lastCaptionEnd = words.reduce((max, word) => Math.max(max, Number(word?.end) || 0), 0);
  const scriptWordCount = String(take.script || "").trim().split(/\s+/).filter(Boolean).length;
  const clearlyStale = lastCaptionEnd > duration + 0.8 || scriptWordCount > Math.max(8, Math.ceil(duration * 4));
  if (!clearlyStale) return take;
  return {
    ...take,
    script: "",
    captionScript: { script: "", words: [], segments: [] },
    transcriptionUnavailable: true,
  };
}

function voiceTakeKey(take) {
  return take?.id || take?.audioUrl || null;
}

function hasExactCaptionTiming(captionScript) {
  return Number(captionScript?.timingVersion || 0) >= 2
    && /alignment|timestamps/i.test(String(captionScript?.timingSource || ""))
    && Array.isArray(captionScript?.words)
    && captionScript.words.length > 0;
}

function captionTimingSignature(captionScript) {
  if (!Array.isArray(captionScript?.words)) return "";
  return captionScript.words
    .map(word => `${word?.word || ""}:${Number(word?.start || 0).toFixed(3)}:${Number(word?.end || 0).toFixed(3)}`)
    .join("|");
}

function captionDraftForTake(take, fallbackDraft = null) {
  if (!take) return null;
  const captionScript = take.captionScript?.script || take.captionScript?.words?.length
    ? take.captionScript
    : (take.script ? { script: take.script, words: [], segments: [] } : null);
  const savedDraft = take.captionDraft;
  if (savedDraft) {
    const savedTiming = savedDraft.captionScript;
    const timingStillMatches = hasExactCaptionTiming(captionScript)
      && hasExactCaptionTiming(savedTiming)
      && captionTimingSignature(captionScript) === captionTimingSignature(savedTiming);
    if (timingStillMatches) return savedDraft;
  }

  // Keep the creator's visual choices, but never restore automatic overlays
  // made for a different/estimated transcript. They are rebuilt from the
  // selected take's exact word timestamps in the editor.
  return {
    captionStyle: savedDraft?.captionStyle ?? fallbackDraft?.captionStyle ?? "viral-yellow",
    textSpeed: savedDraft?.textSpeed ?? fallbackDraft?.textSpeed ?? "fast",
    captionLayout: savedDraft?.captionLayout ?? fallbackDraft?.captionLayout,
    captionScript,
    voiceTakeKey: voiceTakeKey(take),
  };
}

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
  } catch { /* storage may be unavailable */ }
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
function Step1Panel({ phase, scenes, clips, onNext, onRestart }) {
  const scenesReady = scenes.filter(s => s.imageStatus === "succeeded").length;
  const clipsReady  = clips.filter(c => c.videoStatus === "succeeded").length;
  const isGenerating = phase === "images" || phase === "videos" || phase === "retrying";
  const canNext = phase === "done" && scenesReady === 10 && clipsReady === 5;
  const incomplete = phase === "done" && !canNext;

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-[#0D0F11] lg:h-full lg:overflow-hidden">
      <StepBar current={1} />

      {/* Back to start */}
      <div className="shrink-0 px-4 pt-3">
        <button type="button" onClick={onRestart}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-white/55 transition hover:bg-white/[0.07] hover:text-white">
          <X className="h-3.5 w-3.5" /> Close creation
        </button>
        <button type="button" onClick={onRestart}
          className="hidden">
          ← New generation
        </button>
      </div>

      <div className="flex flex-col justify-center gap-5 px-5 py-4 pb-[calc(170px+env(safe-area-inset-bottom))] lg:min-h-0 lg:flex-1 lg:pb-4">
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
            <p className={`${incomplete ? "text-red-300" : "text-emerald-400"} text-[13px] font-semibold`}>
              ✓ {scenesReady} scenes · {clipsReady} clips ready
            </p>
          ) : null}
        </div>
      </div>

      {/* Footer: Next */}
      <div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-white/[0.08] bg-[#101213]/96 px-4 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.50)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-5 lg:pb-5 lg:shadow-none">
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

function GenerationRail({ phase, scenes, clips, open, onToggle }) {
  const isVideoPhase = phase === "videos";
  const isDone = phase === "done";
  const activeScene = scenes.find((scene) => ["queued", "running", "retrying"].includes(scene.imageStatus));
  const activeClips = clips.filter((clip) => ["queued", "running"].includes(clip.videoStatus));
  const activeItem = isVideoPhase
    ? activeClips[0] ?? clips.find((clip) => clip.videoStatus === "idle")
    : activeScene ?? scenes.find((scene) => scene.imageStatus === "idle");
  const activeKey = activeItem
    ? `${isVideoPhase ? "clip" : "scene"}-${activeItem.index}`
    : isDone ? "done" : "waiting";
  const [estimatedProgress, setEstimatedProgress] = useState(4);

  useEffect(() => {
    setEstimatedProgress(activeKey === "done" ? 100 : 4);
    if (activeKey === "done" || activeKey === "waiting") return undefined;
    const timer = window.setInterval(() => {
      setEstimatedProgress((current) => {
        if (current >= 94) return current;
        const step = current < 35 ? 4 : current < 70 ? 2 : 1;
        return Math.min(94, current + step);
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [activeKey]);

  const sceneDone = scenes.filter((scene) => scene.imageStatus === "succeeded").length;
  const clipDone = clips.filter((clip) => clip.videoStatus === "succeeded").length;
  const focusLabel = isDone
    ? "Generation complete"
    : isVideoPhase
      ? activeItem ? `Clip ${activeItem.index + 1}` : "Preparing clips"
      : activeItem ? `Scene ${activeItem.index + 1}` : "Preparing scenes";
  const focusProgress = isDone ? 100 : estimatedProgress;

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Open generation progress"
        className="absolute right-0 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 translate-x-[65%] items-center rounded-full border border-white/15 bg-[#151719] text-lime-300/80 transition hover:border-white/30 hover:bg-[#1b1d1f] hover:text-lime-200"
      >
        <ChevronLeft strokeWidth={3} className="absolute -left-0.5 h-5 w-5" />
        <span className={`absolute left-5 top-1.5 h-1.5 w-1.5 rounded-full ${isDone ? "bg-emerald-400" : "bg-white/45"}`} />
      </button>
    );
  }

  const renderStatus = (status, active) => {
    if (status === "succeeded") return <Check className="h-3.5 w-3.5 text-emerald-400" />;
    if (status === "failed") return <X className="h-3.5 w-3.5 text-red-400" />;
    if (active) return <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />;
    return <span className="h-3.5 w-3.5 rounded-full border border-white/15" />;
  };

  const itemProgress = (status, active) => status === "succeeded" ? 100 : active ? estimatedProgress : 0;

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-[clamp(240px,23%,310px)] flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-[#101214]/98 shadow-[-24px_0_65px_rgba(0,0,0,0.58)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isDone ? "bg-emerald-500/12" : "bg-orange-500/12"}`}>
            {isDone ? <Check className="h-4 w-4 text-emerald-400" /> : <Loader2 className="h-4 w-4 animate-spin text-orange-400" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-white">{isDone ? "Complete" : "Generating"}</p>
            <p className="text-[9px] text-white/30">{sceneDone}/10 scenes · {clipDone}/5 clips</p>
          </div>
        </div>
        <button type="button" onClick={onToggle} aria-label="Close generation progress" className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-white/[0.07] px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-bold text-white/80">{focusLabel}</span>
          <span className={`text-[10px] font-black tabular-nums ${isDone ? "text-emerald-400" : "text-orange-300"}`}>{focusProgress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isDone ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-red-500"}`}
            style={{ width: `${focusProgress}%` }}
          />
        </div>
        {!isDone && <p className="mt-2 text-[9px] leading-relaxed text-white/28">This estimate reaches 100% only when the generation is ready.</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [scrollbar-width:thin]">
        <div className="mb-2 flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/28">
          <ImageIcon className="h-3 w-3" /> Scenes
        </div>
        <div className="space-y-1">
          {scenes.map((scene) => {
            const active = !isVideoPhase && scene.index === activeItem?.index && ["queued", "running", "retrying"].includes(scene.imageStatus);
            const itemPercent = itemProgress(scene.imageStatus, active);
            return (
              <div key={scene.index} className={`rounded-lg border px-2 py-2 transition ${active ? "border-orange-400/25 bg-orange-500/[0.08]" : "border-transparent bg-white/[0.018]"}`}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{renderStatus(scene.imageStatus, active)}</span>
                      <span className={`text-[10px] font-semibold ${active ? "text-white" : scene.imageStatus === "succeeded" ? "text-white/55" : "text-white/28"}`}>Scene {scene.index + 1}</span>
                      <span className={`ml-auto text-[9px] font-bold tabular-nums ${scene.imageStatus === "succeeded" ? "text-emerald-400" : active ? "text-orange-300" : "text-white/22"}`}>{itemPercent}%</span>
                    </div>
                    <div className="ml-6 mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${scene.imageStatus === "succeeded" ? "bg-emerald-500" : scene.imageStatus === "failed" ? "bg-red-500" : "bg-gradient-to-r from-orange-500 to-red-500"}`}
                        style={{ width: `${itemPercent}%` }}
                      />
                    </div>
                  </div>
                  {scene.imageUrl && (
                    <div className="aspect-[9/16] w-7 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                      <img src={scene.imageUrl} alt={`Scene ${scene.index + 1} preview`} className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {(isVideoPhase || clips.length > 0) && (
          <>
            <div className="mb-2 mt-4 flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/28">
              <Clapperboard className="h-3 w-3" /> Video clips
            </div>
            <div className="space-y-1">
              {clips.map((clip) => {
                const active = isVideoPhase && clip.index === activeItem?.index && ["queued", "running"].includes(clip.videoStatus);
                const itemPercent = itemProgress(clip.videoStatus, active);
                return (
                  <div key={clip.index} className={`rounded-lg border px-2 py-2 transition ${active ? "border-orange-400/25 bg-orange-500/[0.08]" : "border-transparent bg-white/[0.018]"}`}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{renderStatus(clip.videoStatus, active)}</span>
                      <span className={`text-[10px] font-semibold ${active ? "text-white" : clip.videoStatus === "succeeded" ? "text-white/55" : "text-white/28"}`}>Clip {clip.index + 1}</span>
                      <span className={`ml-auto text-[9px] font-bold tabular-nums ${clip.videoStatus === "succeeded" ? "text-emerald-400" : active ? "text-orange-300" : "text-white/22"}`}>{itemPercent}%</span>
                    </div>
                    <div className="ml-6 mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${clip.videoStatus === "succeeded" ? "bg-emerald-500" : clip.videoStatus === "failed" ? "bg-red-500" : "bg-gradient-to-r from-purple-500 to-pink-500"}`}
                        style={{ width: `${itemPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
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
  const [generationRailOpen, setGenerationRailOpen] = useState(false);
  const [voiceData, setVoiceData]       = useState(null);
  const [voiceGenerations, setVoiceGenerations] = useState([]);
  const [voiceDraft, setVoiceDraft]     = useState(null);
  const [captionData, setCaptionData]   = useState(null);
  const [captionDraft, setCaptionDraft] = useState(null);
  const [exportOpen, setExportOpen]     = useState(false);
  const [savedFullVideoUrl, setSavedFullVideoUrl] = useState(null);
  const captionDraftsByVoiceRef = useRef({});
  const voiceDataRef = useRef(voiceData);
  voiceDataRef.current = voiceData;

  // CaptionStep synchronizes its local editor state through this callback.
  // Keep the callback stable so that sync effect cannot retrigger itself on
  // every parent render (the source of the maximum-update-depth loop).
  const handleCaptionDraftChange = useCallback((valueOrUpdater) => {
    setCaptionDraft(current => {
      const next = typeof valueOrUpdater === "function" ? valueOrUpdater(current) : valueOrUpdater;
      if (next === current || JSON.stringify(next) === JSON.stringify(current)) return current;
      const key = voiceTakeKey(voiceDataRef.current);
      if (key && next) captionDraftsByVoiceRef.current[key] = { ...next, voiceTakeKey: key };
      return next;
    });
  }, []);

  // Migrate an in-memory pre-modal export state during development/HMR.
  useEffect(() => {
    if (workflowStep !== "done") return;
    setWorkflowStep("step3");
    setExportOpen(true);
  }, [workflowStep]);

  // ── Job ──
  const { phase, scenes, clips, error, dishLabel, start, reset, showGeneration, retryScene, retryClip } = useAICookingMaticJob();

  // ── Recent ──
  const [recentGenerations, setRecentGenerations] = useState([]);
  const savedSignatureRef    = useRef(null);
  const isViewingRecentRef   = useRef(false);
  const savedVibeRef         = useRef("dark-moody");
  const currentGenerationIdRef = useRef(null);
  const generationSavePromiseRef = useRef(null);
  const generationStartingRef = useRef(false);
  const [currentGenerationMeta, setCurrentGenerationMeta] = useState(null);
  const [generationStartError, setGenerationStartError] = useState("");

  const loadRecent = useCallback(async () => {
    if (!user) { setRecentGenerations([]); return; }
    try { setRecentGenerations(await listCookingMaticGenerations(MAX_RECENT)); } catch { /* keep the current list */ }
  }, [user]);

  useEffect(() => { void loadRecent(); }, [loadRecent]);

  const ensureCurrentGeneration = useCallback(async () => {
    if (currentGenerationIdRef.current) return currentGenerationIdRef.current;
    const pending = generationSavePromiseRef.current
      ? await generationSavePromiseRef.current
      : null;
    return pending?.id ?? null;
  }, []);

  // Persist partial job IDs/statuses as the provider run advances. This lets a
  // refreshed page reconnect to already-submitted jobs instead of losing them.
  useEffect(() => {
    const generationId = currentGenerationIdRef.current;
    if (!user || !generationId || scenes.length === 0) return;
    const signature = JSON.stringify({ phase, scenes, clips });
    if (signature === savedSignatureRef.current) return;
    const timer = window.setTimeout(() => {
      savedSignatureRef.current = signature;
      void updateCookingMaticGenerationProgress({
        generationId,
        status: phase === "done" ? "completed" : phase === "idle" ? "generating" : phase,
        scenes,
        clips,
      }).then(updated => {
        if (!updated) return;
        setCurrentGenerationMeta(updated);
        setRecentGenerations(prev => [updated, ...prev.filter(item => item.id !== updated.id)].slice(0, MAX_RECENT));
      }).catch(progressError => {
        savedSignatureRef.current = null;
        console.error("[cooking-matic] failed to persist generation progress:", progressError);
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [phase, scenes, clips, user]);

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
  const handleGenerate = async ({ dishName, vibeId }) => {
    if (generationStartingRef.current) return;
    if (needsUpgrade) { showPaywall(); return; }
    generationStartingRef.current = true;
    setGenerationStartError("");
    isViewingRecentRef.current   = false;
    savedSignatureRef.current    = null;
    currentGenerationIdRef.current = null;
    generationSavePromiseRef.current = null;
    savedVibeRef.current        = vibeId;
    setWorkflowStep("step1");
    setGenerationRailOpen(false);
    setVoiceData(null);
    setVoiceGenerations([]);
    setVoiceDraft(null);
    setCaptionData(null);
    setCaptionDraft(null);
    setExportOpen(false);
    setSavedFullVideoUrl(null);
    captionDraftsByVoiceRef.current = {};
    setMobileTab("scenes");
    try {
      const pending = beginCookingMaticGeneration({ dishName, vibeId });
      generationSavePromiseRef.current = pending;
      const generation = await pending;
      currentGenerationIdRef.current = generation.id;
      setCurrentGenerationMeta(generation);
      setRecentGenerations(prev => [generation, ...prev.filter(item => item.id !== generation.id)].slice(0, MAX_RECENT));
      await start({ dishName, vibeId });
    } catch (startError) {
      console.error("[cooking-matic] generation could not start:", startError);
      const message = String(startError?.message ?? startError);
      setGenerationStartError(message.includes("INSUFFICIENT")
        ? "Not enough credits for this Cooking creation."
        : "Could not start this creation. Your credits were not charged for visual jobs that were not submitted.");
      reset();
      setWorkflowStep("setup");
      setMobileTab("controls");
    } finally {
      generationSavePromiseRef.current = null;
      generationStartingRef.current = false;
    }
  };

  const handleRestart = () => {
    reset();
    isViewingRecentRef.current   = false;
    currentGenerationIdRef.current = null;
    generationSavePromiseRef.current = null;
    generationStartingRef.current = false;
    setCurrentGenerationMeta(null);
    setGenerationStartError("");
    setWorkflowStep("setup");
    setVoiceData(null);
    setVoiceGenerations([]);
    setVoiceDraft(null);
    setCaptionData(null);
    setCaptionDraft(null);
    setExportOpen(false);
    setSavedFullVideoUrl(null);
    captionDraftsByVoiceRef.current = {};
    setMobileTab("controls");
  };

  const handleCloseCreation = () => {
    const returnToRecent = isViewingRecentRef.current;
    handleRestart();
    setMobileTab(returnToRecent ? "scenes" : "controls");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleLoadRecent = (gen) => {
    isViewingRecentRef.current     = true;
    currentGenerationIdRef.current = gen.id;
    setCurrentGenerationMeta(gen);
    setSavedFullVideoUrl(gen.fullVideoUrl ?? null);
    showGeneration(gen);
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    const savedClips = Array.isArray(gen.clips) ? gen.clips : [];
    const savedScenes = Array.isArray(gen.scenes) ? gen.scenes : [];
    const isCompleteGeneration = savedScenes.filter(scene => scene.imageUrl).length === 10
      && savedClips.filter(clip => clip.videoUrl).length === 5;
    const restoredTakes = (Array.isArray(gen.voiceTakes) && gen.voiceTakes.length ? gen.voiceTakes : (gen.voice?.audioUrl ? [gen.voice] : []))
      .filter(take => take?.audioUrl)
      .map(sanitizeSelectedVoiceTake);
    const selectedTakeId = gen.selectedVoiceTakeId ?? gen.selected_voice_take_id ?? gen.voice?.id;
    const savedVoice = restoredTakes.find(take => take.id === selectedTakeId)
      ?? (gen.voice?.audioUrl ? sanitizeSelectedVoiceTake(gen.voice) : null)
      ?? restoredTakes[0]
      ?? null;
    setMobileTab(isCompleteGeneration ? "controls" : "scenes");
    setVoiceData(savedVoice);
    setVoiceGenerations(restoredTakes);
    setVoiceDraft(savedVoice);
    setCaptionData(null);
    captionDraftsByVoiceRef.current = Object.fromEntries(
      restoredTakes
        .map(take => [voiceTakeKey(take), captionDraftForTake(take)])
        .filter(([key, savedDraft]) => key && savedDraft)
    );
    const restoredCaptionDraft = captionDraftsByVoiceRef.current[voiceTakeKey(savedVoice)] ?? captionDraftForTake(savedVoice);
    setCaptionDraft(restoredCaptionDraft);
    setCaptionData(restoredCaptionDraft);
    if (gen.fullVideoUrl) {
      // Keep the completed export isolated from the editor. The export modal
      // opens over the normal setup/recent view, so closing it cannot reveal
      // or autoplay Step 3. The editor is mounted only through "Back to editing".
      setWorkflowStep("setup");
      setMobileTab("controls");
      setExportOpen(true);
    } else {
      setWorkflowStep(isCompleteGeneration ? "step2" : "step1");
      setExportOpen(false);
    }
  };

  // ── Left panel based on step ──
  const renderLeftPanel = (showRecentTab) => {
    if (workflowStep === "setup") {
      return (
        <AICookingMaticBuilder
          phase={phase}
          onGenerate={handleGenerate}
          recentGenerations={recentGenerations}
          onLoadRecent={handleLoadRecent}
          showRecentTab={showRecentTab}
          totalCredits={getCookingTotalCredits(planCode)}
          voiceLimit={getCookingVoiceLimit(planCode)}
          externalError={generationStartError}
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
          onRestart={handleCloseCreation}
        />
      );
    }
    if (workflowStep === "step2") {
      const clipPrompts = buildCookingClipPrompts(dishLabel, savedVibeRef.current);
      return (
        <VoiceStep
          dish={dishLabel}
          scenes={scenes}
          clips={clips}
          clipPrompts={clipPrompts}
          generationId={currentGenerationIdRef.current}
          voiceLimit={currentGenerationMeta?.voiceGenerationLimit ?? getCookingVoiceLimit(planCode)}
          voiceUsed={currentGenerationMeta?.voiceGenerationsUsed ?? voiceGenerations.filter(take => !take?.imported).length}
          draft={voiceDraft}
          hasGeneratedVoice={Boolean(voiceData?.audioUrl)}
          onDraftChange={setVoiceDraft}
          onBack={() => { setWorkflowStep("step1"); setMobileTab("controls"); }}
          onSkip={() => { setWorkflowStep("step3"); setMobileTab("controls"); }}
          onClose={handleCloseCreation}
          onGenerate={async (data) => {
            const previousKey = voiceTakeKey(voiceData);
            if (previousKey && captionDraft) {
              captionDraftsByVoiceRef.current[previousKey] = { ...captionDraft, voiceTakeKey: previousKey };
            }
            const take = {
              ...data,
              id: globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}`,
              createdAt: new Date().toISOString(),
            };
            // Stay in Voice so creators can make and compare multiple takes.
            // The newest take is selected automatically.
            setVoiceData(take);
            setVoiceGenerations(prev => [take, ...prev.filter(item => item?.id !== take.id)]);
            setVoiceDraft(take);
            setCaptionData(null);
            setSavedFullVideoUrl(null);
            const freshDraft = captionDraftForTake(take, captionDraft);
            captionDraftsByVoiceRef.current[voiceTakeKey(take)] = freshDraft;
            setCaptionDraft(freshDraft);
            // The mobile result panel is where takes are compared and chosen.
            setMobileTab("scenes");
            document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
            try {
              const generationId = await ensureCurrentGeneration();
              if (!generationId) throw new Error("Generation row was not ready for voice persistence");
              const updated = await saveVoiceToGeneration({
                generationId,
                takeId: take.id,
                voiceId: take.voiceId,
                voiceLabel: take.voiceLabel,
                script: take.script,
                audioBlob: take.audioBlob,
                imported: take.imported,
                 fileName: take.fileName,
                 durationSec: take.durationSec,
                 playbackRate: take.playbackRate,
                 timelineDurationSec: take.timelineDurationSec,
                 captionScript: take.captionScript,
              });
              if (updated) {
                setCurrentGenerationMeta(updated);
                setRecentGenerations(prev => prev.map(r => r.id === updated.id ? updated : r));
                const persistedTakes = Array.isArray(updated.voiceTakes) ? updated.voiceTakes : [];
                setVoiceGenerations(persistedTakes.length ? persistedTakes : [updated.voice].filter(Boolean));
                if (updated.voice?.audioUrl) {
                  // A save for an older take may finish after the creator has
                  // already selected a different one. Keep the newer choice.
                  setVoiceData(current => (
                    current?.id === take.id || current?.audioUrl === take.audioUrl
                      ? sanitizeSelectedVoiceTake(updated.voice)
                      : current
                  ));
                  setVoiceDraft(current => (
                    current?.id === take.id || current?.audioUrl === take.audioUrl
                      ? sanitizeSelectedVoiceTake(updated.voice)
                      : current
                  ));
                }
              }
            } catch (e) {
              console.error("[cooking-matic] failed to save voiceover:", e);
            }
          }}
        />
      );
    }
    if (workflowStep === "step3") {
      const clipPrompts = buildCookingClipPrompts(dishLabel, savedVibeRef.current);
      return (
        <CaptionStep
          dish={dishLabel}
          generationId={currentGenerationIdRef.current}
          scenes={scenes}
          clips={clips}
          clipPrompts={clipPrompts}
          voiceData={voiceData}
          draft={captionDraft}
          onDraftChange={handleCaptionDraftChange}
          onVoiceDataChange={(updatedVoice) => {
            const key = voiceTakeKey(updatedVoice);
            const nextDraft = {
              ...(captionDraft ?? {}),
              captionScript: updatedVoice?.captionScript ?? captionDraft?.captionScript ?? null,
              textOverlays: Array.isArray(captionDraft?.textOverlays)
                ? captionDraft.textOverlays.filter(item => !item?.autoCaption)
                : undefined,
              voiceTakeKey: key,
            };
            setVoiceData(updatedVoice);
            setVoiceDraft(updatedVoice);
            setVoiceGenerations(prev => prev.map(item => (
              voiceTakeKey(item) === key ? { ...item, ...updatedVoice } : item
            )));
            if (key) captionDraftsByVoiceRef.current[key] = nextDraft;
            setCaptionDraft(nextDraft);
            void saveCaptionDraftToVoiceTake({
              generationId: currentGenerationIdRef.current,
              take: updatedVoice,
              captionDraft: nextDraft,
            }).then(updated => {
              if (!updated) return;
              setCurrentGenerationMeta(updated);
              setVoiceGenerations(updated.voiceTakes);
              setRecentGenerations(prev => prev.map(item => item.id === updated.id ? updated : item));
            }).catch(error => console.error("[cooking-matic] failed to persist refreshed caption timing:", error));
          }}
          onBack={() => { setWorkflowStep("step2"); setMobileTab("controls"); }}
          onClose={handleCloseCreation}
          onSkip={() => {
            setCaptionData(null);
            setSavedFullVideoUrl(null);
            if (globalThis.matchMedia?.("(max-width: 1023px)").matches) {
              setMobileTab("scenes");
              document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
            } else {
              setExportOpen(true);
            }
          }}
          onApply={async (data) => {
            const key = voiceTakeKey(voiceData);
            if (key) captionDraftsByVoiceRef.current[key] = { ...data, voiceTakeKey: key };
            void saveCaptionDraftToVoiceTake({
              generationId: currentGenerationIdRef.current,
              take: voiceData,
              captionDraft: { ...data, voiceTakeKey: key },
            }).then(updated => {
              if (updated) setRecentGenerations(prev => prev.map(item => item.id === updated.id ? updated : item));
            }).catch(error => console.error("[cooking-matic] failed to save caption draft:", error));
            setCaptionData(data);
            setCaptionDraft(data);
            setSavedFullVideoUrl(null);
            if (globalThis.matchMedia?.("(max-width: 1023px)").matches) {
              setExportOpen(false);
              setMobileTab("scenes");
              document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
            } else {
              setExportOpen(true);
              setMobileTab("controls");
            }
          }}
        />
      );
    }
    return null;
  };

  const resultsPanel = (
    <AICookingMaticResults
      workflowStep={workflowStep}
      voiceData={voiceData}
      voiceGenerations={voiceGenerations}
      onSelectVoice={(take) => {
        const previousKey = voiceTakeKey(voiceData);
        if (previousKey && captionDraft) {
          captionDraftsByVoiceRef.current[previousKey] = { ...captionDraft, voiceTakeKey: previousKey };
          void saveCaptionDraftToVoiceTake({
            generationId: currentGenerationIdRef.current,
            take: voiceData,
            captionDraft: { ...captionDraft, voiceTakeKey: previousKey },
          }).catch(error => console.error("[cooking-matic] failed to save caption draft:", error));
        }
        const selectedTake = sanitizeSelectedVoiceTake(take);
        const selectedKey = voiceTakeKey(selectedTake);
        const restoredDraft = captionDraftsByVoiceRef.current[selectedKey]
          ?? captionDraftForTake(selectedTake, captionDraft);
        setVoiceData(selectedTake);
        setVoiceDraft(selectedTake);
        setCaptionData(null);
        setSavedFullVideoUrl(null);
        setCaptionDraft(restoredDraft);
        void selectVoiceTakeForGeneration({
          generationId: currentGenerationIdRef.current,
          take: selectedTake,
        }).then(updated => {
          if (updated) {
            setCurrentGenerationMeta(updated);
            setRecentGenerations(prev => prev.map(r => r.id === updated.id ? updated : r));
          }
        }).catch(error => console.error("[cooking-matic] failed to save selected voice:", error));
      }}
      captionDraft={captionDraft}
      onCaptionStyleChange={(styleId) => setCaptionDraft(prev => {
        const key = voiceTakeKey(voiceData);
        const next = { ...(prev ?? {}), captionStyle: styleId, voiceTakeKey: key };
        if (key) captionDraftsByVoiceRef.current[key] = next;
        return next;
      })}
      onCaptionDraftChange={handleCaptionDraftChange}
      onChangeAudio={workflowStep === "step3" ? () => { setWorkflowStep("step2"); setMobileTab("controls"); } : undefined}
      onVoiceContinue={() => {
        if (!voiceData?.audioUrl) return;
        setWorkflowStep("step3");
        setMobileTab("controls");
        document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
      }}
      onFinishPreview={() => setExportOpen(true)}
      phase={phase}
      scenes={scenes}
      clips={clips}
      dishLabel={dishLabel}
      error={error}
      recentGenerations={recentGenerations}
      onLoadRecent={handleLoadRecent}
      onNew={workflowStep !== "setup" ? handleRestart : undefined}
      onRetryScene={retryScene}
      onRetryClip={retryClip}
      onRegenerate={workflowStep !== "setup" ? () => { reset(); isViewingRecentRef.current = false; savedSignatureRef.current = null; currentGenerationIdRef.current = null; generationSavePromiseRef.current = null; setVoiceData(null); setVoiceGenerations([]); setVoiceDraft(null); setCaptionData(null); setCaptionDraft(null); setSavedFullVideoUrl(null); setGenerationRailOpen(false); setWorkflowStep("step1"); start({ dishName: dishLabel, vibeId: savedVibeRef.current }); } : undefined}
    />
  );

  // Mobile tab labels
  const tabLabels = {
    setup:  ["Create", "Recent"],
    step1:  ["Step 1", "Scenes"],
    step2:  ["Voice setup", "Generated voices"],
    step3:  ["Caption styles", "Preview"],
    done:   ["Export", "Preview"],
  };
  const [leftLabel, rightLabel] = tabLabels[workflowStep] ?? ["Controls", "Preview"];

  return (
    <>
      {/* ── Desktop ── */}
      <div className="hidden lg:flex w-full h-full overflow-hidden p-3 gap-3 bg-[#0B0D0F]">
        <div className={`flex flex-col shrink-0 h-full transition-all duration-300 ${workflowStep === "setup" ? "w-[380px] xl:w-[420px]" : "w-[300px]"}`}>
          {renderLeftPanel(false)}
        </div>
        <div className="relative flex flex-1 min-w-0 h-full overflow-hidden">
          <div className="flex min-w-0 flex-1 overflow-y-auto">
            {resultsPanel}
          </div>
          {workflowStep === "step1" && (
            <GenerationRail
              phase={phase}
              scenes={scenes}
              clips={clips}
              open={generationRailOpen}
              onToggle={() => setGenerationRailOpen((current) => !current)}
            />
          )}
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="lg:hidden flex flex-col w-full bg-[#0B0D0F] min-h-full">
        {/* Tab strip */}
        <div className="sticky top-0 z-50 px-3 pt-3 pb-3 border-b border-white/10 bg-[#0B0D0F]">
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
          {mobileTab === "controls" ? renderLeftPanel(false) : resultsPanel}
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

      {exportOpen && (
        <FinalStep
          clips={clips}
          dishLabel={dishLabel}
          voiceData={voiceData}
          captionData={captionData ?? captionDraft}
          existingVideoUrl={savedFullVideoUrl}
          ensureGenerationId={ensureCurrentGeneration}
          onSaved={(url, updatedGeneration) => {
            setSavedFullVideoUrl(url);
            if (updatedGeneration) {
              setCurrentGenerationMeta(updatedGeneration);
              setRecentGenerations(prev => [updatedGeneration, ...prev.filter(item => item.id !== updatedGeneration.id)].slice(0, MAX_RECENT));
            } else {
              setRecentGenerations(prev => prev.map(item => item.id === currentGenerationIdRef.current ? { ...item, fullVideoUrl: url } : item));
            }
          }}
          onClose={() => {
            setExportOpen(false);
            // A saved export opened from Recent sits over the setup screen.
            // Closing it restores the create/recent view instead of leaving
            // the selected generation's scenes loaded behind the modal.
            if (workflowStep === "setup") handleCloseCreation();
          }}
          onBackToEditing={() => { setExportOpen(false); setWorkflowStep("step3"); setMobileTab("controls"); }}
          onRestart={() => { setExportOpen(false); handleRestart(); }}
          onPublish={() => navigate("/workspace/publish")}
          onViewCreations={() => navigate("/workspace/creations/viral-videos")}
        />
      )}
    </>
  );
}
