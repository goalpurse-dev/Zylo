import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TwoAmGenerator from "../../components/viral-tools/two-am/TwoAmGenerator";
import TwoAmResults from "../../components/viral-tools/two-am/TwoAmResults";
import TwoAmPaywall from "../../components/viral-tools/two-am/TwoAmPaywall";
import useTwoAmGeneration from "../../components/viral-tools/two-am/hooks/useTwoAmGeneration";
import { listTwoAmGenerations } from "../../components/viral-tools/two-am/api/twoAmApi";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

const RECENT_CACHE_PREFIX = "zyvo:two-am:recent:v1:";
const RECENT_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const PLAN_CACHE_KEY = "zyvo_two_am_plan";
const PLAN_FALLBACK_CACHE_KEYS = [PLAN_CACHE_KEY, "zyvo_face_plan", "zyvo_fruit_plan", "zyvo_cooking_plan", "zyvo_micro_cam_plan"];
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
  } catch { /* storage may be unavailable */ }
}
function getCachedPaidPlan(userId) {
  const code = getCachedPlan(userId);
  return PAID_PLAN_CODES.has(code) ? code : null;
}

function readRecentCache(userId) {
  if (!userId || typeof window === "undefined") return [];
  try {
    const cached = JSON.parse(window.localStorage.getItem(`${RECENT_CACHE_PREFIX}${userId}`) || "null");
    if (!cached || Date.now() - cached.savedAt > RECENT_CACHE_MAX_AGE || !Array.isArray(cached.rows)) return [];
    return cached.rows;
  } catch {
    return [];
  }
}

function writeRecentCache(userId, rows) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${RECENT_CACHE_PREFIX}${userId}`,
      JSON.stringify({ savedAt: Date.now(), rows }),
    );
  } catch {
    // Recent creations still work when storage is unavailable or full.
  }
}

export default function TwoAm() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mobilePanel, setMobilePanel] = useState("create");
  const [recentGenerations, setRecentGenerations] = useState(() => readRecentCache(user?.id));
  const [generatorResetKey, setGeneratorResetKey] = useState(0);
  const { phase, plannerStage, scenes, generation, error, start, regenerateScene, showGeneration, reset } = useTwoAmGeneration();
  const lockDesktopPreview = phase === "idle" && scenes.length === 0;

  // Auth / plan gate — initial state computed synchronously so paywall opens on first render
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
      setPlanCode("guest"); setPaywallGuest(true); setPaywallOpen(true);
      return;
    }

    supabase.from("profiles").select("plan_code").eq("id", user.id).single()
      .then(({ data, error: dbErr }) => {
        if (!mounted) return;
        if (dbErr) {
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

  const loadRecent = useCallback(async () => {
    if (!user) { setRecentGenerations([]); return; }
    const cachedRows = readRecentCache(user.id);
    if (cachedRows.length) setRecentGenerations(cachedRows);
    try {
      const rows = await listTwoAmGenerations(8, user.id);
      setRecentGenerations(rows);
      writeRecentCache(user.id, rows);
    }
    catch (caught) { console.error("[TwoAm] recent generations failed", caught); }
  }, [user]);

  useEffect(() => { void loadRecent(); }, [loadRecent]);
  useEffect(() => { if (phase === "done") void loadRecent(); }, [phase, loadRecent]);

  const requestAuth = () => {
    if (authLoading) return true;
    if (!user) { showPaywall(); return true; }
    if (needsUpgrade) { showPaywall(); return true; }
    return false;
  };

  const handleGenerate = (input) => {
    if (requestAuth()) return;
    start(input);
    setMobilePanel("recent");
    requestAnimationFrame(() => document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" }));
  };

  const handleAnotherNight = () => {
    reset();
    setGeneratorResetKey((key) => key + 1);
    setMobilePanel("create");
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <>
      {/* Desktop keeps the familiar side-by-side template workspace. */}
      <main className="hidden w-full gap-3 bg-[#0B0D0F] p-3 lg:flex lg:h-full lg:flex-row lg:overflow-hidden">
        <div className="h-full w-[420px] shrink-0 xl:w-[460px]">
          <TwoAmGenerator key={`desktop-${generatorResetKey}`} phase={phase} onGenerate={handleGenerate} onRequestAuth={requestAuth} />
        </div>
        <div
          id="two-am-results"
          className={`h-full min-w-0 flex-1 ${lockDesktopPreview ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          <TwoAmResults
            phase={phase}
            plannerStage={plannerStage}
            scenes={scenes}
            generation={generation}
            error={error}
            recentGenerations={recentGenerations}
            onOpenRecent={showGeneration}
            onRegenerate={regenerateScene}
            onAnotherNight={handleAnotherNight}
          />
        </div>
      </main>

      {/* Mobile follows the other viral templates: one panel at a time. */}
      <main className="flex min-h-full w-full flex-col bg-[#0B0D0F] lg:hidden">
        <div className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0B0D0F]/95 px-3 py-3 backdrop-blur-xl">
          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => {
                setMobilePanel("create");
                document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
              }}
              className={`rounded-full px-3 py-2 text-[13px] font-bold transition ${mobilePanel === "create" ? "bg-lime-300 text-[#081008] shadow-[0_0_18px_rgba(190,242,100,.12)]" : "text-white/55"}`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setMobilePanel("recent");
                document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
              }}
              className={`rounded-full px-3 py-2 text-[13px] font-bold transition ${mobilePanel === "recent" ? "bg-lime-300 text-[#081008] shadow-[0_0_18px_rgba(190,242,100,.12)]" : "text-white/55"}`}
            >
              Recent{recentGenerations.length ? ` (${recentGenerations.length})` : ""}
            </button>
          </div>
        </div>

        <div className="px-3 pb-3">
          {mobilePanel === "create" ? (
            <TwoAmGenerator key={`mobile-${generatorResetKey}`} phase={phase} onGenerate={handleGenerate} onRequestAuth={requestAuth} />
          ) : (
            <TwoAmResults
              phase={phase}
              plannerStage={plannerStage}
              scenes={scenes}
              generation={generation}
              error={error}
              recentGenerations={recentGenerations}
              onOpenRecent={showGeneration}
              onRegenerate={regenerateScene}
              onAnotherNight={handleAnotherNight}
              recentOnly
            />
          )}
        </div>
      </main>
      <TwoAmPaywall
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
