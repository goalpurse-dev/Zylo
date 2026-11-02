// Right after any sign-up, on any route: reports the sign-up once (the funnel and the welcome email), and shows the survey
// to accounts in the rollout. Everything else about who sees what is decided on the server (onboarding_status).
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FIRST_VIDEO_PATH, beginAdminPreview, fetchOnboardingStatus, localOnboardingTest, takeSignupRoute, trackFunnel } from "../../lib/onboarding";
import { hasCheckoutIntent } from "../../lib/payments";

const OnboardingSurvey = lazy(() => import("./OnboardingSurvey.jsx"));
const NEW_ACCOUNT_MS = 10 * 60 * 1000;
// Pages a survey must not cover: finishing a sign-in or a password reset, and coming back from a payment.
const WAIT_ON = ["/auth/", "/billing/", "/unsubscribe"];
// Read once on load: a login on the way can drop the address's ?from=email.
let cameFromEmail = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "email";

export default function OnboardingGate() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSurvey, setShowSurvey] = useState(false);
  const [previewSurvey, setPreviewSurvey] = useState(false);
  const userId = user?.id ?? null;

  // A link in the welcome email (?from=email): the click is counted here, once the account is known. Click tracking stays off at Resend.
  useEffect(() => {
    if (!userId || loading || !cameFromEmail) return;
    cameFromEmail = null;
    trackFunnel("welcome_email_clicked", { path: location.pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loading]);

  // A new account, once in this browser: the funnel's signed_up (the server counts it once anyway).
  useEffect(() => {
    if (!userId || loading || localOnboardingTest()) return;
    const age =Date.now() - Date.parse(user.created_at ?? "");
    if (!(age >= 0 && age < NEW_ACCOUNT_MS)) return;
    const key = `zyvo:signup-reported:${userId}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { /* reported again at worst: both are once-only on the server */ }
    const provider = user.app_metadata?.provider ?? "email";
    trackFunnel("signed_up", { route: takeSignupRoute() ?? "unknown", provider });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loading]);

  // ?onboarding=force: the owner's look at the whole flow, from the survey on. Anyone else: nothing happens.
  const force = new URLSearchParams(location.search);
  const forceMode = force.get("onboarding") === "force" ? (force.get("real") === "1" ? "real" : "demo") : null;
  useEffect(() => {
    if (!userId || loading || !forceMode) return undefined;
    let live = true;
    beginAdminPreview(forceMode).then((ok) => { if (live && ok) { setPreviewSurvey(true); setShowSurvey(true); } });
    return () => { live = false; };
  }, [userId, loading, forceMode]);

  // Localhost with the local test on: the same walk-through by itself, once per account in this tab.
  useEffect(() => {
    if (!userId || loading || forceMode || !localOnboardingTest() || hasCheckoutIntent() || WAIT_ON.some((p) => location.pathname.startsWith(p))) return;
    const key = `zyvo:onboarding-local-shown:${userId}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* shown again at worst */ }
    setPreviewSurvey(true);
    setShowSurvey(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loading, location.pathname]);

  useEffect(() => {
    if (!userId || loading || forceMode || WAIT_ON.some((p) => location.pathname.startsWith(p))) return undefined;
    // Someone on their way to Stripe pays first: they answer when they are back.
    if (hasCheckoutIntent()) return undefined;
    let live = true;
    fetchOnboardingStatus(userId).then((status) => { if (live && status.enrolled && !status.surveyDone) setShowSurvey(true); });
    return () => { live = false; };
  }, [userId, loading, location.pathname]);

  if (!showSurvey) return null;
  return (
    <Suspense fallback={null}>
      <OnboardingSurvey preview={previewSurvey} withPlan={previewSurvey || !location.pathname.startsWith("/long-form")} onDone={() => {
        setShowSurvey(false);
        if (previewSurvey) { navigate(FIRST_VIDEO_PATH); return; }
        fetchOnboardingStatus(userId, { fresh: true });
        // Long Form keeps its own free preview, already on its way: no tutorial on top of it.
        if (!location.pathname.startsWith("/long-form")) navigate(FIRST_VIDEO_PATH);
      }} />
    </Suspense>
  );
}
