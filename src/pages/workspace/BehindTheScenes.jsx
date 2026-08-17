import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BehindTheScenesBuilder from "../../components/viral-tools/behind-the-scenes/BehindTheScenesBuilder";
import BehindTheScenesResults from "../../components/viral-tools/behind-the-scenes/BehindTheScenesResults";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import useBehindTheScenesJob from "../../components/viral-tools/behind-the-scenes/hooks/useBehindTheScenesJob";
import { listBehindTheScenesGenerations, nextEpisodeValues } from "../../components/viral-tools/behind-the-scenes/api/behindTheScenesApi";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import demoVideo from "../../assets/home/latest/videoo9.16-fast.mp4";

const MAX_RECENT = 8;
const PLAN_CACHE_KEY = "zyvo_behind_scenes_plan";
const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);
const DEFAULT_FORM_VALUES = {
  place: "",
  disaster: "wave",
  vantage: "tank-edge",
  qualityId: "bts-v2",
  episodeId: null,
};

function getCachedPlan(userId) {
  try {
    const fallbackKeys = [PLAN_CACHE_KEY, "zyvo_cartoon_drive_plan", "zyvo_clay_plan", "zyvo_micro_cam_plan", "zyvo_face_plan", "zyvo_fruit_plan"];
    let fallback = null;
    for (const key of fallbackKeys) {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      if (value.id !== userId || !value.code) continue;
      const code = String(value.code).toLowerCase();
      if (PAID_PLAN_CODES.has(code)) return code;
      fallback = code;
    }
    return fallback;
  } catch {
    return null;
  }
}

function setCachedPlan(userId, code) {
  try {
    if (!code) localStorage.removeItem(PLAN_CACHE_KEY);
    else localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ id: userId, code }));
  } catch {
    // Local storage can be unavailable in privacy-restricted browsers.
  }
}

function getCachedPaidPlan(userId) {
  const code = getCachedPlan(userId);
  return PAID_PLAN_CODES.has(code) ? code : null;
}

