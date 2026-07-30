import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import FaceAsmrBuilder from "../../components/viral-tools/face-asmr/FaceAsmrBuilder";
import FaceAsmrResults from "../../components/viral-tools/face-asmr/FaceAsmrResults";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import useFaceAsmrJob from "../../components/viral-tools/face-asmr/hooks/useFaceAsmrJob";
import {
  createFaceAsmrGeneration,
  listFaceAsmrGenerations,
} from "../../components/viral-tools/face-asmr/api/faceAsmrApi";

const SCENE_COUNTS  = { "15s": 3, "30s": 6, "45s": 9 };
const EMPTY_SCENE   = () => ({ description: "", imageFile: null, imagePreview: null });
const MAX_RECENT    = 8;
const LEGACY_STORAGE_KEY = "zyvo_face_asmr_recent";
const LEGACY_IMPORT_KEY_PREFIX = "zyvo_face_asmr_recent_imported";
const PLAN_CACHE_KEY = "zyvo_face_plan";
const PLAN_FALLBACK_CACHE_KEYS = [PLAN_CACHE_KEY, "zyvo_fruit_plan"];
const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);

function getCachedPlan(userId) {
  try {
    let fallback = null;
    for (const key of PLAN_FALLBACK_CACHE_KEYS) {
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

export default function FaceAsmr() {
  const navigate = useNavigate();

  const [mobilePanel, setMobilePanel]       = useState("builder");
  const [selectedLength, setSelectedLength] = useState("30s");
  const [scenes, setScenes]                 = useState(Array.from({ length: 9 }, EMPTY_SCENE));
  const [recentGenerations, setRecentGenerations] = useState([]);
  const [viewingRecentId, setViewingRecentId] = useState(null);
  const savedGenerationRef = useRef(null);
  const latestRunMetaRef = useRef({ lengthId: selectedLength, backgroundId: null });

  // Auth / plan gate — initial state computed synchronously so paywall opens on first render
  const { user, loading: authLoading } = useAuth();

  const [planCode, setPlanCode] = useState(() => {
    if (authLoading) return null;
    if (!user) return "guest";
    return getCachedPlan(user.id) ?? "free";
  });

  const [paywallOpen, setPaywallOpen] = useState(() => {
    if (authLoading) return false;
    if (user && !getCachedPaidPlan(user.id)) return true;
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
      .then(({ data, error: dbErr }) => {
        if (!mounted) return;
        if (dbErr) {
          // DB failed — clear stale cache, don't penalize paid users
          setCachedPlan(user.id, null);
          setPlanCode(null);
          setPaywallOpen(false);
          return;
        }
        const code = (data?.plan_code || "free").toLowerCase();
        setCachedPlan(user.id, code);
        setPlanCode(code);
        if (code === "free") {
          setPaywallGuest(false);
          setPaywallOpen(true);
        } else {
          setPaywallOpen(false);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setCachedPlan(user.id, null);
        setPlanCode(null);
        setPaywallOpen(false);
      });

    return () => { mounted = false; };
  }, [user, authLoading]);

  // null = still loading — don't block paid users while the DB query is in flight
  const needsUpgrade = planCode === "free" || planCode === "guest";

  const showPaywall = () => {
    setPaywallGuest(planCode === "guest");
    setPaywallOpen(true);
  };

  const { phase, scenes: jobScenes, error, start, reset, showGeneration } = useFaceAsmrJob();

  const loadRecentGenerations = useCallback(async () => {
    if (!user) {
      setRecentGenerations([]);
      return;
    }
    try {
      const rows = await listFaceAsmrGenerations(MAX_RECENT);
      const importKey = `${LEGACY_IMPORT_KEY_PREFIX}:${user.id}`;
      const legacyRows = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
      const shouldImportLegacy =
        !localStorage.getItem(importKey) &&
        Array.isArray(legacyRows) &&
        legacyRows.length > 0;

      if (!shouldImportLegacy) {
        setRecentGenerations(rows);
        return;
      }

      const signatures = new Set(
        rows.map((gen) =>
          (gen.scenes || [])
            .map((s) => `${s.index}:${s.imageUrl || ""}:${s.videoUrl || ""}`)
            .join("|")
        )
      );

      const imported = [];
      for (const gen of legacyRows.slice(0, MAX_RECENT)) {
        const legacyScenes = (gen?.scenes || []).filter((s) => s.imageUrl || s.videoUrl);
        const signature = legacyScenes
          .map((s) => `${s.index}:${s.imageUrl || ""}:${s.videoUrl || ""}`)
          .join("|");
        if (!signature || signatures.has(signature)) continue;
        signatures.add(signature);
        try {
          const saved = await createFaceAsmrGeneration({
            scenes: legacyScenes,
            lengthId: legacyScenes.length <= 3 ? "15s" : legacyScenes.length <= 6 ? "30s" : "45s",
            backgroundId: null,
          });
          imported.push(saved);
        } catch (e) {
          console.error("[FaceAsmr] legacy recent import failed:", e.message);
        }
      }

      localStorage.setItem(importKey, "1");
      setRecentGenerations([...imported, ...rows].slice(0, MAX_RECENT));
    } catch (e) {
      console.error("[FaceAsmr] load recent generations failed:", e.message);
      setRecentGenerations([]);
    }
  }, [user]);

  useEffect(() => { void loadRecentGenerations(); }, [loadRecentGenerations]);

  // Save completed generation to the signed-in user's Supabase history.
  useEffect(() => {
    if (!user || phase !== "done" || jobScenes.length === 0 || viewingRecentId !== null) return;

    const signature = jobScenes
      .map((s) => `${s.index}:${s.imageUrl || ""}:${s.videoUrl || ""}`)
      .join("|");
    if (!signature || signature === savedGenerationRef.current) return;
    savedGenerationRef.current = signature;

    let cancelled = false;
    (async () => {
      try {
        const saved = await createFaceAsmrGeneration({
          scenes: jobScenes,
          lengthId: latestRunMetaRef.current.lengthId,
          backgroundId: latestRunMetaRef.current.backgroundId,
        });
        if (cancelled) return;
        setRecentGenerations((prev) => {
          const deduped = prev.filter((row) => row.id !== saved.id);
          return [saved, ...deduped].slice(0, MAX_RECENT);
        });
      } catch (e) {
        console.error("[FaceAsmr] save generation failed:", e.message);
      }
    })();

    return () => { cancelled = true; };
  }, [phase, jobScenes, viewingRecentId, user]);

  const sceneCount = SCENE_COUNTS[selectedLength] ?? 6;

  const handleGenerate = (params) => {
    if (needsUpgrade) { showPaywall(); return; }

    setViewingRecentId(null);
    savedGenerationRef.current = null;
    latestRunMetaRef.current = { lengthId: selectedLength, backgroundId: params.background };
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    start({ scenes: params.scenes, backgroundId: params.background, videoModel: params.videoModel });
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
      planCode={planCode}
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
        <div
          className="flex lg:hidden flex-col w-full"
          style={{ height: "calc(100% - 84px - env(safe-area-inset-bottom, 0px))" }}
        >
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
