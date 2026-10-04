// teaser.jsx — the free Long Form teaser (free accounts): a loading screen with
// the real steps, then the title, the hook and 3 drawn scenes, then an upgrade
// card. It is a PREVIEW of the video that could be made — nothing is
// researched, voiced or rendered, and the page never says the video exists.
// Server: long-form-teaser (one cheap model call + 3 V2 scenes, capped at $0.02).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clapperboard, Loader2, Mic, Image as ImageIcon, Sparkles, Type } from "lucide-react";
import usePlanCode from "../../../hooks/usePlanCode";
import { supabase } from "../../../lib/supabaseClient";
import { usePlanPrices, formatMoney } from "../../../lib/planPrices";
import { useLongFormTiers } from "../../../lib/longFormTiers";
import { longFormVideoCredits } from "../../../lib/longFormTiers";
import { startCheckout } from "../../../lib/payments";
import { PLAN_PRICE_IDS, PLAN_CREDITS } from "../../../../supabase/functions/_shared/stripePlanPrices.js";
import { trackLaunch } from "../../../components/launch/launch";
import { getTeaser, teaserEvent, teaserSteps, teaserBusy, fullVideoFacts } from "./teaserApi";

const CSS = `
@keyframes zyvoTeaserIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes zyvoTeaserSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
.zyvo-teaser-in { animation: zyvoTeaserIn .55s cubic-bezier(.2,.8,.2,1) both; }
.zyvo-teaser-sweep::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(190,242,100,.10) 50%, transparent 70%); animation: zyvoTeaserSweep 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .zyvo-teaser-in { animation: none; } .zyvo-teaser-sweep::after { animation: none; display: none; } }
`;

