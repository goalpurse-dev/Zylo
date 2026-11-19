// The new-user tutorial with premade examples (owner, 2026-11-19): nothing is generated for the user. Pick an example,
// watch it in full (clearly labelled "Example made with Zyvo"), then "Make your own like this" with the real price,
// the launch deal's first month while it runs. The examples live in src/data/onboardingExamples.js.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Compass, Gift, Hand, Loader2, Play, Scale, Sparkles, VolumeX } from "lucide-react";
import { startCheckout } from "../../lib/payments";
import usePaymentAction from "../../hooks/usePaymentAction";
import { formatMoney, usePlanPrices } from "../../lib/planPrices";
import { PRICING_PLANS } from "../../lib/pricingOutputs";
import { useSignupBonus } from "../../lib/useSignupBonus";
import { LAUNCH_DEAL, launchDealForViewer, launchDealPrice, useLaunchDeal } from "../../lib/useLaunchDeal";
import { FIRST_VIDEO_PATH, trackFunnel } from "../../lib/onboarding";
import { exampleByKey, examplesFor } from "../../lib/exampleChoice";
import { Confetti } from "./FirstGenFlow.jsx";
import ComparePlansSheet from "./ComparePlansSheet.jsx";
import { RECOMMENDED_PLAN } from "./planChoice";
import "./onboarding.css";

const OTHER_PLANS = ["pro", "generative"];
const LOOP_SEC = 5;      // a card plays this much of its video, over and over
const SKIP_AFTER_SEC = 8; // "Skip to the plans" shows up after this much of the example
const QUIET = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-2 text-[14px] font-bold text-white/80 transition hover:border-white/35 hover:text-white";
const NEW_CUSTOMER = { hasSub: false, isPaid: false }; // only free accounts reach the tutorial

