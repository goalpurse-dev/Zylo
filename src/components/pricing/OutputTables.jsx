import { Fragment, useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import {
  PLAN_ORDER, PRICING_PLANS, V2_OUTPUT_COSTS, LONG_FORM_LENGTHS, LONG_FORM_HEADLINE_MINUTES,
  outputsForPlan, creditsForPlan, longFormOutputs, toolOrderFor,
} from "../../lib/pricingOutputs";
import { longFormVideoCredits } from "../../lib/longFormTiers";
import { formatMoney, planPriceView } from "../../lib/planPrices";
import KeyButton from "../ui/zyvo/KeyButton";
import { FOCUS, cx } from "../ui/zyvo/styles";
import { DISPLAY_FONT, subscribe } from "./PlanCards";
import { LoadError, Num, usePricingData } from "./PricingData";

const Dash = () => <span className="text-white/25" aria-label="Not included">—</span>;
const Yes = () => <Check className="mx-auto h-4 w-4 text-lime-300" aria-label="Included" />;
const No = () => <Minus className="mx-auto h-4 w-4 text-white/20" aria-label="Not included" />;

function SectionHead({ eyebrow, title, sub }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300">{eyebrow}</p>
      <h2 style={DISPLAY_FONT} className="mt-1 text-[32px] font-extrabold uppercase leading-none text-white sm:text-[38px]">{title}</h2>
      {sub && <p className="mt-2 max-w-[65ch] text-[13px] text-white/50">{sub}</p>}
    </div>
  );
}

/* ─── What can you create? ───────────────────────────────────────────────── */

function LongFormRows() {
  const { lf } = usePricingData();
  const rows = [];
  for (const minutes of LONG_FORM_LENGTHS) {
    for (const tier of ["v2", "v3", "v4"]) rows.push({ minutes, tier });
  }
  return rows.map(({ minutes, tier }, i) => (
    <tr key={`${minutes}-${tier}`} className={cx("border-t border-white/[0.05]", tier === "v2" && i > 0 && "border-white/[0.1]")}>
      <td className="px-3 py-2.5 text-[12px] text-white/65 sm:px-4 sm:text-[12.5px]">
        {minutes} min · {tier.toUpperCase()}
        <span className="ml-2 text-[10.5px] text-white/30">(<Num status={lf.status} value={longFormVideoCredits(lf.tiers, tier, minutes)} /> cr)</span>
      </td>
      {PLAN_ORDER.map((id) => {
        const out = longFormOutputs(lf.tiers, id, tier, minutes);
        return <td key={id} className="px-1 py-2.5 text-center text-[14px] font-bold tabular-nums text-white/85 sm:px-2">{out && !out.included ? <Dash /> : <Num status={lf.status} value={out?.count} />}</td>;
      })}
    </tr>
  ));
}

function ToolRows({ toolKey }) {
  const { costs } = usePricingData();
  return V2_OUTPUT_COSTS[toolKey].options.map((opt, i) => {
    const values = PLAN_ORDER.map((id) => creditsForPlan(costs.costs, id, toolKey, i));
    const lo = values.every((v) => v != null) ? Math.min(...values) : null;
    const hi = lo == null ? null : Math.max(...values);
    return (
      <tr key={opt.label} className="border-t border-white/[0.05]">
        <td className="px-3 py-2.5 text-[12px] text-white/65 sm:px-4 sm:text-[12.5px]">
          {opt.label}
          <span className="ml-2 text-[10.5px] text-white/30">(<Num status={costs.status} value={lo} format={(v) => (v === hi ? v : `${v}–${hi}`)} /> cr)</span>
        </td>
        {PLAN_ORDER.map((id) => (
          <td key={id} className="px-1 py-2.5 text-center text-[14px] font-bold tabular-nums text-white/85 sm:px-2"><Num status={costs.status} value={outputsForPlan(costs.costs, id, toolKey, i)} /></td>
        ))}
      </tr>
    );
  });
}

