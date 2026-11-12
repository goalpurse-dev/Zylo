import { useEffect, useState } from "react";
import AuthModal from "../../components/AuthModal";
import BlockyWorldsStudio from "../../components/viral-tools/blocky-worlds/BlockyWorldsStudio";
import FaceAsmrPaywall from "../../components/viral-tools/face-asmr/FaceAsmrPaywall";
import NoCreditsModal from "../../components/viral-tools/shared/NoCreditsModal";
import { accessFor } from "../../../supabase/functions/_shared/blockyWorlds/access.js";
import { DEV_MOCK } from "../../components/viral-tools/blocky-worlds/api/blockyWorldsApi";
import { BLOCKY_WORLDS_PATH } from "../../data/blockyWorlds";
import { useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { supabase } from "../../lib/supabaseClient";

// Local dev (npm run dev) talks to the real server by default. ?mock=1 runs the free mock (dev/devApi.js); only then
// ?as=guest|free|starter|pro picks who is looking (starter if not given) and ?renderer=0 shows "video making is off".
const DEV_AS = DEV_MOCK ? new URLSearchParams(window.location.search).get("as") ?? "starter" : null;

/**
 * Blocky Worlds: "In this world..." story videos. Everyone the page is open to can browse ideas; writing scripts and
 * making videos need a paid plan (the server enforces the same rule: _shared/blockyWorlds/access.js). The page is
 * behind the server's switch until launch (BLOCKY_WORLDS_ACCESS, data/blockyWorlds.js): the route's BlockyWorldsGate and
 * the studio send visitors away when the server says the template isn't open to them.
 */
export default function BlockyWorlds() {
  const { user, loading: authLoading } = useAuth();
  const [planCode, setPlanCode] = useState(null);
  const [gate, setGate] = useState(null); // "signup" | "upgrade" | null
  const [noCredits, setNoCredits] = useState(null); // { needed } | null
  const balance = useProfileCredits();

  useEffect(() => {
    if (authLoading || !user || DEV_AS) return undefined;
    let mounted = true;
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data, error }) => {
      if (mounted) setPlanCode(error ? null : String(data?.plan_code || "free").toLowerCase());
    });
    return () => { mounted = false; };
  }, [authLoading, user]);

  const signedIn = DEV_AS ? DEV_AS !== "guest" : Boolean(user);
  const plan = DEV_AS ? (DEV_AS === "guest" ? null : DEV_AS) : planCode;
  const access = authLoading && !DEV_AS ? "unknown" : accessFor({ signedIn, planCode: plan });

  return (
    <>
      <BlockyWorldsStudio
        access={access}
        balance={DEV_AS ? 500 : balance}
        onSignUp={() => setGate("signup")}
        onUpgrade={() => setGate("upgrade")}
        onNoCredits={(needed) => setNoCredits({ needed })}
      />
      {gate === "signup" && (
        <AuthModal mode="signup" title="Sign up to start" subtitle="Free to join. Get story ideas and make your own blocky world videos." returnTo={BLOCKY_WORLDS_PATH} onClose={() => setGate(null)} />
      )}
      <FaceAsmrPaywall
        open={gate === "upgrade"}
        onClose={() => setGate(null)}
        isGuest={false}
        toolName="Blocky Worlds"
        previewSrc="/blocky-worlds/hero.jpg"
        title="Blocky Worlds videos are for paid plans"
        subtitle="Upgrade to write the full story and make the video."
        planLines={{ starter: "Blocky Worlds, with the Zyvo end card", pro: "Blocky Worlds, end card can be removed", generative: "Blocky Worlds, end card can be removed" }}
        dropFeatures={["Watermark-free exports"]}
      />
      <NoCreditsModal open={Boolean(noCredits)} onClose={() => setNoCredits(null)} creditsNeeded={noCredits?.needed ?? 0} creditBalance={balance} />
    </>
  );
}
