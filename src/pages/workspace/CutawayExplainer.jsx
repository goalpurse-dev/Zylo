import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import CutawayStudio from "../../components/viral-tools/cutaway-explainer/CutawayStudio";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import { CUTAWAY_ENABLED } from "../../data/cutawayExplainer";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

const PAID_PLAN_CODES = new Set(["starter", "pro", "generative", "affiliate"]);

// Behind one build switch while the 3D version is built: on in local dev and Vercel previews, off in production
// (CUTAWAY_ENABLED in src/data/cutawayExplainer.js).
export default function CutawayExplainer() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
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

  if (!CUTAWAY_ENABLED) return <Navigate to="/" replace />;

  const needsUpgrade = planCode === "free" || planCode === "guest";

  return (
    <>
      <CutawayStudio planCode={planCode} onBeforeGenerate={() => { if (needsUpgrade) { setPaywallOpen(true); return false; } return true; }} />
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
