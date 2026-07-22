import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ClayRescueBuilder from "../../components/viral-tools/clay-rescue/ClayRescueBuilder";
import ClayRescueResults from "../../components/viral-tools/clay-rescue/ClayRescueResults";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import useClayRescueJob from "../../components/viral-tools/clay-rescue/hooks/useClayRescueJob";
import {
  clearClayRescueGenerationFinalVideo,
  createClayRescueGeneration,
  listClayRescueGenerations,
  recoverClayRescueGenerationVideos,
  updateClayRescueGenerationScenes,
  updateClayRescueGenerationFinalVideo,
} from "../../components/viral-tools/clay-rescue/api/clayRescueApi";

const MAX_RECENT      = 8;
const PLAN_CACHE_KEY  = "zyvo_clay_plan";
const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);

function scenePersistenceSignature(scenes) {
  return JSON.stringify((scenes ?? []).map((scene, index) => ({
    index: scene.index ?? index,
    problem: scene.problem ?? "",
    fix: scene.fix ?? "",
    problemUrl: scene.problemUrl ?? null,
    fixUrl: scene.fixUrl ?? scene.imageUrl ?? null,
    videoUrl: scene.videoUrl ?? null,
  })));
}

function getCachedPlan(userId) {
  try {
    const fallbackKeys = [PLAN_CACHE_KEY, "zyvo_micro_cam_plan", "zyvo_face_plan", "zyvo_fruit_plan"];
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

export default function ClayRescue() {
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

  const { phase, scenes: jobScenes, error, start, reset, showGeneration, retryScene } = useClayRescueJob();

  const [recentGenerations, setRecentGenerations] = useState([]);
  const [viewingRecentId, setViewingRecentId]     = useState(null);
  const [activeGenerationId, setActiveGenerationId] = useState(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const persistedScenesRef = useRef("");
  const persistedFinalVideoRef = useRef("");
  const latestLengthRef    = useRef("15s");
  const latestWithSoundRef = useRef(true);

  const loadRecentGenerations = useCallback(async () => {
    if (!user) { setRecentGenerations([]); return; }
    try {
      const rows = await listClayRescueGenerations(MAX_RECENT);
      setRecentGenerations(rows);
    } catch (e) {
      console.error("[ClayRescue] load recent failed:", e.message);
      setRecentGenerations([]);
    }
  }, [user]);

  useEffect(() => { void loadRecentGenerations(); }, [loadRecentGenerations]);

  // Create the generation once, then update that same row whenever a retried
  // scene completes. This keeps successful retry video URLs across refreshes.
  useEffect(() => {
    if (!user || phase !== "done" || jobScenes.length === 0) return;
    const sceneSignature = scenePersistenceSignature(jobScenes);
    const persistenceKey = `${activeGenerationId ?? "new"}:${sceneSignature}`;
    if (persistedScenesRef.current === persistenceKey) return;
    persistedScenesRef.current = persistenceKey;

    let cancelled = false;
    (async () => {
      try {
        const saved = activeGenerationId
          ? await updateClayRescueGenerationScenes(activeGenerationId, jobScenes)
          : await createClayRescueGeneration({ lengthId: latestLengthRef.current, scenes: jobScenes });
        if (cancelled) return;
        persistedScenesRef.current = `${saved.id}:${sceneSignature}`;
        setActiveGenerationId(saved.id);
        setRecentGenerations((prev) => {
          const deduped = prev.filter((r) => r.id !== saved.id);
          return [saved, ...deduped].slice(0, MAX_RECENT);
        });
      } catch (e) {
        if (persistedScenesRef.current === persistenceKey) persistedScenesRef.current = "";
        console.error("[ClayRescue] save generation failed:", e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [activeGenerationId, phase, jobScenes, user]);

  // The editor upload and generation-row insert run independently. Persist as
  // soon as both the generation id and uploaded MP4 URL are available, no
  // matter which one finishes first.
  useEffect(() => {
    if (!activeGenerationId || !finalVideoUrl) return;
    const signature = `${activeGenerationId}:${finalVideoUrl}`;
    if (persistedFinalVideoRef.current === signature) return;

    let cancelled = false;
    updateClayRescueGenerationFinalVideo(activeGenerationId, finalVideoUrl)
      .then((updated) => {
        if (cancelled) return;
        persistedFinalVideoRef.current = signature;
        setRecentGenerations((prev) =>
          prev.map((generation) => generation.id === updated.id ? updated : generation)
        );
      })
      .catch((e) => console.error("[ClayRescue] save generation final video failed:", e.message));

    return () => { cancelled = true; };
  }, [activeGenerationId, finalVideoUrl]);

  const handleGenerate = ({ sceneInputs, selectedLength, aiMode, withSound }) => {
    if (needsUpgrade) { showPaywall(); return; }
    setViewingRecentId(null);
    setActiveGenerationId(null);
    setFinalVideoUrl(null);
    persistedFinalVideoRef.current = "";
    persistedScenesRef.current = "";
    latestLengthRef.current = selectedLength;
    latestWithSoundRef.current = withSound ?? true;
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    start({ sceneInputs, aiMode, withSound });
  };

  const handleOpenRecent = async (generation) => {
    let restoredGeneration = generation;
    try {
      restoredGeneration = await recoverClayRescueGenerationVideos(generation);
      if (restoredGeneration?.id === generation?.id && restoredGeneration !== generation) {
        setRecentGenerations((prev) =>
          prev.map((item) => item.id === restoredGeneration.id ? restoredGeneration : item)
        );
      }
    } catch (e) {
      console.error("[ClayRescue] recover completed retry videos failed:", e.message);
    }

    setViewingRecentId(restoredGeneration?.id ?? null);
    setActiveGenerationId(restoredGeneration?.id ?? null);
    setFinalVideoUrl(restoredGeneration?.finalVideoUrl ?? null);
    persistedFinalVideoRef.current = restoredGeneration?.id && restoredGeneration?.finalVideoUrl
      ? `${restoredGeneration.id}:${restoredGeneration.finalVideoUrl}`
      : "";
    persistedScenesRef.current = restoredGeneration?.id
      ? `${restoredGeneration.id}:${scenePersistenceSignature(restoredGeneration.scenes)}`
      : "";
    showGeneration(restoredGeneration);
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleBackToDefault = () => {
    setViewingRecentId(null);
    setActiveGenerationId(null);
    setFinalVideoUrl(null);
    persistedFinalVideoRef.current = "";
    persistedScenesRef.current = "";
    reset();
    setMobilePanel("builder");
  };

  const handleRetryScene = (index) => {
    // A changed scene invalidates the previously stitched MP4. The editor will
    // create and persist one replacement when the retried clip succeeds.
    setFinalVideoUrl(null);
    persistedFinalVideoRef.current = "";
    if (activeGenerationId) {
      clearClayRescueGenerationFinalVideo(activeGenerationId)
        .then((updated) => {
          if (!updated) return;
          setRecentGenerations((prev) =>
            prev.map((generation) => generation.id === updated.id ? updated : generation)
          );
        })
        .catch((e) => console.error("[ClayRescue] clear stale final video failed:", e.message));
    }
    retryScene(index, latestWithSoundRef.current);
  };

  const handleFinalVideoSaved = useCallback((url) => {
    setFinalVideoUrl(url);
  }, []);

  const builderPanel = (
    <ClayRescueBuilder
      onGenerate={handleGenerate}
      onReset={handleBackToDefault}
      phase={phase}
    />
  );

  const resultsPanel = (
    <ClayRescueResults
      phase={phase}
      jobScenes={jobScenes}
      error={error}
      user={user}
      recentGenerations={recentGenerations}
      viewingRecent={viewingRecentId !== null}
      finalVideoUrl={finalVideoUrl}
      onOpenRecent={handleOpenRecent}
      onRequestAuth={showPaywall}
      onRetryScene={handleRetryScene}
      onFinalVideoSaved={handleFinalVideoSaved}
      onReset={handleBackToDefault}
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
        toolName="Clay Rescue"
        previewSrc="/clayrescue/homevideo.mp4"
      />
    </>
  );
}
