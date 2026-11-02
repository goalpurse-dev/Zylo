// /welcome/first-video: the new-user tutorial. Pick a video, press Generate, watch its first 10 seconds for free (a real
// render: every stage below reads the run's real state), then the plans; after an upgrade the same video is finished as a
// gift. The server decides everything that costs money (cutaway-api, _shared/cutaway/freePreview.js).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Download, Hand, Loader2, Lock, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { formatMoney, usePlanPrices } from "../../lib/planPrices";
import { PRICING_PLANS } from "../../lib/pricingOutputs";
import { saveMediaToDevice } from "../../lib/downloadMedia";
import { cutawayServer, PRICES } from "../../components/viral-tools/cutaway-explainer/api/cutawayApi";
import { Confetti } from "../../components/onboarding/FirstGenFlow.jsx";
import FloatingClips from "../../components/onboarding/FloatingClips.jsx";
import UpgradeScreen, { ExploreButton, RECOMMENDED_PLAN, lockLineFor, usePlanCheckout } from "../../components/onboarding/UpgradeScreen.jsx";
import { adminPreviewMode, browserId, endAdminPreview, lastSurveyGoals, trackFunnel } from "../../lib/onboarding";
import { demoPreviewRun, demoStateFor } from "../../lib/onboardingDemo";
import { CUTAWAY_PATH } from "../../data/cutawayExplainer";
import { PREVIEW_TOPIC_KEYS, topicsForGoals } from "../../../supabase/functions/_shared/cutaway/freePreview.js";
import { SIGNUP_BONUS } from "../../../supabase/functions/_shared/signupBonus.js";
import "../../components/onboarding/onboarding.css";

const PLAN_IDS = ["starter", "pro", "generative"];
const EXAMPLE_VIDEO = "/cutaway-explainer/example-french-drain.mp4";
const POLL_MS = 3000;
const LOOP_SEC = 5; // a topic card plays this much of its video, over and over

function Dots({ step }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 3`}>
      {[1, 2, 3].map((n) => <span key={n} className={`h-2 rounded-full transition-all ${n === step ? "w-6 bg-lime-300" : n < step ? "w-2 bg-lime-300/60" : "w-2 bg-white/15"}`} />)}
    </div>
  );
}

// An instruction, not a button: a speech bubble pointing down at the thing to tap.
function Bubble({ children }) {
  return (
    <p className="ob-nudge relative inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-[#1C1F1C] px-4 py-2 text-[14px] font-semibold text-white/85" role="status" data-testid="first-video-bubble">
      <Hand className="h-4 w-4 text-lime-300" aria-hidden="true" /> {children}
      <span className="absolute -bottom-[6px] left-1/2 h-[11px] w-[11px] -translate-x-1/2 rotate-45 border-b border-r border-white/15 bg-[#1C1F1C]" aria-hidden="true" />
    </p>
  );
}

// A card: its video plays muted, the first few seconds over and over. Asked for less motion: the still.
function TopicClip({ topic }) {
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!topic.clipUrl || still) return topic.poster ? <img src={topic.poster} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null;
  return <video ref={(el) => { if (el) { el.muted = true; el.setAttribute("muted", ""); } }} src={topic.clipUrl} poster={topic.poster} muted loop autoPlay playsInline preload="auto" disablePictureInPicture data-testid="first-video-topic-clip" onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= LOOP_SEC) e.currentTarget.currentTime = 0; }} className="absolute inset-0 h-full w-full object-cover" />;
}

// The stages read the run: queued -> the plan is fetched, render -> the frames, 86 %+ -> the sound and the captions.
function stageOf(run) {
  if (!run || run.step !== "render") return 0;
  return (run.renderPct ?? 0) >= 86 ? 2 : 1;
}
const STAGES = ["Loading your script", "Creating scenes", "Adding voice"];

function Rendering({ run }) {
  const stage = stageOf(run), pct = run?.step === "render" ? run.renderPct ?? 0 : 4;
  return (
    <section className="relative z-10 w-full text-center" data-testid="first-video-rendering">
      <FloatingClips />
      <div className="relative z-10">
      <h1 className="text-[27px] font-black leading-tight tracking-tight text-white">Your video is coming to life</h1>
      <p className="mt-1.5 text-[14px] text-white/70">This usually takes a minute or two. You can leave: it stays on your home page.</p>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-lime-300 transition-all duration-700" style={{ width: `${Math.max(4, pct)}%` }} /></div>
      <ol className="mt-6 grid gap-2.5 text-left">
        {STAGES.map((label, i) => (
          <li key={label} className={`flex items-center gap-3 rounded-2xl border bg-[#090A0A]/85 px-4 py-3 text-[15px] font-bold transition ${i === stage ? "border-lime-300/60 text-white" : i < stage ? "border-white/15 text-white/80" : "border-white/10 text-white/50"}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full ${i < stage ? "bg-lime-300 text-[#11150D]" : "border border-white/15"}`}>
              {i < stage ? <Check className="h-4 w-4" strokeWidth={3} /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin text-lime-300" /> : null}
            </span>
            {label}
          </li>
        ))}
      </ol>
      </div>
    </section>
  );
}

