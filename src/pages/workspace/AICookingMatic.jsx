import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import AICookingMaticBuilder from "../../components/viral-tools/ai-cooking-matic/AICookingMaticBuilder";
import AICookingMaticResults from "../../components/viral-tools/ai-cooking-matic/AICookingMaticResults";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import useAICookingMaticJob from "../../components/viral-tools/ai-cooking-matic/hooks/useAICookingMaticJob";
import {
  createCookingMaticGeneration,
  listCookingMaticGenerations,
} from "../../components/viral-tools/ai-cooking-matic/api/cookingMaticApi";

const MAX_RECENT      = 8;
const PLAN_CACHE_KEY  = "zyvo_cooking_plan";
const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);

function getCachedPlan(userId) {
  try {
    const fallbackKeys = [PLAN_CACHE_KEY, "zyvo_face_plan", "zyvo_fruit_plan", "zyvo_micro_cam_plan"];
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

export default function AICookingMatic() {
  const navigate = useNavigate();
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
        if (dbErr) { setCachedPlan(user.id, null); setPlanCode("free"); setPaywallOpen(true); return; }
        const code = (data?.plan_code || "free").toLowerCase();
        setCachedPlan(user.id, code);
        setPlanCode(code);
        if (code === "free") { setPaywallGuest(false); setPaywallOpen(true); }
        else setPaywallOpen(false);
      })
      .catch(() => { if (mounted) { setPlanCode("free"); setPaywallOpen(true); } });
    return () => { mounted = false; };
  }, [user, authLoading]);

  const needsUpgrade = authLoading || !PAID_PLAN_CODES.has(planCode);
  const showPaywall  = () => { setPaywallGuest(!user || planCode === "guest"); setPaywallOpen(true); };

  // ── Job ──
  const { phase, scenes, error, dishLabel, start, reset, showGeneration } = useAICookingMaticJob();

  // ── Recent generations ──
  const [recentGenerations, setRecentGenerations]   = useState([]);
  const savedSignatureRef = useRef(null);

  const loadRecentGenerations = useCallback(async () => {
    if (!user) { setRecentGenerations([]); return; }
    try { setRecentGenerations(await listCookingMaticGenerations(MAX_RECENT)); }
    catch (e) { console.error("[CookingMatic] load recent failed:", e.message); }
  }, [user]);

  useEffect(() => { void loadRecentGenerations(); }, [loadRecentGenerations]);

  // Auto-save when generation completes
  useEffect(() => {
    if (!user || phase !== "done" || scenes.length === 0) return;
    const signature = scenes.map((s) => `${s.index}:${s.imageUrl ?? ""}`).join("|");
    if (!signature || signature === savedSignatureRef.current) return;
    savedSignatureRef.current = signature;
    const vibeId = "dark-moody"; // captured from builder — stored in ref below

    let cancelled = false;
    (async () => {
      try {
        const saved = await createCookingMaticGeneration({
          dishName: dishLabel,
          vibeId: savedVibeRef.current,
          scenes,
        });
        if (cancelled || !saved) return;
        setRecentGenerations((prev) => {
          const deduped = prev.filter((r) => r.id !== saved.id);
          return [saved, ...deduped].slice(0, MAX_RECENT);
        });
      } catch (e) {
        console.error("[CookingMatic] save failed:", e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [phase, scenes, user, dishLabel]);

  const savedVibeRef = useRef("dark-moody");

  const handleGenerate = ({ dishName, vibeId }) => {
    if (needsUpgrade) { showPaywall(); return; }
    savedVibeRef.current = vibeId;
    savedSignatureRef.current = null;
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
    start({ dishName, vibeId });
  };

  const handleLoadRecent = (generation) => {
    showGeneration(generation);
    setMobilePanel("results");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  const builderPanel = (
    <AICookingMaticBuilder
      phase={phase}
      onGenerate={handleGenerate}
    />
  );

  const resultsPanel = (
    <AICookingMaticResults
      phase={phase}
      scenes={scenes}
      dishLabel={dishLabel}
      error={error}
      recentGenerations={recentGenerations}
      onLoadRecent={handleLoadRecent}
    />
  );

  return (
    <>
      {/* ── Desktop ── */}
      <div className="hidden lg:flex w-full h-full overflow-hidden p-3 gap-3 bg-[#0B0D0F]">
        <div className="flex flex-col w-[380px] xl:w-[420px] shrink-0 h-full">
          {builderPanel}
        </div>
        <div className="flex flex-1 min-w-0 h-full overflow-y-auto">
          {resultsPanel}
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="lg:hidden flex flex-col w-full bg-[#0B0D0F] min-h-full">
        <div className="sticky top-0 z-20 px-3 pt-3 pb-3 border-b border-white/10 bg-[#0B0D0F]">
          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              onClick={() => { setMobilePanel("builder"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
              className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === "builder" ? "bg-white text-black" : "text-white/60"}`}
            >
              Setup
            </button>
            <button
              onClick={() => { setMobilePanel("results"); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }); }}
              className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === "results" ? "bg-white text-black" : "text-white/60"}`}
            >
              Scenes
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
        toolName="AI Cooking Matic"
        previewSrc="/face/preview.mp4"
      />
    </>
  );
}
