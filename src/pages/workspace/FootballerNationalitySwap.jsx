import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import FootballerNationalitySwapBuilder from "../../components/viral-tools/footballer-nationality-swap/FootballerNationalitySwapBuilder";
import FootballerNationalitySwapResults from "../../components/viral-tools/footballer-nationality-swap/FootballerNationalitySwapResults";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import useFootballerNationalitySwapJob from "../../components/viral-tools/footballer-nationality-swap/hooks/useFootballerNationalitySwapJob";
import {
  createFootballerNationalitySwapGeneration,
  listFootballerNationalitySwapGenerations,
} from "../../components/viral-tools/footballer-nationality-swap/api/footballerNationalitySwapApi";

const MAX_RECENT      = 8;
const PLAN_CACHE_KEY  = "zyvo_footballer_plan";
const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);

function getCachedPlan(userId) {
  try {
    const fallbackKeys = [PLAN_CACHE_KEY, "zyvo_clay_plan", "zyvo_micro_cam_plan", "zyvo_face_plan", "zyvo_fruit_plan"];
    let fallback = null;
    for (const key of fallbackKeys) {
      const d = JSON.parse(localStorage.getItem(key) || "{}");
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
function getCachedPaidPlan(userId) {
  const code = getCachedPlan(userId);
  return PAID_PLAN_CODES.has(code) ? code : null;
}

export default function FootballerNationalitySwap() {
  const navigate     = useNavigate();
  const [mobilePanel, setMobilePanel] = useState("builder");

  const { user, loading: authLoading } = useAuth();

  const [planCode, setPlanCode] = useState(() => {
    if (authLoading) return null;
    if (!user) return "guest";
    return getCachedPlan(user.id) ?? "free";
  });

  const [paywallOpen, setPaywallOpen] = useState(() => {
    if (authLoading) return false;
    if (user && !getCachedPaidPlan(user.id)) return true;
    if (!user) return true;
    return getCachedPlan(user.id) === "free";
  });

  const [paywallGuest, setPaywallGuest] = useState(() => {
    if (authLoading) return false;
    return !user;
  });

  useEffect(() => {
    if (authLoading) return;
    let mounted = true;
    if (!user) {
      setPlanCode("guest"); setPaywallGuest(true); setPaywallOpen(true);
      return;
    }
    supabase.from("profiles").select("plan_code").eq("id", user.id).single()
      .then(({ data, error: dbErr }) => {
        if (!mounted) return;
        if (dbErr) {
          setCachedPlan(user.id, null);
          setPlanCode("free");
          setPaywallGuest(false);
          setPaywallOpen(true);
          return;
        }
        const code = (data?.plan_code || "free").toLowerCase();
        setCachedPlan(user.id, code);
        setPlanCode(code);
        if (code === "free") { setPaywallGuest(false); setPaywallOpen(true); }
        else { setPaywallOpen(false); }
      })
      .catch(() => {
        if (!mounted) return;
        setCachedPlan(user.id, null);
        setPlanCode("free");
        setPaywallGuest(false);
        setPaywallOpen(true);
      });
    return () => { mounted = false; };
  }, [user, authLoading]);

  const needsUpgrade = authLoading || !PAID_PLAN_CODES.has(planCode);
  const showPaywall  = () => {
    setPaywallGuest(!user || planCode === "guest");
    setPaywallOpen(true);
  };

  const { phase, scenes: jobScenes, error, start, reset, showGeneration, retryScene } = useFootballerNationalitySwapJob();

  const [recentGenerations, setRecentGenerations] = useState([]);
  const [viewingRecentId, setViewingRecentId]     = useState(null);
  const [currentGenerationId, setCurrentGenerationId] = useState(null);
  const [currentFullVideoUrl, setCurrentFullVideoUrl] = useState(null);
  const savedGenerationRef = useRef(null);
  const latestSceneCountRef = useRef(3);

  const loadRecentGenerations = useCallback(async () => {
    if (!user) { setRecentGenerations([]); return; }
    try {
      const rows = await listFootballerNationalitySwapGenerations(MAX_RECENT);
      setRecentGenerations(rows);
    } catch (e) {
      console.error("[FootballerNationalitySwap] load recent failed:", e.message);
      setRecentGenerations([]);
    }
  }, [user]);

  useEffect(() => { void loadRecentGenerations(); }, [loadRecentGenerations]);

  // Auto-save when generation completes
  useEffect(() => {
    if (!user || phase !== "done" || jobScenes.length === 0 || viewingRecentId !== null) return;
    const signature = jobScenes.map((s) => `${s.index}:${s.imageUrl || ""}:${s.videoUrl || ""}`).join("|");
    if (!signature || signature === savedGenerationRef.current) return;
    savedGenerationRef.current = signature;

    let cancelled = false;
    (async () => {
      try {
        const saved = await createFootballerNationalitySwapGeneration({ sceneCount: latestSceneCountRef.current, scenes: jobScenes });
        if (cancelled) return;
        setRecentGenerations((prev) => {
          const deduped = prev.filter((r) => r.id !== saved.id);
          return [saved, ...deduped].slice(0, MAX_RECENT);
        });
        setCurrentGenerationId(saved.id);
        setCurrentFullVideoUrl(saved.fullVideoUrl ?? null);
      } catch (e) {
        console.error("[FootballerNationalitySwap] save generation failed:", e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [phase, jobScenes, viewingRecentId, user]);

  const handleGenerate = ({ sceneInputs, sceneCount }) => {
    if (needsUpgrade) { showPaywall(); return; }
    setViewingRecentId(null);
    savedGenerationRef.current = null;
    latestSceneCountRef.current = sceneCount;
    setCurrentGenerationId(null);
    setCurrentFullVideoUrl(null);
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    start({ sceneInputs });
  };

  const handleOpenRecent = (generation) => {
    setViewingRecentId(generation?.id ?? null);
    setCurrentGenerationId(generation?.id ?? null);
    setCurrentFullVideoUrl(generation?.fullVideoUrl ?? null);
    showGeneration(generation);
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleBackToDefault = () => {
    setViewingRecentId(null);
    setCurrentGenerationId(null);
    setCurrentFullVideoUrl(null);
    reset();
    setMobilePanel("builder");
  };

  // Keeps the recent-generations list in sync once a fresh stitch finishes,
  // so reopening it later (without a page reload) still shows the video
  // instead of trying to re-stitch.
  const handleFullVideoSaved = useCallback((url) => {
    setCurrentFullVideoUrl(url);
    setRecentGenerations((prev) =>
      prev.map((g) => (g.id === currentGenerationId ? { ...g, fullVideoUrl: url } : g))
    );
  }, [currentGenerationId]);

  const builderPanel = (
    <FootballerNationalitySwapBuilder
      onGenerate={handleGenerate}
      onReset={handleBackToDefault}
      phase={phase}
      viewingRecent={viewingRecentId !== null}
    />
  );

  const resultsPanel = (
    <FootballerNationalitySwapResults
      phase={phase}
      jobScenes={jobScenes}
      error={error}
      user={user}
      recentGenerations={recentGenerations}
      viewingRecent={viewingRecentId !== null}
      onOpenRecent={handleOpenRecent}
      onRequestAuth={showPaywall}
      onRetryScene={(index) => retryScene(index)}
      onReset={handleBackToDefault}
      generationId={currentGenerationId}
      fullVideoUrl={currentFullVideoUrl}
      onFullVideoSaved={handleFullVideoSaved}
    />
  );

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden lg:flex w-full h-full overflow-hidden p-3 gap-3 bg-[#0B0D0F]">
        <div className="flex flex-col w-[420px] xl:w-[460px] shrink-0 h-full">
          {builderPanel}
        </div>
        <div className="flex flex-1 min-w-0 h-full overflow-y-auto">
          {resultsPanel}
        </div>
      </div>

      {/* Mobile layout — workspace-scroll is the one scroller, tab strip is sticky */}
      <div className="lg:hidden flex flex-col w-full bg-[#0B0D0F] min-h-full">
        <div className="sticky top-0 z-20 px-3 pt-3 pb-3 border-b border-white/10 bg-[#0B0D0F]">
          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              onClick={() => {
                setMobilePanel("builder");
                document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
              }}
              className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === "builder" ? "bg-white text-black" : "text-white/60"}`}
            >
              Setup
            </button>
            <button
              onClick={() => {
                setMobilePanel("results");
                document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
              }}
              className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === "results" ? "bg-white text-black" : "text-white/60"}`}
            >
              Results
            </button>
          </div>
        </div>
        <div className="px-3 pb-3">
          {mobilePanel === "builder" ? builderPanel : resultsPanel}
        </div>
      </div>

      <FaceAsmrPaywall
        open={paywallOpen}
        onClose={() => {
          if (needsUpgrade) navigate("/workspace/home");
          else setPaywallOpen(false);
        }}
        isGuest={paywallGuest}
        dismissable={!needsUpgrade}
        toolName="Nationality Swap"
        previewSrc="/template/nationality-swap/nationality-swap-full.mp4"
      />
    </>
  );
}