// The clip, big. With sound when the browser allows it, a "Tap for sound" button when it doesn't; no download, and at the
// end the last frame stays, blurred, under the lock.
function PreviewPlayer({ src, poster, locked, onEnded, stopAt, lockLine, onUnlock }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || locked) return;
    v.muted = false;
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
  }, [src, locked]);
  return (
    <div className={`relative mx-auto overflow-hidden rounded-3xl bg-black transition-all duration-500 ${locked ? "aspect-[9/12] w-[50%] max-w-[190px] border-2 border-lime-300/55 shadow-[0_0_44px_rgba(190,242,100,0.28)] md:aspect-[9/16] md:w-full md:max-w-[380px]" : "aspect-[9/16] w-full max-w-[320px] border border-white/10"}`} onContextMenu={(e) => e.preventDefault()} data-testid="first-video-player">
      <video ref={ref} src={src} poster={poster} playsInline controlsList="nodownload" disablePictureInPicture onEnded={onEnded} onLoadedMetadata={(e) => { const v = e.currentTarget; if (locked && v.currentTime === 0) v.currentTime = Math.max(0, Math.min(stopAt ?? v.duration, v.duration) - 0.05); }} onTimeUpdate={stopAt ? (e) => { if (!locked && e.currentTarget.currentTime >= stopAt) { e.currentTarget.pause(); onEnded(); } } : undefined} muted={muted} className={`h-full w-full object-cover transition duration-500 ${locked ? "scale-105 blur-md brightness-50" : ""}`} />
      {!locked && muted && (
        <button type="button" data-testid="first-video-sound" onClick={() => { const v = ref.current; if (v) { v.muted = false; v.play().catch(() => {}); } setMuted(false); }}
          className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-[14px] font-black text-[#11150D] shadow-lg">
          <VolumeX className="h-4 w-4" /> Tap for sound
        </button>
      )}
      {locked && (
        <button type="button" onClick={onUnlock} data-testid="first-video-lock" className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center md:gap-3 md:px-6">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-[0_0_0_6px_rgba(190,242,100,0.18)] md:h-14 md:w-14 md:shadow-[0_0_0_9px_rgba(190,242,100,0.18)]"><Lock className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2.6} /></span>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-lime-300 md:mt-1 md:text-[12px]">What happens next</span>
          <span className="text-[13px] font-black leading-snug text-white [text-shadow:0_1px_8px_#000] md:text-[20px]" data-testid="first-video-cliffhanger">{lockLine}</span>
        </button>
      )}
    </div>
  );
}

