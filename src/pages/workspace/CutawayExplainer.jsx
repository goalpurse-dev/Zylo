import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import CutawayBuilder from "../../components/viral-tools/cutaway-explainer/CutawayBuilder";
import CutawayResults from "../../components/viral-tools/cutaway-explainer/CutawayResults";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import useCutawayRun from "../../components/viral-tools/cutaway-explainer/hooks/useCutawayRun";
import useToolPriceQuotes from "../../hooks/useToolPriceQuotes";
import { DEFAULT_LENGTH, fetchUsedTopics, listRuns, PRICE_ITEMS, WORKING_STEPS } from "../../components/viral-tools/cutaway-explainer/api/cutawayApi";
import { CUTAWAY_FLAG } from "../../data/cutawayExplainer";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlag } from "../../lib/featureFlags";
import { supabase } from "../../lib/supabaseClient";

const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);
const needsUpgradeFor = (code) => code === "free" || code === "guest" || code == null;

function phaseOf(run) {
  if (!run) return "idle";
  if (run.step === "done") return "done";
  if (run.step === "failed") return "error";
  if (run.step === "approval") return "review";
  return WORKING_STEPS.has(run.step) ? "working" : "idle";
}

export default function CutawayExplainer() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const flag = useFeatureFlag(CUTAWAY_FLAG, user?.id ?? null);
  const [mobilePanel, setMobilePanel] = useState("builder");
  const [planCode, setPlanCode] = useState(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [values, setValues] = useState({ topic: "", lengthSec: DEFAULT_LENGTH, soundEffects: true });
  const [usedTopics, setUsedTopics] = useState([]);
  const [recent, setRecent] = useState([]);
  const [viewingRecent, setViewingRecent] = useState(false);
  const { run, error, busy, start, regenerate, approve, open, reset } = useCutawayRun();
  const quotes = useToolPriceQuotes(PRICE_ITEMS);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) { setPlanCode("guest"); setPaywallOpen(true); return undefined; }
    let mounted = true;
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data, error: dbErr }) => {
      if (!mounted) return;
      if (dbErr) { setPlanCode(null); return; } // don't block paid users on a failed read; the server checks again
      const code = String(data?.plan_code || "free").toLowerCase();
      setPlanCode(code);
      setPaywallOpen(!PAID_PLAN_CODES.has(code));
    });
    return () => { mounted = false; };
  }, [authLoading, user]);

  const loadRecent = useCallback(async () => {
    if (!user) { setRecent([]); return; }
    try { setRecent(await listRuns(8)); } catch { setRecent([]); }
  }, [user]);

  useEffect(() => { void loadRecent(); }, [loadRecent]);
  useEffect(() => { if (user && !needsUpgradeFor(planCode)) fetchUsedTopics().then(setUsedTopics); }, [user, planCode]);
  useEffect(() => { if (run?.step === "approval" || run?.step === "done" || run?.step === "failed") void loadRecent(); }, [run?.step, loadRecent]);

  if (!authLoading && !flag.loading && !flag.enabled) return <Navigate to="/" replace />;

  const needsUpgrade = planCode === "free" || planCode === "guest";
  const phase = phaseOf(run);
  const scrollTop = () => document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });

  const handleGenerate = (input) => {
    if (needsUpgrade) { setPaywallOpen(true); return; }
    setViewingRecent(false);
    setMobilePanel("results");
    scrollTop();
    void start(input.topic, input.lengthSec, input.soundEffects);
  };
  const handleOpen = (runId) => { setViewingRecent(true); setMobilePanel("results"); scrollTop(); void open(runId); };
  const handleReset = () => { setViewingRecent(false); reset(); setMobilePanel("builder"); };
  const handleBack = () => { setViewingRecent(false); reset(); setMobilePanel("results"); };

  const builder = (
    <CutawayBuilder
      values={viewingRecent && run ? { topic: run.topic, lengthSec: run.lengthSec, soundEffects: run.soundEffects } : values}
      usedTopics={usedTopics}
      onValuesChange={setValues}
      onGenerate={handleGenerate}
      onReset={handleReset}
      busy={busy}
      phase={phase}
      historyMode={viewingRecent}
      onDone={handleBack}
    />
  );
  const results = (
    <CutawayResults
      run={run}
      error={error}
      busy={busy}
      recent={recent}
      prices={quotes.prices}
      onRegenerate={(i) => void regenerate(i)}
      onApprove={() => void approve()}
      onOpen={handleOpen}
      onReset={handleReset}
      viewingRecent={viewingRecent}
      onBack={handleBack}
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
              <button key={id} type="button" onClick={() => { setMobilePanel(id); scrollTop(); }} className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${mobilePanel === id ? "bg-white text-black" : "text-white/60"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[110px]">{mobilePanel === "builder" ? builder : results}</div>
      </div>

      <FaceAsmrPaywall
        open={paywallOpen}
        onClose={() => { if (needsUpgrade) navigate("/"); else setPaywallOpen(false); }}
        isGuest={planCode === "guest"}
        dismissable={!needsUpgrade}
        toolName="Cutaway Explainer"
      />
    </>
  );
}
