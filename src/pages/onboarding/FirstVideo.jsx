// /welcome/first-video: the new-user tutorial. Pick a video, press Generate, watch its first 10 seconds for free (a real
// render: every stage below reads the run's real state), then the plans; after an upgrade the same video is finished as a
// gift. The server decides everything that costs money (cutaway-api, _shared/cutaway/freePreview.js).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Download, Loader2, Lock, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { startCheckout } from "../../lib/payments";
import usePaymentAction from "../../hooks/usePaymentAction";
import { formatMoney, usePlanPrices } from "../../lib/planPrices";
import { PRICING_PLANS } from "../../lib/pricingOutputs";
import { saveMediaToDevice } from "../../lib/downloadMedia";
import { cutawayServer, PRICES } from "../../components/viral-tools/cutaway-explainer/api/cutawayApi";
import { Confetti } from "../../components/onboarding/FirstGenFlow.jsx";
import { browserId, FIRST_VIDEO_PATH, trackFunnel } from "../../lib/onboarding";

const PLAN_IDS = ["starter", "pro", "generative"];
const BEST_VALUE = "pro";
const EXAMPLE_VIDEO = "/cutaway-explainer/example-french-drain.mp4";
const POLL_MS = 3000;

function Dots({ step }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 3`}>
      {[1, 2, 3].map((n) => <span key={n} className={`h-2 rounded-full transition-all ${n === step ? "w-6 bg-lime-300" : n < step ? "w-2 bg-lime-300/60" : "w-2 bg-white/15"}`} />)}
    </div>
  );
}

function Bubble({ children }) {
  return <p className="rounded-2xl bg-lime-300 px-4 py-2 text-[14px] font-black text-[#11150D] shadow-[0_8px_32px_rgba(190,242,100,0.35)]" role="status">{children}</p>;
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
    <section className="w-full text-center" data-testid="first-video-rendering">
      <h1 className="text-[27px] font-black leading-tight tracking-tight text-white">Your video is coming to life</h1>
      <p className="mt-1.5 text-[14px] text-white/55">This usually takes a minute or two. You can leave: it stays on your home page.</p>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 transition-all duration-700" style={{ width: `${Math.max(4, pct)}%` }} /></div>
      <ol className="mt-6 grid gap-2.5 text-left">
        {STAGES.map((label, i) => (
          <li key={label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-[15px] font-bold transition ${i === stage ? "border-lime-300/60 bg-lime-300/[0.08] text-white" : i < stage ? "border-white/10 text-white/70" : "border-white/[0.06] text-white/35"}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full ${i < stage ? "bg-lime-300 text-[#11150D]" : "border border-white/15"}`}>
              {i < stage ? <Check className="h-4 w-4" strokeWidth={3} /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin text-lime-300" /> : null}
            </span>
            {label}
          </li>
        ))}
      </ol>
    </section>
  );
}

// The clip, big. With sound when the browser allows it, a "Tap for sound" button when it doesn't; no download, and at the
// end the last frame stays, blurred, under the lock.
function PreviewPlayer({ src, poster, locked, onEnded, lockLine = "Upgrade to finish your video", onUnlock }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || locked) return;
    v.muted = false;
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
  }, [src, locked]);
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-3xl border border-white/10 bg-black" onContextMenu={(e) => e.preventDefault()} data-testid="first-video-player">
      <video ref={ref} src={src} poster={poster} playsInline controlsList="nodownload" disablePictureInPicture onEnded={onEnded} muted={muted} className={`h-full w-full object-cover transition duration-500 ${locked ? "scale-105 blur-md brightness-50" : ""}`} />
      {!locked && muted && (
        <button type="button" data-testid="first-video-sound" onClick={() => { const v = ref.current; if (v) { v.muted = false; v.play().catch(() => {}); } setMuted(false); }}
          className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-[14px] font-black text-[#11150D] shadow-lg">
          <VolumeX className="h-4 w-4" /> Tap for sound
        </button>
      )}
      {locked && (
        <button type="button" onClick={onUnlock} data-testid="first-video-lock" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Lock className="h-6 w-6" strokeWidth={2.6} /></span>
          <span className="text-[20px] font-black leading-tight text-white">{lockLine}</span>
        </button>
      )}
    </div>
  );
}

