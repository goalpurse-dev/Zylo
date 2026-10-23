import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AuthModal from "../../components/AuthModal";
import CutawayStudio from "../../components/viral-tools/cutaway-explainer/CutawayStudio";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import { accessFor, DEMO_VIDEO } from "../../components/viral-tools/cutaway-explainer/api/cutawayApi";
import { CUTAWAY_ENABLED, CUTAWAY_PATH } from "../../data/cutawayExplainer";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

// Local dev only (never in a preview or production build): ?as=guest|free|paid shows that state without an account.
const DEV_AS = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("as") : null;
const DEV_PLAN = { free: "free", paid: "starter" };

// Behind one build switch while the 3D version is built: on in local dev and Vercel previews, off in production
// (CUTAWAY_ENABLED in src/data/cutawayExplainer.js). Everyone can look, type a topic and watch the examples;
// generating needs an account and a paid plan (the cutaway-api server enforces the same rule: access.js).
export default function CutawayExplainer() {
  const { user, loading: authLoading } = useAuth();
  const [planCode, setPlanCode] = useState(null);
  const [gate, setGate] = useState(null); // "signup" | "upgrade" | null

  useEffect(() => {
    if (authLoading || !user || DEV_AS) return undefined;
    let mounted = true;
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data, error: dbErr }) => {
      if (!mounted) return;
      if (dbErr) { setPlanCode(null); return; } // don't block paid users on a failed read; the server checks again
      setPlanCode(String(data?.plan_code || "free").toLowerCase());
    });
    return () => { mounted = false; };
  }, [authLoading, user]);

  if (!CUTAWAY_ENABLED) return <Navigate to="/" replace />;

  const signedIn = DEV_AS ? DEV_AS !== "guest" : Boolean(user);
  const plan = DEV_AS ? DEV_PLAN[DEV_AS] ?? null : planCode;
  const access = authLoading && !DEV_AS ? "unknown" : accessFor({ signedIn, planCode: plan });

  return (
    <>
      <CutawayStudio
        planCode={plan}
        access={access}
        onSignUp={() => setGate("signup")}
        onUpgrade={() => setGate("upgrade")}
        onBeforeGenerate={() => {
          if (access === "guest") { setGate("signup"); return false; }
          if (access === "free") { setGate("upgrade"); return false; }
          return true;
        }}
      />
      {/* A signed-out visitor pressed Generate: the app's own sign-up popup, back here afterwards. */}
      {gate === "signup" && (
        <AuthModal
          mode="signup"
          title="Sign up to generate"
          subtitle="Free to join. Make your own 3D explainer videos."
          returnTo={CUTAWAY_PATH}
          onClose={() => setGate(null)}
        />
      )}
      {/* A free plan pressed Generate: the app's existing upgrade popup, in this template's words. */}
      <FaceAsmrPaywall
        open={gate === "upgrade"}
        onClose={() => setGate(null)}
        isGuest={false}
        toolName="Cutaway Explainer"
        previewSrc={DEMO_VIDEO}
        title="Cutaway Explainer is for paid plans"
        subtitle="Upgrade to make your own 3D explainer videos."
        planLines={{ starter: "Cutaway Explainer, with the Zyvo end card", pro: "Cutaway Explainer, end card can be removed", generative: "Cutaway Explainer, end card can be removed" }}
        dropFeatures={["Watermark-free exports"]}
      />
    </>
  );
}
