import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FaceAsmrBuilder from "../../components/viral-tools/face-asmr/FaceAsmrBuilder";
import FaceAsmrResults from "../../components/viral-tools/face-asmr/FaceAsmrResults";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import useFaceAsmrJob from "../../components/viral-tools/face-asmr/hooks/useFaceAsmrJob";

const SCENE_COUNTS  = { "15s": 3, "30s": 6, "45s": 9 };
const EMPTY_SCENE   = () => ({ description: "", imageFile: null, imagePreview: null });
const STORAGE_KEY   = "zyvo_face_asmr_recent";
const MAX_RECENT    = 8;
const PLAN_CACHE_KEY = "zyvo_face_plan";

function getCachedPlan(userId) {
  try {
    const d = JSON.parse(localStorage.getItem(PLAN_CACHE_KEY) || "{}");
    return d.id === userId ? d.code : null;
  } catch { return null; }
}
function setCachedPlan(userId, code) {
  try { localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ id: userId, code })); } catch {}
}

function saveGeneration(jobScenes) {
  try {
    const entry = {
      id:        Date.now(),
      createdAt: new Date().toISOString(),
      scenes:    jobScenes
        .filter((s) => s.imageUrl || s.videoUrl)
        .map((s) => ({ index: s.index, imageUrl: s.imageUrl, videoUrl: s.videoUrl })),
    };
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...prev].slice(0, MAX_RECENT)));
  } catch {}
}

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

export default function FaceAsmr() {
  const navigate = useNavigate();

  const [mobilePanel, setMobilePanel]       = useState("builder");
  const [selectedLength, setSelectedLength] = useState("30s");
  const [scenes, setScenes]                 = useState(Array.from({ length: 9 }, EMPTY_SCENE));
  const [recentGenerations, setRecentGenerations] = useState(loadRecent);
  const [viewingRecentId, setViewingRecentId] = useState(null);

  // Auth / plan gate — initial state computed synchronously so paywall opens on first render
  const { user, loading: authLoading } = useAuth();

  const [planCode, setPlanCode] = useState(() => {
    if (authLoading) return null;
    if (!user) return "guest";
    return getCachedPlan(user.id) ?? null;
  });

  const [paywallOpen, setPaywallOpen] = useState(() => {
    if (authLoading) return false;
    if (!user) return true;                       // guest → open instantly
    return getCachedPlan(user.id) === "free";     // cached free → open instantly
  });

  const [paywallGuest, setPaywallGuest] = useState(() => {
    if (authLoading) return false;
    return !user;
  });

  useEffect(() => {
    if (authLoading) return;
    let mounted = true;

    if (!user) {
      // handles case where authLoading was true on mount
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
          // Close if cached plan was stale (e.g. user just upgraded)
          setPaywallOpen(false);
        }
      });

    return () => { mounted = false; };
  }, [user, authLoading]);

  const needsUpgrade = planCode === "free" || planCode === "guest" || planCode === null;

  const showPaywall = () => {
    setPaywallGuest(planCode === "guest");
    setPaywallOpen(true);
  };

  const { phase, scenes: jobScenes, error, start, reset, showGeneration } = useFaceAsmrJob();

  // Save completed generation to localStorage
  useEffect(() => {
    if (phase === "done" && jobScenes.length > 0 && viewingRecentId === null) {
      saveGeneration(jobScenes);
      setRecentGenerations(loadRecent());
    }
  }, [phase, jobScenes, viewingRecentId]);

  const sceneCount = SCENE_COUNTS[selectedLength] ?? 6;

  const handleGenerate = (params) => {
    if (needsUpgrade) { showPaywall(); return; }

    setViewingRecentId(null);
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    start({ scenes: params.scenes, backgroundId: params.background });
  };

  const handleBuilderBack = () => {
    setViewingRecentId(null);
    reset();
  };

  const handleOpenRecent = (generation) => {
    const count = generation?.scenes?.length ?? 0;
    setSelectedLength(count <= 3 ? "15s" : count <= 6 ? "30s" : "45s");
    setViewingRecentId(generation?.id ?? null);
    showGeneration(generation);
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleBackToDefault = () => {
    setViewingRecentId(null);
    reset();
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const builderPanel = (
    <FaceAsmrBuilder
      onGenerate={handleGenerate}
      onBack={handleBuilderBack}
      scenes={scenes}
      setScenes={setScenes}
      selectedLength={selectedLength}
      setSelectedLength={setSelectedLength}
      forcedStep={viewingRecentId !== null ? 1 : 0}
      savedDone={viewingRecentId !== null}
      phase={phase}
    />
  );

  const resultsPanel = (
    <FaceAsmrResults
      phase={phase}
      jobScenes={jobScenes}
      sceneCount={sceneCount}
      error={error}
      user={user}
      recentGenerations={recentGenerations}
      viewingRecent={viewingRecentId !== null}
      onOpenRecent={handleOpenRecent}
      onRequestAuth={showPaywall}
      onReset={handleBackToDefault}
    />
  );

  return (
    <>
      <div className="flex w-full h-full overflow-hidden p-3 gap-3 bg-[#0B0D0F]">

        {/* ── LEFT: builder (desktop) ── */}
        <div className="hidden lg:flex flex-col w-[460px] xl:w-[500px] shrink-0 h-full">
          {builderPanel}
        </div>

        {/* ── RIGHT: results (desktop) ── */}
        <div className="hidden lg:flex flex-1 min-w-0 h-full overflow-y-auto">
          {resultsPanel}
        </div>

        {/* ── MOBILE ── */}
        <div className="flex lg:hidden flex-col w-full h-[calc(100%-70px)]">
          <div className="shrink-0 mb-3 border-b border-white/10 bg-[#0B0D0F] pb-3">
            <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
              <button
                onClick={() => setMobilePanel("builder")}
                className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === "builder" ? "bg-white text-black" : "text-white/60"}`}
              >
                Setup
              </button>
              <button
                onClick={() => setMobilePanel("results")}
                className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === "results" ? "bg-white text-black" : "text-white/60"}`}
              >
                Results
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {mobilePanel === "builder" ? builderPanel : (
              <div className="h-full overflow-y-auto">{resultsPanel}</div>
            )}
          </div>
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
      />
    </>
  );
}