function Plans() {
  const prices = usePlanPrices();
  const { choose, busy } = usePlanCheckout(false, { plain: true }); // no video to finish here
  const videosFor = (planId) => Math.floor(PRICING_PLANS[planId].credits / PRICES.video.credits.premade[30]);
  return (
    <section id="first-video-plans" className="mt-8 w-full scroll-mt-4" data-testid="first-video-plans">
      <h2 className="text-center text-[24px] font-black leading-tight tracking-tight text-white">Start creating videos like this</h2>
      <div className="mt-5 grid gap-3">
        {PLAN_IDS.map((planId) => {
          const best = planId === RECOMMENDED_PLAN, plan = prices.status === "ready" ? prices.prices?.plans?.[planId] : null;
          return (
            <div key={planId} data-testid="first-video-plan" data-plan={planId} className={`relative rounded-2xl border p-4 ${best ? "border-lime-300/70 bg-lime-300/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
              {best && <span className="absolute -top-2.5 left-4 rounded-full bg-lime-300 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-[#11150D]">Most popular</span>}
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[16px] font-black text-white">{PRICING_PLANS[planId].name}</h3>
                <p className="text-[13px] text-white/55"><span className="text-[21px] font-black text-white">{plan ? formatMoney(plan.monthly, prices.prices.currency) : "…"}</span> / month</p>
              </div>
              <p className="mt-1.5 text-[13px] text-white/70">{PRICING_PLANS[planId].credits.toLocaleString("en-US")} credits a month: about {videosFor(planId)} videos like this one</p>
              <button type="button" disabled={busy != null} onClick={() => choose(planId)} data-testid="first-video-plan-button" data-plan={planId}
                className={`mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-black transition disabled:opacity-60 ${best ? "bg-lime-300 text-[#11150D] hover:bg-lime-200" : "border border-lime-300/45 text-lime-200 hover:bg-lime-300/10"}`}>
                {busy === planId && <Loader2 className="h-4 w-4 animate-spin" />} Get {PRICING_PLANS[planId].name}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[12px] text-white/40">Monthly. Cancel anytime. <Link to="/pricing" className="underline underline-offset-2">See all plans</Link></p>
    </section>
  );
}

// The next videos on offer, in the order their answers ask for, without the one they just made (these three have pictures).
const NEXT_TOPICS = { landfill: "Landfill", car_wash: "Car wash", french_drain: "French drain" };
function nextTopics(run) {
  const made = String(run?.topic ?? "").toLowerCase();
  return topicsForGoals(lastSurveyGoals(), PREVIEW_TOPIC_KEYS.length).filter((k) => NEXT_TOPICS[k] && NEXT_TOPICS[k].toLowerCase() !== made).slice(0, 2).map((key) => ({ key, topic: NEXT_TOPICS[key] }));
}
const topicLink = (topic) => `${CUTAWAY_PATH}?topic=${encodeURIComponent(topic)}`;

// After the payment: the finished video, what they now have, and straight on to the next one.
function Finished({ run, demo, userId }) {
  const [saving, setSaving] = useState(false);
  const [facts, setFacts] = useState(() => (demo ? { plan: "Starter", credits: 800, bonus: SIGNUP_BONUS.credits } : null));
  useEffect(() => {
    if (demo || !userId) return undefined;
    let live = true;
    Promise.all([
      supabase.from("profiles").select("plan_code, credit_balance").eq("id", userId).maybeSingle(),
      supabase.from("offer_redemptions").select("credits").eq("user_id", userId).eq("offer_id", SIGNUP_BONUS.id).maybeSingle(),
    ]).then(([p, b]) => { if (live && p.data) setFacts({ plan: PRICING_PLANS[String(p.data.plan_code).toLowerCase()]?.name ?? null, credits: Number(p.data.credit_balance) || 0, bonus: b.data?.credits ?? null }); }, () => {});
    return () => { live = false; };
  }, [demo, userId]);
  const save = async () => {
    setSaving(true);
    try { await saveMediaToDevice({ url: run.downloadUrl || run.finalUrl, filename: "my-first-zyvo-video.mp4", title: run.title }); } finally { setSaving(false); }
  };
  const next = nextTopics(run);
  const quiet = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-2 text-[14px] font-bold text-white/80 transition hover:border-white/35 hover:text-white disabled:opacity-60";
  return (
    <section className="grid w-full items-center gap-4 md:grid-cols-[330px_minmax(0,1fr)] md:gap-12" data-testid="first-video-finished">
      <Confetti />
      <video src={run.finalUrl} poster={run.poster} controls playsInline autoPlay className="mx-auto aspect-[9/16] w-[46%] max-w-[176px] rounded-3xl border-2 border-lime-300/55 bg-black object-cover shadow-[0_0_44px_rgba(190,242,100,0.28)] md:w-full md:max-w-[330px]" />
      <div className="min-w-0 text-center md:text-left">
        <p className="flex items-center justify-center gap-2 text-[13px] font-black text-lime-300 md:justify-start"><span className="grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" /></span> Your video is ready</p>
        <h1 className="mt-1.5 text-[28px] font-black leading-tight tracking-tight text-white md:text-[36px]">Your video is finished 🎉</h1>
        <p className="mt-1.5 text-[14.5px] leading-snug text-white/65">A gift from us: it used none of your credits. Post it, then make the next one while you're here.</p>
        {facts && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 md:justify-start" data-testid="first-video-facts">
            {[facts.plan && `${facts.plan} active`, `${facts.credits.toLocaleString("en-US")} credits`, facts.bonus && `+${facts.bonus} sign-up bonus added`].filter(Boolean).map((t) => (
              <span key={t} className="rounded-full border border-lime-300/40 bg-lime-300/[0.14] px-3 py-1 text-[12.5px] font-extrabold text-lime-200">{t}</span>
            ))}
          </div>
        )}
        {next[0] && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090A0A]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:mt-4 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <Link to={topicLink(next[0].topic)} data-testid="first-video-next" className="block rounded-[20px] bg-lime-300 px-3 py-2.5 text-center text-[#11150D] shadow-[0_0_34px_rgba(190,242,100,0.4)] transition hover:bg-lime-200">
              <span className="block text-[22px] font-black leading-tight">Make your next video</span>
              <span className="mt-0.5 block text-[13.5px] font-bold">{next[0].topic}, ready to go: {PRICES.video.credits.premade[30]} credits</span>
            </Link>
          </div>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2 md:mt-4">
          {next.map((t, i) => (
            <Link key={t.key} to={topicLink(t.topic)} data-testid="first-video-next-topic" className={`relative block aspect-square overflow-hidden rounded-2xl border-2 text-left md:aspect-[9/12] ${i === 0 ? "border-lime-300" : "border-white/15"}`}>
              <img src={`/onboarding/demo/${t.key}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6 text-[12.5px] font-black text-white">{t.topic}</span>
            </Link>
          ))}
          <Link to="/" className="relative block aspect-square overflow-hidden rounded-2xl border-2 border-white/15 text-left md:aspect-[9/12]">
            <img src="/onboarding/auth/skeleton.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6 text-[12.5px] font-black text-white">More templates</span>
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 pb-28 md:pb-0">
          <button type="button" onClick={save} disabled={saving} className={quiet}><Download className="h-4 w-4" /> {saving ? "Saving…" : "Download my video"}</button>
          <Link to="/" className={quiet}>Go to Home</Link>
        </div>
      </div>
    </section>
  );
}

// The owner's look: says so on every screen, nothing a customer would see.
function AdminBar({ mode, onFinished, onExit }) {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-amber-300 px-3 py-1.5 text-[12px] font-bold text-black" data-testid="first-video-admin-bar">
      <span className="hidden sm:inline">{mode === "demo" ? "Admin preview: nothing saved, charged or rendered" : "Admin preview: a real render, no checkout"}</span>
      <span className="sm:hidden">{mode === "demo" ? "Test: nothing saved or charged" : "Test: real render"}</span>
      {mode === "demo" && <button type="button" onClick={onFinished} className="whitespace-nowrap underline">Finished screen</button>}
      <button type="button" onClick={onExit} className="underline">Exit</button>
    </div>
  );
}

export default function FirstVideo() {
  const adminMode = adminPreviewMode();
  const demo = adminMode === "demo";
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paidReturn = !demo && params.get("paid") === "1"; // a walk-through never asks the server to finish a video
  const unlock = params.get("unlock") === "1"; // from Home's "Your video is waiting": straight to the lock, no second watch
  const [state, setState] = useState(null);
  const [picked, setPicked] = useState(null);
  const [run, setRun] = useState(null);
  const [finish, setFinish] = useState(null);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => { document.title = "Your first video | Zyvo"; }, []);

  const load = useCallback(async () => {
    const s = demo ? demoStateFor() : await cutawayServer.freePreviewState({ force: adminMode === "real" });
    setState(s);
    if (s?.preview) setRun(s.preview);
    else if (demo && unlock) setRun(demoPreviewRun());
    if (s?.finish) setFinish(s.finish);
    if (unlock && (demo || s?.preview?.step === "done")) { setLocked(true); trackFunnel("upgrade_screen_shown", { runId: s?.preview?.id ?? null, from: "home" }); }
    return s;
  }, [adminMode, demo, unlock]);

  const leave = useCallback(async (skipped) => {
    if (skipped) trackFunnel("tutorial_skipped", { step: run ? 2 : picked ? 2 : 1 });
    if (!adminMode) await supabase.rpc("finish_onboarding_tutorial").then(() => {}, () => {});
    navigate("/");
  }, [adminMode, navigate, picked, run]);

  useEffect(() => {
    if (loading || !user) return;
    load().then((s) => {
      // Nothing to offer here (a paid plan, not in the rollout, no plan prepared yet): Home.
      if (!paidReturn && s && !s.preview && (!s.on || !s.topics?.length)) { navigate("/", { replace: true }); return; }
      if (s?.on && !s.preview) trackFunnel("tutorial_started");
    }).catch(() => navigate("/", { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  // the preview being made
  useEffect(() => {
    if (demo || !run || !["queued", "script", "scene", "render"].includes(run.step)) return undefined;
    const t = setTimeout(() => cutawayServer.status(run.id).then((r) => { if (r) setRun(r); }).catch(() => setRun((cur) => ({ ...cur }))), POLL_MS);
    return () => clearTimeout(t);
  }, [run]);

  // back from Stripe: the same video in full, once the plan has arrived (the server does nothing twice)
  useEffect(() => {
    if (!paidReturn || (finish && finish.step !== "failed")) return undefined;
    let stop = false, t;
    const ask = async () => {
      if (stop) return;
      const r = await cutawayServer.finishFreePreview().catch(() => null);
      if (r?.finish && !stop) { setFinish(r.finish); return; }
      t = setTimeout(ask, 4000);
    };
    ask();
    return () => { stop = true; clearTimeout(t); };
  }, [paidReturn, finish]);
  useEffect(() => {
    if (!finish || !["queued", "script", "scene", "render"].includes(finish.step)) return undefined;
    const t = setTimeout(() => cutawayServer.status(finish.id).then((r) => { if (r) setFinish(r); }).catch(() => setFinish((cur) => ({ ...cur }))), POLL_MS);
    return () => clearTimeout(t);
  }, [finish]);

  const generate = async () => {
    if (!picked || starting) return;
    setStarting(true);
    setNotice(null);
    trackFunnel("tutorial_step_completed", { step: 2, topic: picked });
    if (demo) {
      // the stages as a customer sees them, sped up
      setRun({ id: "demo", step: "queued" });
      setTimeout(() => setRun({ id: "demo", step: "render", renderPct: 45 }), 1500);
      setTimeout(() => setRun({ id: "demo", step: "render", renderPct: 90 }), 3000);
      setTimeout(() => setRun(demoPreviewRun(picked)), 4500);
      setStarting(false);
      return;
    }
    try {
      setRun(await cutawayServer.startFreePreview({ topicKey: picked, deviceId: browserId(), force: adminMode === "real" }));
    } catch (e) {
      if (e?.code === "PREVIEW_LIMIT" || e?.code === "PREVIEW_USED") { setBlocked(true); setNotice(e.message); trackFunnel("upgrade_screen_shown", { blocked: e.code }); }
      else setNotice(e?.message ?? "That didn't work. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  // The lock and its next line stay in view: the page starts at the top, and tapping the lock brings the button to the middle.
  const clipEnded = () => {
    setLocked(true);
    trackFunnel("preview_watched_to_end", { runId: run?.id ?? null });
    trackFunnel("upgrade_screen_shown", { runId: run?.id ?? null });
    window.scrollTo({ top: 0 });
  };
  const toButton = () => document.querySelector("[data-testid=first-video-plan-button]")?.scrollIntoView({ behavior: "smooth", block: "center" });

  const adminBar = adminMode ? <AdminBar mode={adminMode} onFinished={() => { setRun(null); setFinish({ ...demoPreviewRun(), title: "Demo" }); }} onExit={() => { endAdminPreview(); navigate("/"); }} /> : null;
  const screen = `flex min-h-[100dvh] w-full flex-col bg-[#090A0A] px-4 pb-10 ${adminMode ? "pt-10" : "pt-4"} text-white`;
  const column = "mx-auto my-auto flex w-full max-w-[460px] flex-col items-center py-4";

  // ---------- after the upgrade ----------
  if (paidReturn || (finish && !run)) {
    if (finish?.step === "done") return <div className={screen}>{adminBar}<div className="mx-auto my-auto w-full max-w-[980px] py-2"><Finished run={finish} demo={demo} userId={user?.id} /></div></div>;
    const failed = finish?.step === "failed";
    return (
      <div className={screen}><div className={column}>
        {failed ? (
          <section className="text-center"><h1 className="text-[24px] font-black">We couldn't finish it just yet</h1><p className="mt-2 text-[14px] text-white/60">Your plan is active and nothing was charged for this video. Please try again in a moment.</p>
            <button type="button" onClick={() => cutawayServer.finishFreePreview().then((r) => r?.finish && setFinish(r.finish))} className="mt-5 min-h-[52px] w-full rounded-2xl bg-lime-300 text-[16px] font-black text-[#11150D]">Try again</button></section>
        ) : <Rendering run={finish} />}
      </div></div>
    );
  }

  if (!state) return <div className={screen}><div className="m-auto"><Loader2 className="h-6 w-6 animate-spin text-white/50" /></div></div>;

  // ---------- no preview available for this network: an example and the plans, never a dead end ----------
  if (blocked) {
    return (
      <div className={screen}><div className={column}>
        <p className="mb-4 text-center text-[14px] text-white/70" role="status">{notice}</p>
        <video src={EXAMPLE_VIDEO} controls playsInline className="mx-auto aspect-[9/16] w-full max-w-[280px] rounded-3xl border border-white/10 bg-black object-cover" />
        <Plans />
        <ExploreButton onClick={() => leave(true)} />
      </div></div>
    );
  }

  // ---------- the preview: being made, failed, or playing ----------
  if (run) {
    if (run.step === "failed") {
      return (
        <div className={screen}><div className={column}>
          <h1 className="text-center text-[24px] font-black">We couldn't make this one</h1>
          <p className="mt-2 text-center text-[14px] text-white/60">It's not your fault, and your free preview is still yours.</p>
          <button type="button" onClick={() => { setRun(null); load(); }} className="mt-5 min-h-[52px] w-full rounded-2xl bg-lime-300 text-[16px] font-black text-[#11150D]">Try again</button>
          <button type="button" onClick={() => leave(true)} className="mt-3 text-[13px] font-semibold text-white/40">Skip</button>
        </div></div>
      );
    }
    if (run.step !== "done") return <div className={screen}>{adminBar}<div className={column}><Dots step={3} /><div className="mt-6 w-full"><Rendering run={run} /></div></div></div>;
    return (
      <div className={screen}>{adminBar}<div className={locked ? "mx-auto my-auto grid w-full max-w-[1000px] items-center gap-3 pb-28 pt-1 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:gap-12 md:py-2" : column}>
        {!locked && <Confetti />}
        {!locked && <h1 className="mb-4 text-center text-[26px] font-black leading-tight tracking-tight text-white">Your first video is coming to life 🎉</h1>}
        <div className="w-full">
          <PreviewPlayer src={run.finalUrl} poster={locked ? run.poster : undefined} locked={locked} onEnded={clipEnded} onUnlock={toButton} stopAt={demo ? 10 : undefined} lockLine={lockLineFor(run) || `The other ${(Number(run.lengthSec) || 30) - 10} seconds`} />
        </div>
        {!locked && <p className="mt-3 flex items-center gap-1.5 text-[13px] text-white/50"><Volume2 className="h-4 w-4" /> Your free 10-second preview</p>}
        {locked && <UpgradeScreen run={run} adminLook={Boolean(adminMode)} onExplore={() => leave(false)} />}
      </div></div>
    );
  }

  // ---------- steps 1 and 2: pick, then Generate. Everything but the one thing to tap is dimmed ----------
  const step = picked ? 2 : 1;
  const matched = lastSurveyGoals().length > 0; // they just told us what they want: the order on this page comes from it
  return (
    <div className={screen} data-testid="first-video-tutorial">
      {adminBar}
      <div className="flex items-center justify-between">
        <Dots step={step} />
        <button type="button" data-testid="first-video-skip" onClick={() => leave(true)} className="text-[13px] font-semibold text-white/40 transition hover:text-white/70">Skip</button>
      </div>
      <div className="mx-auto my-auto flex w-full max-w-[1000px] flex-col items-center py-2">
        <h1 className="text-center text-[28px] font-black leading-tight tracking-tight text-white md:text-[34px]">Pick your first video</h1>
        <p className="mt-1 text-center text-[14.5px] font-semibold text-lime-200" data-testid="first-video-free-line">You'll get a free 10-second preview. No credits, no card.</p>
        <div className="mt-3 flex h-[42px] items-center">{step === 1 && <Bubble>Pick an idea</Bubble>}</div>
        {/* phones: big cards to swipe through, the next one peeking in. Larger screens: all side by side, as tall as fits. */}
        <div className="-mx-4 mt-2 flex w-screen snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] md:mx-auto md:grid md:w-[min(100%,calc((100dvh-340px)*27/16+48px))] md:grid-cols-3 md:gap-6 md:overflow-visible md:p-0">
          {(state.topics ?? []).map((t, i) => {
            const on = picked === t.key;
            return (
              <button key={t.key} type="button" data-testid="first-video-topic" data-topic={t.key} aria-pressed={on}
                onClick={() => { setPicked(t.key); trackFunnel("tutorial_step_completed", { step: 1, topic: t.key }); }}
                className={`relative aspect-[9/16] w-[min(66vw,calc((100dvh-290px)*9/16))] shrink-0 snap-center overflow-hidden rounded-3xl border-[3px] bg-black text-left transition duration-200 md:w-full ${on ? "ob-pick border-lime-300 shadow-[0_0_40px_rgba(190,242,100,0.5)]" : picked ? "border-white/10 opacity-50 hover:opacity-80" : "border-white/15 hover:-translate-y-1 hover:border-lime-300/60"}`}>
                <TopicClip topic={t} />
                {i === 0 && matched && <span className="absolute left-2.5 top-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[11.5px] font-black text-lime-300 backdrop-blur-sm">Best match for you</span>}
                {on && <span className="ob-check absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-lg"><Check className="h-5 w-5" strokeWidth={3.5} aria-hidden="true" /></span>}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3.5 pb-3.5 pt-12 text-[18px] font-black leading-tight text-white">{t.topic}</span>
              </button>
            );
          })}
        </div>
        <div className="sticky bottom-3 z-10 mt-2 flex w-full max-w-[460px] flex-col items-center md:mt-5">
          {step === 2 && <div className="mb-3"><Bubble>Now hit Generate</Bubble></div>}
          {notice && <p className="mb-2 text-center text-[13px] text-red-300" role="alert">{notice}</p>}
          <button type="button" disabled={!picked || starting} onClick={generate} data-testid="first-video-generate"
            className={`inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl text-[19px] font-black transition ${picked ? "ob-cta-pulse bg-lime-300 text-[#11150D] hover:bg-lime-200" : "bg-[#1C1F1C] text-white/30"}`}>
            {starting && <Loader2 className="h-5 w-5 animate-spin" />} Generate
          </button>
        </div>
      </div>
    </div>
  );
}
