import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { PRICING_PLANS, TIER_MIN_PLAN, LONG_FORM_LENGTHS, V2_OUTPUT_COSTS, recommendPlan } from "../../lib/pricingOutputs";
import { longFormVideoCredits } from "../../lib/longFormTiers";
import { formatMoney, planPriceView } from "../../lib/planPrices";
import { PLAN_LABELS } from "../../lib/planGating";
import KeyButton from "../ui/zyvo/KeyButton";
import { FOCUS, cx } from "../ui/zyvo/styles";
import { DISPLAY_FONT, subscribe } from "./PlanCards";
import { LoadError, usePricingData } from "./PricingData";

// What people make. "other" opens three more tools. Counts are per month.
const MAIN = [
  { id: "fruit", label: "AI Fruit TikToks", max: 60, start: 8 },
  { id: "longForm", label: "Long Form YouTube videos", max: 20, start: 2 },
  { id: "clay", toolKey: "clayRescue", label: "Clay Rescue", max: 60, start: 6 },
  { id: "face", toolKey: "faceAsmr", label: "Face ASMR", max: 60, start: 6 },
];
const OTHER = [
  { id: "micro", toolKey: "microCamera", label: "Micro Camera Animal", max: 60, start: 4 },
  { id: "swap", toolKey: "nationalitySwap", label: "Kit Swap", max: 60, start: 4 },
  { id: "images", toolKey: "imageGenerator", label: "Zyvo V2 images", max: 300, start: 30 },
];
const ALL = [...MAIN, ...OTHER];