function Step({ step }) {
  const tone = step.state === "done" ? "text-white" : step.state === "active" ? "text-lime-300" : "text-white/35";
  return (
    <li className={`flex items-center gap-2.5 text-[14px] font-semibold ${tone}`} data-state={step.state}>
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${step.state === "done" ? "bg-lime-300 text-[#11150D]" : "border border-white/15"}`}>
        {step.state === "done" ? <Check className="h-3 w-3" strokeWidth={3.5} /> : step.state === "active" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      </span>
      {step.label}
    </li>
  );
}

function SceneTile({ scene, index, busy }) {
  const ready = scene?.status === "ready" && scene.imageUrl;
  const skipped = scene?.status === "failed" || scene?.status === "skipped";
  return (
    <div className="relative aspect-video overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10]" data-testid="teaser-scene" data-status={scene?.status ?? "waiting"}>
      {ready ? (
        <img src={scene.imageUrl} alt={`Preview scene ${index + 1}`} width="1376" height="768" className="zyvo-teaser-in h-full w-full object-cover" />
      ) : (
        <div className={`absolute inset-0 grid place-items-center ${busy && !skipped ? "zyvo-teaser-sweep" : ""}`}>
          <span className="text-[12px] font-semibold text-white/35">{skipped ? "This scene couldn't be drawn" : `Scene ${index + 1}`}</span>
        </div>
      )}
      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-white/85">Scene {index + 1}</span>
    </div>
  );
}

function UpgradeCard({ teaser, account }) {
  const { minutes, scenes } = fullVideoFacts(teaser);
  const prices = usePlanPrices();
  const tiers = useLongFormTiers();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const starter = prices.status === "ready" ? prices.prices?.plans?.starter : null;
  const perVideo = tiers.status === "ready" ? longFormVideoCredits(tiers.tiers, "v2", minutes) : null;
  const videos = perVideo ? Math.floor(PLAN_CREDITS.starter / perVideo) : null;
  const upgrade = async () => {
    setBusy(true); setError(null);
    trackLaunch("teaser_upgrade_clicked", { placement: "long_form_teaser", target: "starter", teaserId: teaser.id });
    teaserEvent(teaser.id, "upgrade_clicked");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setError("Please sign in again."); return; }
    // After payment: back to this video's setup, which starts the full generation (charged normally).
    const back = `${window.location.origin}/long-form/create?start=1&teaser=${teaser.id}`;
    try {
      await startCheckout({ type: "subscription", priceId: PLAN_PRICE_IDS.starter.monthly, userId: user.id, email: user.email, metadata: { email: user.email, plan: "starter", teaserId: teaser.id }, successUrl: back, cancelUrl: `${window.location.origin}/long-form/teaser/${teaser.id}` });
    } catch { setError("Couldn't open the checkout. Try again."); }
    setBusy(false);
  };
  return (
    <section className="zyvo-teaser-in rounded-[22px] border border-lime-300/30 bg-lime-300/[0.05] p-5 sm:p-7" data-testid="teaser-upgrade">
      <h2 className="text-balance text-[22px] font-black leading-tight tracking-tight text-white sm:text-[26px]">Your full video is ready to be made</h2>
      <p className="mt-2 text-[14.5px] leading-6 text-white/70">~{minutes} minutes, ~{scenes} scenes, voiceover, thumbnails. This preview is only three sample pictures: the script, the voice and every scene are made when you start it.</p>
      <ul className="mt-4 grid gap-2 text-[13.5px] text-white/80 sm:grid-cols-2">
        {[[Type, "Researched, fact-checked script"], [Mic, "Voiceover in the voice you picked"], [ImageIcon, `About ${scenes} drawn scenes`], [Clapperboard, "1080p video, 3 thumbnails, YouTube text"]].map((fact) => {
          const FactIcon = fact[0];
          return <li key={fact[1]} className="flex items-center gap-2"><FactIcon className="h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" /> {fact[1]}</li>;
        })}
      </ul>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        {account.isPaid ? (
          <button type="button" data-testid="teaser-make-full" onClick={() => navigate(`/long-form/create?teaser=${teaser.id}`)}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-lime-300 px-6 text-[15px] font-black text-[#11150D] transition hover:bg-lime-200">
            Make the full video <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" data-testid="teaser-upgrade-button" disabled={busy} onClick={upgrade}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-lime-300 px-6 text-[15px] font-black text-[#11150D] shadow-[0_0_40px_rgba(190,242,100,0.18)] transition hover:bg-lime-200 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Upgrade to Starter
          </button>
        )}
        {!account.isPaid && (
          <p className="text-[13px] leading-5 text-white/60" data-testid="teaser-price">
            {starter ? <><span className="text-[17px] font-black text-white">{formatMoney(starter.monthly, prices.prices.currency)}</span> / month{prices.prices.vatIncluded ? ", VAT included" : ""}.</> : "Starter plan."}
            {videos ? <> {PLAN_CREDITS.starter.toLocaleString("en-US")} credits a month, about {videos} videos of this length.</> : null}
          </p>
        )}
      </div>
      {error && <p className="mt-3 text-[12.5px] text-red-300">{error}</p>}
      {!account.isPaid && <p className="mt-3 text-[12px] text-white/45">After payment you come straight back here and the full video starts. <Link to="/workspace/pricing" className="underline underline-offset-2 hover:text-white/70">See all plans</Link></p>}
    </section>
  );
}

export default function LongFormTeaser() {
  const { id } = useParams();
  const account = usePlanCode();
  const [teaser, setTeaser] = useState(null);
  const [missing, setMissing] = useState(false);
  const finishedTracked = useRef(false);
  const load = useCallback(async () => {
    const r = await getTeaser(id);
    if (r.ok) setTeaser(r.teaser); else if (r.status === 404 || r.status === 401) setMissing(true);
    return r;
  }, [id]);
  useEffect(() => { document.title = "Your video preview | Zyvo"; load(); }, [load]);
  const busy = teaserBusy(teaser);
  useEffect(() => { if (!busy || missing) return undefined; const t = setInterval(load, 1500); return () => clearInterval(t); }, [busy, missing, load]);
  // Funnel: finished (once per teaser per browser).
  useEffect(() => {
    if (!teaser || teaser.status !== "done" || finishedTracked.current) return;
    finishedTracked.current = true;
    try { const k = `zyvo:teaser-finished:${teaser.id}`; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* track once this load */ }
    trackLaunch("teaser_finished", { placement: "long_form_teaser", target: teaser.niche, teaserId: teaser.id });
  }, [teaser]);

  if (missing) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center">
        <h1 className="text-[22px] font-black text-white">This preview isn't available</h1>
        <p className="mt-2 text-[14px] text-white/55">Sign in with the account that made it.</p>
        <Link to="/long-form/create" className="mt-6 inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-lime-300 px-5 text-[14px] font-black text-[#11150D]">Start a video</Link>
      </div>
    );
  }
  const steps = teaserSteps(teaser);
  const scenes = Array.from({ length: teaser?.sceneCount ?? 3 }, (_, i) => teaser?.scenes?.[i] ?? null);
  const failed = teaser?.status === "failed";
  const done = teaser?.status === "done";
  return (
    <div className="mx-auto max-w-[980px] px-4 pb-28 pt-6 lg:px-8 lg:pb-16" data-testid="teaser-page" data-status={teaser?.status ?? "loading"}>
      <style>{CSS}</style>
      <Link to="/long-form/create" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/55 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to your video setup</Link>

      <header className="mt-5">
        <p className="inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-lime-300">Free preview</p>
        {teaser?.title ? (
          <h1 className="zyvo-teaser-in mt-3 text-balance text-[28px] font-black leading-[1.1] tracking-tight text-white sm:text-[38px]" data-testid="teaser-title">{teaser.title}</h1>
        ) : (
          <h1 className="mt-3 text-[26px] font-black tracking-tight text-white sm:text-[34px]">{failed ? "We couldn't make this preview" : "Making your preview…"}</h1>
        )}
        {teaser?.hook && <p className="zyvo-teaser-in mt-3 max-w-[60ch] text-[16px] leading-7 text-white/75 sm:text-[17px]" data-testid="teaser-hook">“{teaser.hook}”</p>}
        {!teaser?.title && !failed && <p className="mt-2 text-[14px] text-white/50">{teaser?.topic ?? "One moment."}</p>}
      </header>

      {busy && (
        <ol className="mt-6 grid gap-2.5 rounded-[18px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 sm:p-5" data-testid="teaser-steps" aria-live="polite">
          {steps.map((s) => <Step key={s.key} step={s} />)}
        </ol>
      )}

      {failed ? (
        <div className="mt-6 rounded-[18px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[14px] text-white/70">{teaser.error}</p>
          <Link to="/long-form/create" className="mt-4 inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-lime-300 px-5 text-[14px] font-black text-[#11150D]">Try again</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="teaser-scenes">
          {scenes.map((s, i) => <SceneTile key={i} scene={s} index={i} busy={busy} />)}
        </div>
      )}

      {done && (
        <>
          <p className="mt-4 text-[12.5px] leading-5 text-white/50" data-testid="teaser-honest">This is a free preview: a title, an opening line and three sample scenes. Nothing has been researched, voiced or rendered yet.</p>
          <div className="mt-6"><UpgradeCard teaser={teaser} account={account} /></div>
        </>
      )}
    </div>
  );
}
