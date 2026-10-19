import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import CutawayStudio from "../../components/viral-tools/cutaway-explainer/CutawayStudio";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import { CUTAWAY_FLAG } from "../../data/cutawayExplainer";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlag } from "../../lib/featureFlags";
import { supabase } from "../../lib/supabaseClient";

const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);

// Owner-only while the 3D version is built (user_feature_flags {"cutaway_explainer": true}).
export default function CutawayExplainer() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const flag = useFeatureFlag(CUTAWAY_FLAG, user?.id ?? null);
  const [planCode, setPlanCode] = useState(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

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

  if (!authLoading && !flag.loading && !flag.enabled) return <Navigate to="/" replace />;

  const needsUpgrade = planCode === "free" || planCode === "guest";

  return (
    <>
      <CutawayStudio onBeforeGenerate={() => { if (needsUpgrade) { setPaywallOpen(true); return false; } return true; }} />
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