function Stepper({ n, children }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[10px] font-black text-[#11150D]">{n}</span>
      {children}
    </p>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cx("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-bold transition", FOCUS,
        on ? "border-lime-300/45 bg-lime-300/[0.09] text-white" : "border-white/[0.08] bg-white/[0.035] text-white/55 hover:text-white/80")}>
      <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded border", on ? "border-lime-300 bg-lime-300 text-[#11150D]" : "border-white/25")} aria-hidden="true">
        {on && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}

function TierPick({ tiers, value, onChange, label }) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-[#0E1012] p-0.5" role="group" aria-label={`${label} quality`}>
      {tiers.map((t) => (
        <button key={t.id} type="button" disabled={t.credits == null} aria-pressed={value === t.id} onClick={() => onChange(t.id)}
          title={`${t.id.toUpperCase()} needs ${PLAN_LABELS[TIER_MIN_PLAN[t.id]]} or higher`}
          className={cx("rounded-md px-2 py-1 text-[10.5px] font-black transition disabled:opacity-30", FOCUS,
            value === t.id ? "bg-white text-black" : "text-white/45 hover:text-white/75")}>
          {t.id.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function PlanFinder() {
  const data = usePricingData();
  const { costs, lf, prices, billing, fruit, account } = data;
  const [picked, setPicked] = useState({ fruit: true, longForm: true });
  const [showOther, setShowOther] = useState(false);
  const [counts, setCounts] = useState(() => Object.fromEntries(ALL.map((i) => [i.id, i.start])));
  const [tiers, setTiers] = useState(() => Object.fromEntries(ALL.map((i) => [i.id, "v2"])));
  const [minutes, setMinutes] = useState(10);

  const unitCredits = (item, tier) => {
    if (item.id === "longForm") return longFormVideoCredits(lf.tiers, tier, minutes);
    const key = item.id === "fruit" ? fruit.key : item.toolKey;
    return costs.costs?.finder?.[key]?.[tier] ?? null;
  };
  const tiersOf = (item) => {
    const ids = item.id === "longForm" ? ["v2", "v3", "v4"] : Object.keys(V2_OUTPUT_COSTS[item.id === "fruit" ? fruit.key : item.toolKey].finder.tiers);
    return ids.map((id) => ({ id, credits: unitCredits(item, id) }));
  };
  const unitName = (item) => item.id === "fruit" ? `AI Fruit TikToks (${fruit.headline.sec} s)` : item.id === "longForm" ? `YouTube videos (${minutes} min)` : item.label;

  const active = ALL.filter((i) => picked[i.id]);
  const lines = active.map((item) => ({ item, tier: tiers[item.id], count: counts[item.id], credits: unitCredits(item, tiers[item.id]) }));
  const ready = lines.every((l) => l.credits != null);
  const result = useMemo(() => (ready ? recommendPlan(lines.map((l) => ({ credits: l.credits, count: l.count, tier: l.tier }))) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, JSON.stringify(lines.map((l) => [l.credits, l.count, l.tier]))]);

  const loadFailed = costs.status === "error" || lf.status === "error";
  const view = result && prices.status === "ready" ? planPriceView(prices.prices, result.plan, billing) : null;
  const pct = result ? Math.min(100, Math.round((result.needed / result.credits) * 100)) : 0;
  const cheapestPack = prices.status === "ready" ? Object.values(prices.prices.topups).sort((a, b) => a.price - b.price)[0] : null;

  return (
    <section id="plan-finder" aria-labelledby="finder-title" className="scroll-mt-24 rounded-[28px] border border-lime-300/[0.13] bg-[#0C0F0D] p-5 shadow-[inset_0_1px_0_rgba(190,242,100,.05)] sm:p-7">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300">Plan finder</p>
      <h2 id="finder-title" style={DISPLAY_FONT} className="mt-1 text-[34px] font-extrabold uppercase leading-none text-white sm:text-[40px]">Not sure which plan?</h2>
      <p className="mt-2 max-w-[60ch] text-[13px] text-white/50">Pick what you make and how many a month. We&apos;ll suggest the cheapest plan that covers it, from today&apos;s live prices.</p>
      {loadFailed && <LoadError onRetry={() => { costs.retry(); lf.retry(); }} className="mt-3" />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <Stepper n={1}>What do you make?</Stepper>
          <div className="grid grid-cols-2 gap-2">
            {MAIN.map((i) => <Chip key={i.id} on={Boolean(picked[i.id])} onClick={() => setPicked((p) => ({ ...p, [i.id]: !p[i.id] }))}>{i.label}</Chip>)}
            <Chip on={showOther} onClick={() => { setShowOther((s) => !s); if (showOther) setPicked((p) => ({ ...p, micro: false, swap: false, images: false })); }}>Other tools</Chip>
          </div>
          {showOther && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {OTHER.map((i) => <Chip key={i.id} on={Boolean(picked[i.id])} onClick={() => setPicked((p) => ({ ...p, [i.id]: !p[i.id] }))}>{i.label}</Chip>)}
            </div>
          )}

          <div className="mt-6">
            <Stepper n={2}>How many a month?</Stepper>
            {!active.length && <p className="text-[13px] text-white/40">Pick at least one thing above.</p>}
            <div className="space-y-4">
              {active.map((item) => {
                const id = `finder-${item.id}`;
                return (
                  <div key={item.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor={id} className="text-[13px] font-bold text-white/80">{unitName(item)}</label>
                      <TierPick label={item.label} tiers={tiersOf(item)} value={tiers[item.id]} onChange={(t) => setTiers((s) => ({ ...s, [item.id]: t }))} />
                    </div>
                    {item.id === "longForm" && (
                      <div className="mt-2 flex gap-1" role="group" aria-label="Video length">
                        {LONG_FORM_LENGTHS.map((m) => (
                          <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(m)}
                            className={cx("rounded-md border px-2 py-0.5 text-[11px] font-bold", FOCUS, minutes === m ? "border-lime-300/45 bg-lime-300/[0.09] text-lime-300" : "border-white/[0.08] text-white/45")}>{m} min</button>
                        ))}
                      </div>
                    )}
                    <div className="mt-2.5 flex items-center gap-3">
                      <input id={id} type="range" min={0} max={item.max} value={counts[item.id]}
                        onChange={(e) => setCounts((c) => ({ ...c, [item.id]: Number(e.target.value) }))}
                        className="h-1.5 w-full cursor-pointer accent-lime-400" aria-valuetext={`${counts[item.id]} a month`} />
                      <span className="w-12 shrink-0 text-right text-[15px] font-black tabular-nums text-lime-300">{counts[item.id]}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-white/35">
                      {unitCredits(item, tiers[item.id]) == null ? "Loading price…" : `${unitCredits(item, tiers[item.id]).toLocaleString("en-US")} credits each`}
                      {tiers[item.id] !== "v2" && ` · ${tiers[item.id].toUpperCase()} needs ${PLAN_LABELS[TIER_MIN_PLAN[tiers[item.id]]]} or higher`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside aria-live="polite" className="h-fit rounded-2xl border border-white/[0.08] bg-[#111314] p-5 lg:sticky lg:top-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Your best fit</p>
          {!result ? (
            <p className="mt-3 text-[13px] text-white/45">{active.length ? "Loading live prices…" : "Pick what you make to see a plan."}</p>
          ) : (
            <>
              <p style={DISPLAY_FONT} className="mt-1 text-[44px] font-extrabold uppercase leading-none text-lime-300">{PRICING_PLANS[result.plan].name}</p>
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-[12px] font-semibold">
                  <span className="text-white/55">Credits used</span>
                  <span className="tabular-nums text-white">{result.needed.toLocaleString("en-US")} / {result.credits.toLocaleString("en-US")}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={result.credits} aria-valuenow={Math.min(result.needed, result.credits)} aria-label="Monthly credits used">
                  <div className={cx("h-full rounded-full", result.fits ? "bg-lime-300" : "bg-orange-300")} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <ul className="mt-4 space-y-1.5 text-[12px] text-white/60">
                {lines.filter((l) => l.count > 0).map((l) => (
                  <li key={l.item.id} className="flex justify-between gap-3">
                    <span>{l.count} × {unitName(l.item)} · {l.tier.toUpperCase()}</span>
                    <span className="shrink-0 tabular-nums text-white/80">{(l.count * l.credits).toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
              {!result.fits && (
                <p className="mt-3 rounded-lg border border-orange-300/20 bg-orange-300/[0.06] p-2.5 text-[12px] text-orange-200/90">
                  Even {PRICING_PLANS[result.plan].name} runs short by {result.shortBy.toLocaleString("en-US")} credits a month.
                  {cheapestPack && ` Add credit packs (from ${formatMoney(cheapestPack.price, prices.prices.currency)} for ${cheapestPack.credits} credits) or make fewer.`}
                </p>
              )}
              <p className="mt-4 text-[13px] text-white/55">
                {view ? <><span className="text-[20px] font-black text-white">{formatMoney(view.perMonth, prices.prices.currency)}</span> /month{billing === "yearly" ? ", billed yearly" : ""}</> : prices.status === "error" ? "Prices unavailable" : "…"}
              </p>
              <div className="mt-3">
                {account.signedIn && account.plan === result.plan
                  ? <KeyButton variant="outline" disabled>You&apos;re on this plan</KeyButton>
                  : <KeyButton onClick={() => subscribe({ planId: result.plan, billing, account })}>Get {PRICING_PLANS[result.plan].name}</KeyButton>}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