function Dots({ step }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 3`}>
      {[1, 2, 3].map((n) => <span key={n} className={`h-2 rounded-full transition-all ${n === step ? "w-6 bg-lime-300" : n < step ? "w-2 bg-lime-300/60" : "w-2 bg-white/15"}`} />)}
    </div>
  );
}

function Bubble({ children }) {
  return (
    <p className="ob-nudge relative inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-[#1C1F1C] px-4 py-2 text-[14px] font-semibold text-white/85" role="status" data-testid="first-video-bubble">
      <Hand className="h-4 w-4 text-lime-300" aria-hidden="true" /> {children}
      <span className="absolute -bottom-[6px] left-1/2 h-[11px] w-[11px] -translate-x-1/2 rotate-45 border-b border-r border-white/15 bg-[#1C1F1C]" aria-hidden="true" />
    </p>
  );
}

export function ExampleBadge({ small = false }) {
  return (
    <span className={`absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/75 font-black uppercase tracking-wide text-white backdrop-blur-sm ${small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`} data-testid="example-badge">
      <Sparkles className={small ? "h-3 w-3 text-lime-300" : "h-3.5 w-3.5 text-lime-300"} aria-hidden="true" /> Example made with Zyvo
    </span>
  );
}

// A card's moving picture: muted, the first seconds over and over. Asked for less motion: the still.
function CardClip({ example }) {
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) return <img src={example.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  return <video ref={(el) => { if (el) { el.muted = true; el.setAttribute("muted", ""); } }} src={example.loop || example.video} poster={example.poster} muted loop autoPlay playsInline preload="metadata" disablePictureInPicture data-testid="example-card-clip"
    onTimeUpdate={example.loop ? undefined : (e) => { if (e.currentTarget.currentTime >= LOOP_SEC) e.currentTarget.currentTime = 0; }} className="absolute inset-0 h-full w-full object-cover" />;
}

// The example, big, with sound when the browser allows it.
function ExamplePlayer({ example, onEnded, onProgress }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
  }, [example.key]);
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[330px] overflow-hidden rounded-3xl border border-white/10 bg-black" data-testid="example-player">
      <ExampleBadge />
      <video ref={ref} src={example.video} poster={example.poster} playsInline controlsList="nodownload" disablePictureInPicture onEnded={onEnded}
        onTimeUpdate={(e) => onProgress(e.currentTarget.currentTime)} muted={muted} className="h-full w-full object-cover" onContextMenu={(e) => e.preventDefault()} />
      {muted && (
        <button type="button" data-testid="example-sound" onClick={() => { const v = ref.current; if (v) { v.muted = false; v.play().catch(() => {}); } setMuted(false); }}
          className="absolute left-1/2 top-12 flex -translate-x-1/2 items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-[14px] font-black text-[#11150D] shadow-lg">
          <VolumeX className="h-4 w-4" /> Tap for sound
        </button>
      )}
    </div>
  );
}

function Tick() {
  return <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime-300/20 text-lime-300"><Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /></span>;
}

/** "Sunday" in the viewer's own time zone: the day the launch deal ends for them. */
const dealEndDay = () => new Date(LAUNCH_DEAL.endsAt).toLocaleDateString("en-US", { weekday: "long" });

// "Make your own like this": the real price (the deal's first month while it runs: lib/useLaunchDeal, the same file
// checkout reads), one big button to Starter, the other plans, Compare, and a free way to look around.
function MakeYourOwn({ example, adminLook, onExplore }) {
  const prices = usePlanPrices();
  const bonus = useSignupBonus();
  const deal = useLaunchDeal();
  const pay = usePaymentAction();
  const [adminNote, setAdminNote] = useState(false);
  const [comparing, setComparing] = useState(false);
  const closeCompare = useCallback(() => setComparing(false), []);
  const plan = (id) => (prices.status === "ready" ? prices.prices?.plans?.[id] : null);
  const money = (n) => formatMoney(n, prices.prices?.currency);
  const priceOf = (id) => { const p = plan(id); return p ? money(p.monthly) : "…"; };
  const dealOn = launchDealForViewer(deal, NEW_CUSTOMER);
  const firstMonth = (id) => (dealOn && id === LAUNCH_DEAL.plan && plan(id) ? money(launchDealPrice(plan(id).monthly)) : null);
  const videosFor = (id) => Math.max(1, Math.floor(PRICING_PLANS[id].credits / example.credits));
  const main = PRICING_PLANS[RECOMMENDED_PLAN];

  const choose = (planId) => (adminLook ? setAdminNote(true) : pay.run(planId, () => {
    trackFunnel("checkout_opened", { plan: planId, example: example.key, deal: Boolean(firstMonth(planId)) });
    // paid: the normal success page (nothing to finish here). Back without paying: this screen again, same example.
    return startCheckout({ type: "subscription", planId, billing: "monthly", cancelUrl: `${window.location.origin}${FIRST_VIDEO_PATH}?plans=1&example=${encodeURIComponent(example.key)}` });
  }));
  const priceLine = (id) => (firstMonth(id) ? `${firstMonth(id)} your first month, then ${priceOf(id)} a month` : `${priceOf(id)} a month`);

  return (
    <section className="ob-fade w-full" data-testid="first-video-upgrade" id="first-video-plans" data-example={example.key}>
      <p className="hidden items-center gap-2 text-[13px] font-black text-lime-300 md:flex">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" /></span> Level 1 complete: you've seen what Zyvo makes
      </p>
      <h1 className="text-center text-[28px] font-black leading-[1.08] tracking-tight text-white md:mt-3 md:text-left md:text-[38px]">Make your own like this</h1>
      <p className="mt-1.5 text-center text-[14.5px] text-white/65 md:text-left">{example.niche}. Type your idea: Zyvo writes it, voices it and makes every scene.</p>
      {dealOn && plan(LAUNCH_DEAL.plan) && (
        <div className="mt-3 rounded-xl border border-lime-300/50 bg-lime-300/[0.1] px-3 py-2.5 text-center text-[13.5px] font-black text-lime-200 md:text-left" data-testid="example-deal">
          <span className="mr-1.5 rounded-md bg-lime-300 px-1.5 py-0.5 text-[11px] text-[#0B0D0F]">{deal.percentOff}% off</span>
          Launch deal: {main.name} is <span className="text-white/45 line-through">{priceOf(LAUNCH_DEAL.plan)}</span> {firstMonth(LAUNCH_DEAL.plan)} your first month. Ends {dealEndDay()} · <span className="font-mono tabular-nums">{deal.countdown}</span> left
        </div>
      )}
      {bonus.line && (
        <div className="mt-2.5 flex items-center justify-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/[0.06] px-3 py-2 text-center text-[13px] font-bold text-lime-200 md:justify-start md:text-left" data-testid="first-video-bonus">
          <Gift className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /> <span>{bonus.head}<span className="whitespace-nowrap">{bonus.tail}</span></span>
        </div>
      )}
      {/* Phones: stuck to the bottom of the screen while scrolling. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090A0A]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:mt-3 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none" data-testid="first-video-cta-bar">
        <button type="button" disabled={pay.busy != null} onClick={() => { trackFunnel("upgrade_click", { button: "make_own", example: example.key }); choose(RECOMMENDED_PLAN); }} data-testid="first-video-plan-button" data-plan={RECOMMENDED_PLAN}
          className="ob-cta-pulse block min-h-[68px] w-full rounded-[20px] bg-lime-300 px-3 py-2.5 text-center text-[#11150D] transition hover:bg-lime-200 disabled:opacity-60 md:min-h-[72px]">
          <span className="flex items-center justify-center gap-2 text-[22px] font-black leading-tight md:text-[23px]">{pay.busy === RECOMMENDED_PLAN && <Loader2 className="h-5 w-5 animate-spin" />} Make my own video</span>
          <span className="mt-0.5 block text-[13.5px] font-bold" data-testid="example-cta-price">{main.name}: {priceLine(RECOMMENDED_PLAN)}</span>
        </button>
      </div>
      <ul className="mt-3.5 grid gap-2 text-[14.5px] font-semibold leading-snug text-white/90">
        <li className="flex justify-center gap-2.5 md:justify-start"><Tick /><span><b className="text-lime-300">{main.credits.toLocaleString("en-US")} credits every month:</b> about {videosFor(RECOMMENDED_PLAN)} videos like this one.</span></li>
        <li className="hidden gap-2.5 md:flex"><Tick /><span><b className="text-lime-300">Every template included:</b> stories, explainers, images and more.</span></li>
      </ul>
      <p className="mt-3 hidden flex-wrap justify-center gap-x-2.5 gap-y-1 text-[12px] font-semibold text-white/55 md:flex" data-testid="first-video-trust"><span>Cancel anytime</span><span>·</span><span>Secure payment by Stripe</span><span>·</span><span>Apple Pay &amp; Google Pay</span></p>
      <div className="mt-4 hidden gap-2 border-t border-white/10 pt-3.5 md:grid md:grid-cols-2" data-testid="first-video-other-plans">
        {OTHER_PLANS.map((id) => (
          <button key={id} type="button" disabled={pay.busy != null} onClick={() => { trackFunnel("upgrade_click", { button: `plan:${id}`, example: example.key }); choose(id); }} data-testid="first-video-plan-button" data-plan={id}
            className="flex min-h-[48px] flex-col justify-center rounded-xl border border-white/15 px-3 py-2 text-left text-[13px] text-white/70 transition hover:border-white/30 disabled:opacity-60">
            <span className="flex items-center justify-between gap-2"><b className="text-white">{PRICING_PLANS[id].name}</b><span>{priceOf(id)} a month</span></span>
            <span className="text-[12px] text-white/50">about {videosFor(id)} videos like this a month</span>
          </button>
        ))}
      </div>
      {adminNote && <p className="mt-3 text-center text-[13px] font-bold text-amber-200" role="status">Admin preview: a customer goes to Stripe here.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { trackFunnel("upgrade_click", { button: "compare", example: example.key }); setComparing(true); }} data-testid="first-video-compare" className={QUIET}><Scale className="h-4 w-4" aria-hidden="true" /> Compare plans</button>
        <button type="button" onClick={() => { trackFunnel("upgrade_click", { button: "explore", example: example.key }); onExplore(); }} data-testid="first-video-explore" className={QUIET}><Compass className="h-4 w-4" aria-hidden="true" /> Explore Zyvo first</button>
      </div>
      <p className="mt-2 text-center text-[12.5px] leading-snug text-white/50 pb-28 md:pb-0">Free to look around: 5 free images and every template to browse.</p>
      {comparing && <ComparePlansSheet prices={prices} choose={(id) => { trackFunnel("compare_plan_click", { plan: id, example: example.key }); choose(id); }} busy={pay.busy} adminNote={adminNote} onClose={closeCompare}
        note="Monthly prices, cancel anytime." creditsEach={example.credits} firstMonth={firstMonth} />}
    </section>
  );
}

/**
 * goals: the survey's "What do you want to make?" answers. startKey + startOnPlans: back from Stripe without paying
 * (?plans=1&example=<key>), straight to the plans with the same example. onLeave(skipped): to Home.
 */
export default function ExampleTutorial({ goals = [], startKey = null, startOnPlans = false, adminLook = false, adminBar = null, onLeave }) {
  const examples = useMemo(() => examplesFor(goals), [goals]);
  const [picked, setPicked] = useState(() => (startOnPlans ? exampleByKey(startKey) : null));
  const [stage, setStage] = useState(startOnPlans ? "plans" : "pick"); // pick -> watch -> plans
  const [canSkip, setCanSkip] = useState(false);
  const matched = Array.isArray(goals) && goals.length > 0;

  useEffect(() => {
    if (startOnPlans) trackFunnel("upgrade_screen_shown", { example: picked?.key ?? null, from: "checkout_back" });
    else trackFunnel("tutorial_started", { kind: "example" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toPlans = (watched) => {
    setStage("plans");
    if (watched) trackFunnel("preview_watched_to_end", { example: picked.key });
    trackFunnel("upgrade_screen_shown", { example: picked.key, ...(watched ? {} : { skipped: true }) });
    window.scrollTo({ top: 0 });
  };
  const watch = () => {
    if (!picked) return;
    trackFunnel("tutorial_step_completed", { step: 2, example: picked.key });
    setCanSkip(false);
    setStage("watch");
  };

  const screen = `flex min-h-[100dvh] w-full flex-col bg-[#090A0A] px-4 pb-10 ${adminBar ? "pt-10" : "pt-4"} text-white`;

  if (stage === "plans" && picked) {
    return (
      <div className={screen}>{adminBar}
        <div className="mx-auto my-auto grid w-full max-w-[1000px] items-center gap-4 pt-1 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-12 md:py-2">
          <div className="relative mx-auto aspect-[9/12] w-[52%] max-w-[200px] overflow-hidden rounded-3xl border-2 border-lime-300/55 bg-black shadow-[0_0_44px_rgba(190,242,100,0.28)] md:aspect-[9/16] md:w-full md:max-w-[340px]">
            <ExampleBadge small />
            <video src={picked.video} poster={picked.poster} muted loop autoPlay playsInline disablePictureInPicture ref={(el) => { if (el) el.muted = true; }} className="h-full w-full object-cover" />
          </div>
          <MakeYourOwn example={picked} adminLook={adminLook} onExplore={() => onLeave(false)} />
        </div>
      </div>
    );
  }

  if (stage === "watch" && picked) {
    return (
      <div className={screen} data-testid="example-watch">{adminBar}
        <div className="flex items-center justify-between"><Dots step={3} /><span /></div>
        <div className="mx-auto my-auto flex w-full max-w-[460px] flex-col items-center py-4">
          <Confetti />
          <h1 className="mb-1 text-center text-[24px] font-black leading-tight tracking-tight text-white">{picked.title}</h1>
          <p className="mb-4 text-center text-[13.5px] text-white/60" data-testid="example-label">An example video made with Zyvo. Next: make your own like it.</p>
          <ExamplePlayer example={picked} onEnded={() => toPlans(true)} onProgress={(t) => { if (t >= SKIP_AFTER_SEC && !canSkip) setCanSkip(true); }} />
          <div className="mt-4 flex h-[48px] items-center">
            {canSkip && <button type="button" onClick={() => toPlans(false)} data-testid="example-skip" className="text-[14px] font-bold text-white/55 underline underline-offset-4 transition hover:text-white">Skip to make my own</button>}
          </div>
        </div>
      </div>
    );
  }

  // ---------- pick: everything but the one thing to tap is dimmed ----------
  const step = picked ? 2 : 1;
  return (
    <div className={screen} data-testid="first-video-tutorial" data-kind="example">
      {adminBar}
      <div className="flex items-center justify-between">
        <Dots step={step} />
        <button type="button" data-testid="first-video-skip" onClick={() => onLeave(true)} className="text-[13px] font-semibold text-white/40 transition hover:text-white/70">Skip</button>
      </div>
      <div className="mx-auto my-auto flex w-full max-w-[1000px] flex-col items-center py-2">
        <h1 className="text-center text-[28px] font-black leading-tight tracking-tight text-white md:text-[34px]">See what you can make</h1>
        <p className="mt-1 text-center text-[14.5px] font-semibold text-lime-200" data-testid="example-intro-line">Real videos made with Zyvo. Pick one to watch, then make your own.</p>
        <div className="mt-3 flex h-[42px] items-center">{step === 1 && <Bubble>Pick a video</Bubble>}</div>
        <div className="-mx-4 mt-2 flex w-screen snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] md:mx-auto md:grid md:w-[min(100%,calc((100dvh-340px)*27/16+48px))] md:grid-cols-3 md:gap-6 md:overflow-visible md:p-0">
          {examples.map((e, i) => {
            const on = picked?.key === e.key;
            return (
              <button key={e.key} type="button" data-testid="first-video-topic" data-example={e.key} aria-pressed={on}
                onClick={() => { setPicked(e); trackFunnel("tutorial_step_completed", { step: 1, example: e.key }); }}
                className={`relative aspect-[9/16] w-[min(66vw,calc((100dvh-290px)*9/16))] shrink-0 snap-center overflow-hidden rounded-3xl border-[3px] bg-black text-left transition duration-200 md:w-full ${on ? "ob-pick border-lime-300 shadow-[0_0_40px_rgba(190,242,100,0.5)]" : picked ? "border-white/10 opacity-50 hover:opacity-80" : "border-white/15 hover:-translate-y-1 hover:border-lime-300/60"}`}>
                <CardClip example={e} />
                {i === 0 && matched && <span className="absolute left-2.5 top-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[11.5px] font-black text-lime-300 backdrop-blur-sm">Best match for you</span>}
                {on && <span className="ob-check absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-lg"><Check className="h-5 w-5" strokeWidth={3.5} aria-hidden="true" /></span>}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3.5 pb-3.5 pt-12">
                  <span className="block text-[17px] font-black leading-tight text-white">{e.title}</span>
                  <span className="mt-0.5 block text-[12px] font-semibold text-white/65">{e.niche.split(":")[0]}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="sticky bottom-3 z-10 mt-2 flex w-full max-w-[460px] flex-col items-center md:mt-5">
          {step === 2 && <div className="mb-3"><Bubble>Now hit Watch</Bubble></div>}
          <button type="button" disabled={!picked} onClick={watch} data-testid="first-video-generate"
            className={`inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl text-[19px] font-black transition ${picked ? "ob-cta-pulse bg-lime-300 text-[#11150D] hover:bg-lime-200" : "bg-[#1C1F1C] text-white/30"}`}>
            <Play className="h-5 w-5" /> Watch
          </button>
        </div>
      </div>
    </div>
  );
}