export function WhatCanYouCreate() {
  const { costs, lf, fruitV2 } = usePricingData();
  const tabs = [toolOrderFor(fruitV2)[0], "longForm", ...toolOrderFor(fruitV2).slice(1)];
  const [active, setActive] = useState(tabs[0]);
  const isLongForm = active === "longForm";
  const tool = isLongForm ? null : V2_OUTPUT_COSTS[active];
  const failed = isLongForm ? lf.status === "error" : costs.status === "error";
  return (
    <section id="output-estimates" className="scroll-mt-24" aria-labelledby="estimates-title">
      <SectionHead eyebrow="Output estimates" title={<span id="estimates-title">What can you create?</span>}
        sub="Complete videos per month from each plan's credits at today's live prices, rounded down. Other tabs are V2; Long Form shows every quality tier, with — where the plan doesn't include it." />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Tools">
        {tabs.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => setActive(key)}
            className={cx("shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition", FOCUS,
              active === key ? "border-transparent bg-white text-black" : "border-white/[0.08] bg-white/[0.035] text-white/55 hover:text-white/80")}>
            {key === "longForm" ? "Long Form" : V2_OUTPUT_COSTS[key].name}
          </button>
        ))}
      </div>
      {failed && <LoadError onRetry={isLongForm ? lf.retry : costs.retry} className="mb-3" />}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#0F1112]">
        <table className="w-full sm:min-w-[520px]">
          <thead>
            <tr>
              <th className="px-3 py-3 text-left text-[12px] font-bold text-white/70 sm:px-4">
                {isLongForm ? "Long Form YouTube video" : tool.name}
                {!isLongForm && tool.hasAudio !== undefined && (
                  <span className={cx("mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:ml-2 sm:mt-0", tool.hasAudio ? "bg-lime-300/10 text-lime-300" : "bg-white/[0.06] text-white/35")}>{tool.hasAudio ? "Includes audio" : "No audio (V2)"}</span>
                )}
                {isLongForm && <span className="mt-1 inline-block rounded-full bg-lime-300/10 px-1.5 py-0.5 text-[9px] font-bold text-lime-300 sm:ml-2 sm:mt-0">Voiceover included</span>}
              </th>
              {PLAN_ORDER.map((id) => (
                <th key={id} className="px-1 py-3 text-center sm:px-2">
                  <span className={cx("block text-[12px] font-bold", id === "pro" ? "text-lime-300" : "text-white/60")}>{PRICING_PLANS[id].name}</span>
                  <span className="block text-[9.5px] font-medium text-white/30">{PRICING_PLANS[id].credits.toLocaleString("en-US")} cr/mo</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{isLongForm ? <LongFormRows /> : <ToolRows toolKey={active} />}</tbody>
        </table>
      </div>
    </section>
  );
}

/* ─── Compare plans ─────────────────────────────────────────────────────── */

const COLUMNS = ["free", ...PLAN_ORDER];

function useCompareGroups() {
  const { costs, lf, fruit, prices, billing } = usePricingData();
  const count = (key, idx) => (id) => (id === "free" ? <Dash /> : <Num status={costs.status} value={outputsForPlan(costs.costs, id, key, idx)} />);
  const lfCell = (tier) => (id) => {
    if (id === "free") return <Dash />;
    const out = longFormOutputs(lf.tiers, id, tier, LONG_FORM_HEADLINE_MINUTES);
    return out && !out.included ? <Dash /> : <Num status={lf.status} value={out?.count} />;
  };
  const fruitTier = (tier) => (id) => {
    if (id === "free" || !PRICING_PLANS[id].modelAccess.includes(tier.toUpperCase())) return <Dash />;
    const unit = costs.costs?.finder?.[fruit.key]?.[tier];
    return <Num status={costs.status} value={unit ? Math.floor(PRICING_PLANS[id].credits / unit) : null} />;
  };
  const tierAccess = (tier) => (id) => (id !== "free" && PRICING_PLANS[id].modelAccess.includes(tier) ? <Yes /> : <No />);
  const paid = (id) => (id === "free" ? <No /> : <Yes />);
  const perMonth = (id) => {
    if (id === "free") return formatMoney(0, prices.prices?.currency ?? "eur");
    const view = prices.status === "ready" ? planPriceView(prices.prices, id, billing) : null;
    return <Num status={prices.status} value={view?.perMonth} format={(v) => formatMoney(v, prices.prices.currency)} />;
  };
  const sec = fruit.headline.sec;
  return [
    { title: "Credits", rows: [
      { label: "Credits / month", cell: (id) => (id === "free" ? "0" : PRICING_PLANS[id].credits.toLocaleString("en-US")), strong: true },
      { label: `Price / month (${billing === "yearly" ? "billed yearly" : "billed monthly"})`, cell: perMonth },
    ] },
    { title: "AI Fruit Story", rows: [
      { label: `V2 · ${sec}-second videos / mo`, cell: count(fruit.headline.key, fruit.headline.idx) },
      { label: `V3 · ${sec}-second videos / mo`, cell: fruitTier("v3") },
      { label: `V4 · ${sec}-second videos / mo`, cell: fruitTier("v4") },
    ] },
    { title: "Long Form", rows: [
      { label: `Long Form V2 · ${LONG_FORM_HEADLINE_MINUTES}-min videos / mo`, cell: lfCell("v2") },
      { label: `Long Form V3 · ${LONG_FORM_HEADLINE_MINUTES}-min videos / mo`, cell: lfCell("v3") },
      { label: `Long Form V4 · ${LONG_FORM_HEADLINE_MINUTES}-min videos / mo`, cell: lfCell("v4") },
    ] },
    { title: "Other tools (V2, per month)", more: true, rows: [
      { label: "Clay Rescue · 30-second videos", cell: count("clayRescue", 0) },
      { label: "Face ASMR · 30-second videos", cell: count("faceAsmr", 1) },
      { label: "Micro Camera Animal · 30-second videos", cell: count("microCamera", 1) },
      { label: "Kit Swap · videos", cell: count("nationalitySwap", 0) },
      { label: "Zyvo V2 images", cell: count("imageGenerator", 0) },
    ] },
    { title: "Quality tiers (templates and Long Form)", more: true, rows: [
      { label: "V2 · standard quality", cell: tierAccess("V2") },
      { label: "V3 · sharper, higher resolution", cell: tierAccess("V3") },
      { label: "V4 · top tier, highest resolution", cell: tierAccess("V4") },
    ] },
    { title: "Features", more: true, rows: [
      { label: "Every tool and template", cell: paid },
      { label: "Video & Image Generator", cell: paid },
      { label: "Watermark-free exports", cell: paid },
      { label: "Faster queue on busy days", cell: (id) => (id === "pro" || id === "generative" ? <Yes /> : <No />) },
      { label: "Priority support", cell: (id) => (id === "pro" || id === "generative" ? <Yes /> : <No />) },
      { label: "Social posts / day (soon)", cell: (id) => ({ free: <Dash />, starter: "1", pro: "3", generative: "8" })[id] },
      { label: "Connected accounts per platform (soon)", cell: (id) => ({ free: <Dash />, starter: "1", pro: "3", generative: "5" })[id] },
    ] },
  ];
}

export function CompareTable({ onAskDowngrade }) {
  const { account, billing } = usePricingData();
  const groups = useCompareGroups();
  const [open, setOpen] = useState(false);
  const [phonePlan, setPhonePlan] = useState("pro");
  const shown = open ? groups : groups.filter((g) => !g.more);
  const planButton = (id, size = "md") => (
    id === "free"
      ? (account.signedIn ? null : <KeyButton size={size} variant="outline" onClick={() => { window.location.href = "/signup"; }}>Sign up</KeyButton>)
      : account.signedIn && account.plan === id
        ? <KeyButton size={size} variant="outline" disabled>Current</KeyButton>
        : <KeyButton size={size} variant={id === "pro" ? "lime" : "white"} onClick={() => subscribe({ planId: id, billing, account, onAskDowngrade })}>Choose</KeyButton>
  );
  return (
    <section aria-labelledby="compare-title">
      <SectionHead eyebrow="Compare" title={<span id="compare-title">Compare plans</span>} sub="Everything each plan includes, side by side." />

      {/* Phones: one plan at a time (Pro first), no sideways scrolling. */}
      <div className="md:hidden">
        <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1" role="tablist" aria-label="Plan to compare">
          {COLUMNS.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={phonePlan === id} onClick={() => setPhonePlan(id)}
              className={cx("rounded-lg py-2 text-[12px] font-bold", FOCUS, phonePlan === id ? "bg-white text-black" : "text-white/50")}>
              {id === "free" ? "Free" : PRICING_PLANS[id].name}
            </button>
          ))}
        </div>
        {planButton(phonePlan, "lg")}
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0F1112]">
          <table className="w-full">
            <tbody>
              {shown.map((g) => (
                <Fragment key={g.title}>
                  <tr className="bg-white/[0.02]"><td colSpan={2} className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">{g.title}</td></tr>
                  {g.rows.map((r) => (
                    <tr key={r.label} className="border-t border-white/[0.04]">
                      <td className="px-3 py-2.5 text-[12.5px] text-white/65">{r.label}</td>
                      <td className={cx("w-20 px-3 py-2.5 text-right text-[13px] font-bold tabular-nums", r.strong ? "text-white" : "text-white/80")}>{r.cell(phonePlan)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#0F1112] md:block">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="align-top">
              <th className="w-[34%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Plan</th>
              {COLUMNS.map((id) => (
                <th key={id} className={cx("px-2 py-4 text-center", id === "pro" && "bg-lime-300/[0.05]")}>
                  <span style={DISPLAY_FONT} className={cx("block text-[19px] font-extrabold uppercase leading-none", id === "pro" ? "text-lime-300" : "text-white")}>{id === "free" ? "Free" : PRICING_PLANS[id].name}</span>
                  <div className="mx-auto mt-2.5 max-w-[132px]">{planButton(id)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <Fragment key={g.title}>
                <tr className="border-t border-white/[0.06] bg-white/[0.02]">
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">{g.title}</td>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.label} className="border-t border-white/[0.04]">
                    <td className="px-3 py-2.5 text-[12px] text-white/65 sm:px-4 sm:text-[12.5px]">{r.label}</td>
                    {COLUMNS.map((id) => (
                      <td key={id} className={cx("px-2 py-2.5 text-center text-[13px] font-bold tabular-nums", r.strong ? "text-white" : "text-white/80", id === "pro" && "bg-lime-300/[0.03]")}>{r.cell(id)}</td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-center">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
          className={cx("inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[12px] font-bold text-white/65 hover:text-white", FOCUS)}>
          {open ? "View less" : "View more"}
          <ChevronDown className={cx("h-3.5 w-3.5 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-white/35">
        Counts use V2 unless the row says otherwise, from today&apos;s live prices, rounded down. The faster queue applies to tools that share Zyvo&apos;s generation queue.
      </p>
    </section>
  );
}