function Plans({ runId, hasVideo }) {
  const prices = usePlanPrices();
  const pay = usePaymentAction();
  const videosFor = (planId) => Math.floor(PRICING_PLANS[planId].credits / PRICES.video.credits.premade[30]);
  const choose = (planId) => pay.run(planId, () => startCheckout({
    type: "subscription", planId, billing: "monthly",
    successUrl: `${window.location.origin}${FIRST_VIDEO_PATH}?paid=1`,
    cancelUrl: `${window.location.origin}${FIRST_VIDEO_PATH}`,
  }));
  return (
    <section id="first-video-plans" className="mt-8 w-full scroll-mt-4" data-testid="first-video-plans" data-run={runId ?? ""}>
      <h2 className="text-center text-[24px] font-black leading-tight tracking-tight text-white">{hasVideo ? "Unlock the full video + start creating" : "Start creating videos like this"}</h2>
      {hasVideo && <p className="mt-1.5 text-center text-[14px] text-white/60">Your video is finished right after you pay, as a gift. It uses none of your credits.</p>}
      <div className="mt-5 grid gap-3">
        {PLAN_IDS.map((planId) => {
          const best = planId === BEST_VALUE, plan = prices.status === "ready" ? prices.prices?.plans?.[planId] : null;
          return (
            <div key={planId} data-testid="first-video-plan" data-plan={planId} className={`relative rounded-2xl border p-4 ${best ? "border-lime-300/70 bg-lime-300/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
              {best && <span className="absolute -top-2.5 left-4 rounded-full bg-lime-300 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-[#11150D]">Best value</span>}
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[16px] font-black text-white">{PRICING_PLANS[planId].name}</h3>
                <p className="text-[13px] text-white/55"><span className="text-[21px] font-black text-white">{plan ? formatMoney(plan.monthly, prices.prices.currency) : "…"}</span> / month</p>
              </div>
              <p className="mt-1.5 text-[13px] text-white/70">{PRICING_PLANS[planId].credits.toLocaleString("en-US")} credits a month: about {videosFor(planId)} videos like this one</p>
              <button type="button" disabled={pay.busy != null} onClick={() => choose(planId)} data-testid="first-video-plan-button" data-plan={planId}
                className={`mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-black transition disabled:opacity-60 ${best ? "bg-lime-300 text-[#11150D] hover:bg-lime-200" : "border border-lime-300/45 text-lime-200 hover:bg-lime-300/10"}`}>
                {pay.busy === planId && <Loader2 className="h-4 w-4 animate-spin" />} Get {PRICING_PLANS[planId].name}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[12px] text-white/40">Monthly{prices.status === "ready" && prices.prices?.vatIncluded ? ", VAT included" : ""}. Cancel anytime. <Link to="/pricing" className="underline underline-offset-2">See all plans</Link></p>
    </section>
  );
}

function Finished({ run }) {
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await saveMediaToDevice({ url: run.downloadUrl || run.finalUrl, filename: "my-first-zyvo-video.mp4", title: run.title }); } finally { setSaving(false); }
  };
  return (
    <section className="w-full text-center" data-testid="first-video-finished">
      <Confetti />
      <h1 className="text-[28px] font-black leading-tight tracking-tight text-white">Your video is finished 🎉</h1>
      <p className="mt-1.5 text-[14px] text-white/60">A gift from us: this one used none of your credits.</p>
      <video src={run.finalUrl} poster={run.poster} controls playsInline autoPlay className="mx-auto mt-5 aspect-[9/16] w-full max-w-[320px] rounded-3xl border border-white/10 bg-black object-cover" />
      <div className="mt-5 grid gap-2.5">
        <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-lime-300 text-[16px] font-black text-[#11150D] transition hover:bg-lime-200 disabled:opacity-60"><Download className="h-5 w-5" /> {saving ? "Saving…" : "Download my video"}</button>
        <Link to="/" className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-white/15 text-[15px] font-bold text-white/80">Start creating</Link>
      </div>
    </section>
  );
}

export default function FirstVideo() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paidReturn = params.get("paid") === "1";
  const [state, setState] = useState(null);
  const [picked, setPicked] = useState(null);
  const [run, setRun] = useState(null);
  const [finish, setFinish] = useState(null);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [starting, setStarting] = useState(false);
  const plansRef = useRef(null);

  useEffect(() => { document.title = "Your first video | Zyvo"; }, []);

  const load = useCallback(async () => {
    const s = await cutawayServer.freePreviewState();
    setState(s);
    if (s?.preview) setRun(s.preview);
    if (s?.finish) setFinish(s.finish);
    return s;
  }, []);

  const leave = useCallback(async (skipped) => {
    if (skipped) trackFunnel("tutorial_skipped", { step: run ? 2 : picked ? 2 : 1 });
    await supabase.rpc("finish_onboarding_tutorial").then(() => {}, () => {});
    navigate("/");
  }, [navigate, picked, run]);

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
    if (!run || !["queued", "script", "scene", "render"].includes(run.step)) return undefined;
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
    try {
      setRun(await cutawayServer.startFreePreview({ topicKey: picked, deviceId: browserId() }));
    } catch (e) {
      if (e?.code === "PREVIEW_LIMIT" || e?.code === "PREVIEW_USED") { setBlocked(true); setNotice(e.message); trackFunnel("upgrade_screen_shown", { blocked: e.code }); }
      else setNotice(e?.message ?? "That didn't work. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const showPlans = () => {
    trackFunnel("upgrade_screen_shown", { runId: run?.id ?? null });
    setTimeout(() => plansRef.current?.querySelector("#first-video-plans")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const clipEnded = () => {
    setLocked(true);
    trackFunnel("preview_watched_to_end", { runId: run?.id ?? null });
    showPlans();
  };

  const screen = "flex min-h-[100dvh] w-full flex-col bg-[#090A0A] px-4 pb-10 pt-4 text-white";
  const column = "mx-auto my-auto flex w-full max-w-[460px] flex-col items-center py-4";

  // ---------- after the upgrade ----------
  if (paidReturn || (finish && !run)) {
    if (finish?.step === "done") return <div className={screen}><div className={column}><Finished run={finish} /></div></div>;
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
      <div className={screen}><div className={column} ref={plansRef}>
        <p className="mb-4 text-center text-[14px] text-white/70" role="status">{notice}</p>
        <video src={EXAMPLE_VIDEO} controls playsInline className="mx-auto aspect-[9/16] w-full max-w-[280px] rounded-3xl border border-white/10 bg-black object-cover" />
        <Plans hasVideo={false} />
        <button type="button" onClick={() => leave(true)} className="mt-4 text-[13px] font-semibold text-white/40">Not now</button>
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
    if (run.step !== "done") return <div className={screen}><div className={column}><Dots step={3} /><div className="mt-6 w-full"><Rendering run={run} /></div></div></div>;
    return (
      <div className={screen}><div className={column} ref={plansRef}>
        {!locked && <Confetti />}
        <h1 className="mb-4 text-center text-[26px] font-black leading-tight tracking-tight text-white">Your first video is coming to life 🎉</h1>
        <PreviewPlayer src={run.finalUrl} poster={locked ? run.poster : undefined} locked={locked} onEnded={clipEnded} onUnlock={showPlans} />
        {!locked && <p className="mt-3 flex items-center gap-1.5 text-[13px] text-white/50"><Volume2 className="h-4 w-4" /> Your free 10-second preview</p>}
        {locked && <Plans runId={run.id} hasVideo />}
        <button type="button" onClick={() => leave(false)} className="mt-5 text-[13px] font-semibold text-white/40">Not now</button>
      </div></div>
    );
  }

  // ---------- steps 1 and 2: pick, then Generate. Everything but the one thing to tap is dimmed ----------
  const step = picked ? 2 : 1;
  return (
    <div className={screen} data-testid="first-video-tutorial">
      <div className="flex items-center justify-between">
        <Dots step={step} />
        <button type="button" data-testid="first-video-skip" onClick={() => leave(true)} className="text-[13px] font-semibold text-white/40 transition hover:text-white/70">Skip</button>
      </div>
      <div className={column}>
        <h1 className="text-center text-[27px] font-black leading-tight tracking-tight text-white">Pick your first video</h1>
        <p className="mt-1.5 text-center text-[14.5px] font-semibold text-lime-200" data-testid="first-video-free-line">You'll get a free 10-second preview. No credits, no card.</p>
        {step === 1 && <div className="mt-4"><Bubble>Pick an idea</Bubble></div>}
        <div className="mt-4 grid w-full grid-cols-3 gap-2.5">
          {(state.topics ?? []).map((t) => (
            <button key={t.key} type="button" data-testid="first-video-topic" data-topic={t.key} aria-pressed={picked === t.key}
              onClick={() => { setPicked(t.key); trackFunnel("tutorial_step_completed", { step: 1, topic: t.key }); }}
              className={`relative aspect-[9/16] overflow-hidden rounded-2xl border-2 bg-black text-left transition active:scale-[.97] ${picked === t.key ? "border-lime-300" : step === 1 ? "border-lime-300/40 ring-4 ring-lime-300/15" : "border-white/10 opacity-30"}`}>
              {t.clipUrl ? <video src={t.clipUrl} poster={t.poster} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" /> : t.poster && <img src={t.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-8 text-[13px] font-black leading-tight text-white">{t.topic}</span>
            </button>
          ))}
        </div>
        {step === 2 && <div className="mt-5"><Bubble>Now hit Generate</Bubble></div>}
        {notice && <p className="mt-3 text-center text-[13px] text-red-300" role="alert">{notice}</p>}
        <button type="button" disabled={!picked || starting} onClick={generate} data-testid="first-video-generate"
          className={`mt-4 inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl text-[18px] font-black transition ${picked ? "bg-lime-300 text-[#11150D] shadow-[0_0_44px_rgba(190,242,100,0.45)] hover:bg-lime-200" : "bg-white/10 text-white/25"}`}>
          {starting && <Loader2 className="h-5 w-5 animate-spin" />} Generate
        </button>
      </div>
    </div>
  );
}