export default function BehindTheScenes() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mobilePanel, setMobilePanel] = useState("builder");

  const [planCode, setPlanCode] = useState(() => {
    if (authLoading) return null;
    if (!user) return "guest";
    return getCachedPlan(user.id) ?? "free";
  });

  // Auth / plan gate — initial state computed synchronously so the paywall
  // opens on first render, same guard every other viral tool uses.
  const [paywallOpen, setPaywallOpen] = useState(() => {
    if (authLoading) return false;
    if (user && !getCachedPaidPlan(user.id)) return true;
    if (!user) return true;                     // guest → open instantly
    return getCachedPlan(user.id) === "free";   // cached free → open instantly
  });

  const [paywallGuest, setPaywallGuest] = useState(() => {
    if (authLoading) return false;
    return !user;
  });

  const [recentGenerations, setRecentGenerations] = useState([]);
  const [viewingRecentId, setViewingRecentId] = useState(null);
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
  const { phase, result, error, generationId, start, retryVideo, reset, showGeneration } = useBehindTheScenesJob();

  useEffect(() => {
    if (authLoading) return;
    let mounted = true;
    if (!user) {
      setPlanCode("guest"); setPaywallGuest(true); setPaywallOpen(true);
      return;
    }
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data, error: dbErr }) => {
      if (!mounted) return;
      if (dbErr) {
        // DB failed — clear stale cache, don't penalize paid users
        setCachedPlan(user.id, null);
        setPlanCode(null);
        setPaywallOpen(false);
        return;
      }
      const code = String(data?.plan_code || "free").toLowerCase();
      setCachedPlan(user.id, code);
      setPlanCode(code);
      if (code === "free") {
        setPaywallGuest(false);
        setPaywallOpen(true);
      } else {
        setPaywallOpen(false);
      }
    }).catch(() => {
      if (!mounted) return;
      setCachedPlan(user.id, null);
      setPlanCode(null);
      setPaywallOpen(false);
    });
    return () => { mounted = false; };
  }, [authLoading, user]);

  // null = still loading — don't block paid users while the DB query is in flight
  const needsUpgrade = planCode === "free" || planCode === "guest";
  const showPaywall = () => {
    setPaywallGuest(planCode === "guest");
    setPaywallOpen(true);
  };

  const loadRecents = useCallback(async () => {
    if (!user) { setRecentGenerations([]); return; }
    try {
      setRecentGenerations(await listBehindTheScenesGenerations(MAX_RECENT));
    } catch (err) {
      console.error("[BehindTheScenes] recent creations failed", err);
      setRecentGenerations([]);
    }
  }, [user]);

  useEffect(() => { void loadRecents(); }, [loadRecents]);

  // The generation row is now created up front and updated as it progresses
  // (see useBehindTheScenesJob), so a run survives a reset or a closed tab
  // instead of only ever being saved on successful completion. Just keep
  // Recent Creations in sync with the DB at each meaningful transition.
  useEffect(() => {
    if (!user || viewingRecentId || !generationId) return;
    if (phase !== "image" && phase !== "done" && phase !== "error") return;
    void loadRecents();
  }, [phase, generationId, user, viewingRecentId, loadRecents]);

  // Success/error land while the user may have scrolled down watching
  // progress (no explicit tab switch happens then) — snap back to the top
  // whenever a generation finishes so the result/error is never off-screen.
  useEffect(() => {
    if (phase !== "done" && phase !== "error") return;
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  }, [phase]);

  const handleGenerate = (input) => {
    if (needsUpgrade) { showPaywall(); return; }
    setViewingRecentId(null);
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    start(input);
  };

  const handleOpenRecent = (generation) => {
    setViewingRecentId(generation.id);
    showGeneration(generation);
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleReset = () => {
    setViewingRecentId(null);
    reset();
    setMobilePanel("builder");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleBackFromRecent = () => {
    setViewingRecentId(null);
    reset();
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleNextEpisode = (mode) => {
    const nextValues = nextEpisodeValues(mode, result);
    setFormValues({ ...DEFAULT_FORM_VALUES, ...nextValues, qualityId: formValues.qualityId });
    reset();
    setMobilePanel("builder");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const viewedGeneration = recentGenerations.find((item) => item.id === viewingRecentId) ?? null;
  const episodeNumber = viewedGeneration
    ? recentGenerations.length - recentGenerations.findIndex((item) => item.id === viewedGeneration.id)
    : recentGenerations.length + 1;
  const visibleFormValues = viewedGeneration
    ? {
        place: viewedGeneration.place ?? "",
        disaster: viewedGeneration.disaster ?? "wave",
        vantage: viewedGeneration.vantage ?? "tank-edge",
        qualityId: viewedGeneration.qualityId ?? "bts-v2",
      }
    : formValues;

  const builder = (
    <BehindTheScenesBuilder
      onGenerate={handleGenerate}
      onReset={handleReset}
      onRequestUpgrade={showPaywall}
      phase={phase}
      planCode={planCode}
      values={visibleFormValues}
      onValuesChange={setFormValues}
      historyMode={Boolean(viewedGeneration)}
      onDone={handleBackFromRecent}
    />
  );

  const results = (
    <BehindTheScenesResults
      phase={phase}
      result={result}
      error={error}
      recentGenerations={recentGenerations}
      viewingRecent={viewingRecentId !== null}
      episodeNumber={episodeNumber}
      onOpenRecent={handleOpenRecent}
      onReset={handleReset}
      onBack={handleBackFromRecent}
      onNextEpisode={handleNextEpisode}
      onRetryVideo={retryVideo}
    />
  );

  return (
    <>
      <div className="hidden h-full w-full gap-3 overflow-hidden bg-[#0B0D0F] p-3 lg:flex">
        <div className="h-full w-[420px] shrink-0 xl:w-[460px]">{builder}</div>
        <div className="h-full min-w-0 flex-1 overflow-hidden">{results}</div>
      </div>

      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0B0D0F] lg:hidden">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0D0F] px-3 py-3">
          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {[["builder", "Generate"], ["results", "Result"]].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setMobilePanel(id); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
                className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === id ? "bg-white text-black" : "text-white/60"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[110px]">{mobilePanel === "builder" ? builder : results}</div>
      </div>

      <FaceAsmrPaywall
        open={paywallOpen}
        onClose={() => {
          if (needsUpgrade) navigate("/workspace/home");
          else setPaywallOpen(false);
        }}
        isGuest={paywallGuest}
        dismissable={!needsUpgrade}
        toolName="Behind the Scenes"
        previewSrc={demoVideo}
      />
    </>
  );
}
