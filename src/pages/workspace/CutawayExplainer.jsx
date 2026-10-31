import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AuthModal from "../../components/AuthModal";
import CutawayStudio from "../../components/viral-tools/cutaway-explainer/CutawayStudio";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import NoCreditsModal from "../../components/viral-tools/shared/NoCreditsModal";
import { accessFor, DEMO_VIDEO } from "../../components/viral-tools/cutaway-explainer/api/cutawayApi";
import useCutawayAccess from "../../components/viral-tools/cutaway-explainer/api/cutawayAccess";
import { LOCAL_GENERATION } from "../../components/viral-tools/cutaway-explainer/hooks/useCutawayRun";
import * as Mock from "../../components/viral-tools/cutaway-explainer/dev/cutawayMock";
import { CUTAWAY_ENABLED, CUTAWAY_PATH } from "../../data/cutawayExplainer";
import { useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { supabase } from "../../lib/supabaseClient";

// Local dev only (never in a preview or production build: import.meta.env.DEV is false there, so every use below
// folds away and dev/cutawayMock.js is dropped from the bundle). See dev/cutawayMock.js for the values.
//   ?as=guest|free|starter|pro|generative|owner   who is looking, without an account
//   ?mock=<state>                                  open one state (quote, generating-render, done, failed, ...)
const DEV_AS = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("as") : null;
const DEV_MOCK = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("mock") : null;
const DEV_BALANCE = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("balance") : null;
const DEV_PLAN = { free: "free", paid: "starter", starter: "starter", pro: "pro", generative: "generative", owner: "pro" };
const DEV = import.meta.env.DEV && Boolean(DEV_AS || DEV_MOCK);

/**
 * Who sees the template: everyone when the build switch is on (CUTAWAY_ENABLED: on unless
 * VITE_CUTAWAY_ENABLED=false), and otherwise only a signed-in tester (the cutaway-api `access` action, asked once per
 * session). While that answer is on its way the page waits quietly instead of redirecting.
 */
export default function CutawayExplainer() {
  const owner = useCutawayAccess({ skip: DEV });
  if (owner.tester) return <CutawayPage />;
  if (!CUTAWAY_ENABLED && owner.checking) return <PageWaiting />;
  if (!CUTAWAY_ENABLED) return <Navigate to="/" replace />;
  return <CutawayPage />;
}

function PageWaiting() {
  return (
    <div className="grid h-full w-full place-items-center bg-[#0B0D0F]" aria-busy="true" aria-label="Loading">
      <span className="cw-breath h-10 w-10 rounded-full bg-[radial-gradient(circle,rgba(74,222,128,.35),transparent_70%)]" />
    </div>
  );
}

// Everyone can look, type a topic and watch the examples; generating needs an account and a paid plan (the
// cutaway-api server enforces the same rule: access.js). Each state opens the app's own flow:
//   signed out  -> "Sign up to generate" -> the app's sign-up popup (AuthModal), back here afterwards (returnTo)
//   free plan   -> Generate -> the app's upgrade popup (FaceAsmrPaywall: plans + Stripe checkout)
//   too few credits -> the app's add-credits popup (NoCreditsModal), with the credits this video needs
function CutawayPage() {
  const { user, loading: authLoading } = useAuth();
  const [planCode, setPlanCode] = useState(null);
  const [gate, setGate] = useState(() => (import.meta.env.DEV && (DEV_MOCK === "signup" || DEV_MOCK === "upgrade") ? DEV_MOCK : null)); // "signup" | "upgrade" | null
  const [noCredits, setNoCredits] = useState(() => (import.meta.env.DEV && DEV_MOCK === "credits" ? { needed: Mock.mockRun("done").credits } : null)); // { needed } | null
  const realBalance = useProfileCredits();

  useEffect(() => {
    if (authLoading || !user || DEV) return undefined;
    let mounted = true;
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data, error: dbErr }) => {
      if (!mounted) return;
      if (dbErr) { setPlanCode(null); return; } // don't block paid users on a failed read; the server checks again
      setPlanCode(String(data?.plan_code || "free").toLowerCase());
    });
    return () => { mounted = false; };
  }, [authLoading, user]);

  const devAs = DEV ? DEV_AS ?? "starter" : null;
  const signedIn = devAs ? devAs !== "guest" : Boolean(user);
  const plan = devAs ? DEV_PLAN[devAs] ?? null : planCode;
  const access = authLoading && !devAs ? "unknown" : accessFor({ signedIn, planCode: plan });
  const balance = import.meta.env.DEV && DEV ? Mock.mockBalance(DEV_MOCK, DEV_BALANCE) : realBalance;
  const mode = LOCAL_GENERATION ? "local" : DEV ? "mock" : "server";
  const mockOpts = { plan, owner: devAs === "owner" };
  const mock = import.meta.env.DEV && DEV ? {
    run: Mock.mockRun(DEV_MOCK, mockOpts),
    recent: Mock.mockRecent(DEV_MOCK, mockOpts),
    values: Mock.mockValues(DEV_MOCK),
    notice: Mock.mockNotice(DEV_MOCK),
    customOpen: Mock.mockCustomOpen(DEV_MOCK),
  } : null;

  return (
    <>
      <CutawayStudio
        planCode={plan}
        access={access}
        balance={balance}
        mode={mode}
        mock={mock}
        listOnMount={mode === "server" && signedIn && (access === "paid" || access === "unknown")}
        onSignUp={() => setGate("signup")}
        onUpgrade={() => setGate("upgrade")}
        onNoCredits={(needed) => setNoCredits({ needed })}
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
      {/* Not enough credits (checked before starting, and again by the server): the app's add-credits popup. */}
      <NoCreditsModal
        open={Boolean(noCredits)}
        onClose={() => setNoCredits(null)}
        creditsNeeded={noCredits?.needed ?? 0}
        creditBalance={balance}
        variant="cutaway"
      />
    </>
  );
}
