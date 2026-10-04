import { Check } from "lucide-react";
import { startCheckout, openBillingPortal } from "../../lib/payments";
import { PLAN_PRICE_IDS } from "../../../supabase/functions/_shared/stripePlanPrices.js";
import { PLAN_ORDER, PRICING_PLANS, LONG_FORM_HEADLINE_MINUTES, outputsForPlan, longFormOutputs } from "../../lib/pricingOutputs";
import { formatMoney, planPriceView } from "../../lib/planPrices";
import KeyButton from "../ui/zyvo/KeyButton";
import { cx } from "../ui/zyvo/styles";
import { LoadError, Num, PLAN_COPY, usePricingData } from "./PricingData";

export const DISPLAY_FONT = { fontFamily: "'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif", fontStretch: "condensed" };

const TINTS = {
  starter: "border-white/[0.09] bg-[#111314]",
  pro: "border-lime-300/40 bg-[linear-gradient(170deg,rgba(190,242,100,0.10)_0%,rgba(190,242,100,0.03)_38%,#0E110D_100%)] shadow-[0_0_0_1px_rgba(190,242,100,0.06),0_24px_60px_rgba(0,0,0,0.45)]",
  generative: "border-lime-500/20 bg-[linear-gradient(170deg,#18230F_0%,#0F150D_45%,#0A0D0B_100%)]",
};

const PLAN_FEATURES = {
  starter: [{ text: "1 social post published / day", soon: true }, { text: "1 connected account per platform", soon: true }],
  pro: [{ text: "Faster queue on busy days" }, { text: "Priority support" }, { text: "3 social posts published / day", soon: true }, { text: "3 connected accounts per platform", soon: true }],
  generative: [{ text: "First in the queue on busy days" }, { text: "Priority support" }, { text: "8 social posts published / day", soon: true }, { text: "5 connected accounts per platform", soon: true }],
};

/**
 * Buys a plan, or opens the plan change in the billing portal for someone who
 * already has a subscription. A logged-out visitor goes to sign-up and continues
 * to checkout afterwards with the same plan and billing (lib/payments).
 * Run it through pay.run (usePricingData): resolves true when the browser is
 * leaving the page, and throws for pay.run to show.
 */
export async function subscribe({ planId, billing, account, onAskDowngrade }) {
  if (!PLAN_PRICE_IDS[planId]?.[billing]) return false;
  if (account.hasSub) return openBillingPortal({ flow: "change_plan", returnPath: "/pricing" });
  if (!account.lapsed && PLAN_ORDER.indexOf(planId) < PLAN_ORDER.indexOf(account.plan)) { onAskDowngrade?.(planId); return false; }
  return startCheckout({ type: "subscription", planId, billing });
}

/** True when this is the plan the viewer has now (a lapsed subscription's plan can be bought again). */
export const isCurrentPlan = (account, planId) => account.signedIn && !account.lapsed && account.plan === planId;

/** "€180 billed yearly" for the yearly choice, null for monthly or while prices load. */
export function yearlyTotalLabel(prices, planId, billing) {
  if (billing !== "yearly" || prices.status !== "ready") return null;
  return `${formatMoney(planPriceView(prices.prices, planId, "yearly").billedYearly, prices.prices.currency)} billed yearly`;
}

/** The credits box: credits first, then what they make at V2, in plain words. */
function CreditsBox({ planId }) {
  const { costs, lf, fruit } = usePricingData();
  const fruitCount = outputsForPlan(costs.costs, planId, fruit.headline.key, fruit.headline.idx);
  const longForm = longFormOutputs(lf.tiers, planId, "v2", LONG_FORM_HEADLINE_MINUTES);
  const extras = [
    { key: "clayRescue", idx: 0, name: "Clay Rescue" },
    { key: "faceAsmr", idx: 1, name: "Face ASMR" },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
      <p className="text-[22px] font-black leading-none tracking-[-0.02em] text-white tabular-nums">
        {PRICING_PLANS[planId].credits.toLocaleString("en-US")} <span className="text-[13px] font-bold tracking-normal text-white/55">credits / month</span>
      </p>
      <ul className="mt-3 space-y-1.5 text-[13.5px] leading-snug text-white/80">
        <li>≈ <Num status={costs.status} value={fruitCount} className="font-bold text-lime-300" /> AI Fruit TikToks ({fruit.headline.sec} s)</li>
        <li>≈ <Num status={lf.status} value={longForm?.count} className="font-bold text-lime-300" /> YouTube videos ({LONG_FORM_HEADLINE_MINUTES} min)</li>
      </ul>
      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-white/45 hover:text-white/70 [&::-webkit-details-marker]:hidden">
          <span className="underline decoration-dotted underline-offset-2">Example monthly output</span>
        </summary>
        <ul className="mt-2 space-y-1 text-[12.5px] text-white/60">
          <li><Num status={lf.status} value={longForm?.count} /> complete {LONG_FORM_HEADLINE_MINUTES}-min Long Form YouTube videos (V2)</li>
          <li><Num status={costs.status} value={fruitCount} /> complete {fruit.headline.sec}-second AI Fruit Story videos (V2)</li>
          {extras.map((x) => <li key={x.key}><Num status={costs.status} value={outputsForPlan(costs.costs, planId, x.key, x.idx)} /> complete 30-second {x.name} videos (V2)</li>)}
        </ul>
      </details>
      <p className="mt-2.5 text-[10.5px] leading-relaxed text-white/35">
        Or any mix. Estimates at V2 from today&apos;s live prices, rounded down; lengths and tools use different amounts of credits.
      </p>
    </div>
  );
}

function TierStrip({ planId }) {
  const have = PLAN_COPY[planId].tiers;
  return (
    <div>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1" aria-label={`Quality tiers: ${have.map((t) => t.toUpperCase()).join(" + ")}`}>
        {["v2", "v3", "v4"].map((t) => {
          const on = have.includes(t);
          return (
            <span key={t} className={cx("rounded-lg py-1.5 text-center text-[11px] font-black tracking-wide", on ? "bg-lime-300/15 text-lime-300" : "text-white/20 line-through decoration-white/20")}>
              {t.toUpperCase()}
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10.5px] text-white/35">Quality for templates and Long Form: {have.map((t) => t.toUpperCase()).join(" + ")}</p>
    </div>
  );
}

function PriceBlock({ planId }) {
  const { prices, billing } = usePricingData();
  const view = prices.status === "ready" ? planPriceView(prices.prices, planId, billing) : null;
  if (prices.status === "error") return <LoadError what="prices" onRetry={prices.retry} />;
  const money = (n, opts) => formatMoney(n, prices.prices?.currency, opts);
  return (
    <div>
      <div className="flex items-end gap-2">
        {view?.crossedOut != null && <span className="mb-1.5 text-[18px] font-bold text-white/30 line-through decoration-white/40" aria-label={`Monthly price ${money(view.crossedOut)}`}>{money(view.crossedOut)}</span>}
        <span className="text-[46px] font-black leading-none tracking-[-0.04em] text-white tabular-nums">
          <Num status={prices.status} value={view?.perMonth} format={(v) => money(v)} />
        </span>
        <span className="mb-1.5 text-[13px] font-semibold text-white/45">/month</span>
      </div>
      {/* Yearly: the amount checkout will charge, as plain as the monthly figure above. */}
      {billing === "yearly" && (
        <p className="mt-1.5 text-[14px] font-bold text-white/90" data-testid="yearly-total">
          <Num status={prices.status} value={view?.billedYearly} format={(v) => money(v)} /> billed yearly
        </p>
      )}
      <p className="mt-1 text-[12px] text-white/40">
        {billing === "yearly" ? "one payment a year" : "billed monthly"} · ≈ <Num status={prices.status} value={view?.perDay} format={(v) => money(v, { cents: true })} /> a day
      </p>
    </div>
  );
}

function SavingLine({ planId }) {
  const { prices, billing } = usePricingData();
  if (prices.status !== "ready") return null;
  const view = planPriceView(prices.prices, planId, "yearly");
  const money = formatMoney(view.savingAmount, prices.prices.currency);
  return (
    <p className={cx("text-center text-[12px] font-semibold", billing === "yearly" ? "text-lime-300" : "text-white/40")}>
      {billing === "yearly" ? `Save ${money} compared to monthly (${view.savingPercent}%)` : `Pay yearly to save ${money} (${view.savingPercent}%)`}
    </p>
  );
}

export function PlanCard({ planId, onAskDowngrade }) {
  const { account, billing, prices, pay } = usePricingData();
  const copy = PLAN_COPY[planId];
  const recommended = Boolean(copy.badge);
  const isCurrent = isCurrentPlan(account, planId);
  const yearlyTotal = yearlyTotalLabel(prices, planId, billing);
  return (
    <article
      aria-labelledby={`plan-${planId}`}
      className={cx("relative flex flex-col gap-4 rounded-[24px] border p-5 sm:p-6", TINTS[planId], recommended && "order-first md:order-none")}
    >
      <header>
        {/* The badge row keeps every card's name and credits box on the same line on desktop. */}
        {recommended
          ? <span className="mb-3 inline-block rounded-full bg-lime-300 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wide text-[#11150D]">{copy.badge}</span>
          : <span className="mb-3 hidden h-[23px] md:block" aria-hidden="true" />}
        <h2 id={`plan-${planId}`} style={DISPLAY_FONT} className={cx("text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]", recommended ? "text-lime-300" : "text-white")}>
          {PRICING_PLANS[planId].name}
        </h2>
        <p className="mt-1.5 text-[13px] text-white/50">{copy.line}</p>
      </header>

      <CreditsBox planId={planId} />
      <PriceBlock planId={planId} />

      {isCurrent ? (
        <KeyButton variant="outline" disabled>Current plan</KeyButton>
      ) : (
        <KeyButton
          variant={recommended ? "lime" : "white"}
          busy={pay.busy === `plan:${planId}`}
          disabled={pay.busy != null}
          onClick={() => pay.run(`plan:${planId}`, () => subscribe({ planId, billing, account, onAskDowngrade }))}
        >
          <span className="flex flex-col items-center leading-tight">
            <span>{account.hasSub ? `Switch to ${PRICING_PLANS[planId].name}` : `Get ${PRICING_PLANS[planId].name}`}</span>
            {yearlyTotal && !account.hasSub && <span className="text-[11px] font-semibold opacity-70">{yearlyTotal}</span>}
          </span>
        </KeyButton>
      )}
      <SavingLine planId={planId} />
      <TierStrip planId={planId} />

      <ul className="space-y-2 border-t border-white/[0.06] pt-4">
        {PLAN_FEATURES[planId].map((f) => (
          <li key={f.text} className="flex items-center gap-2.5 text-[13px] text-white/70">
            <Check className={cx("h-4 w-4 shrink-0", recommended ? "text-lime-300" : "text-lime-300/70")} aria-hidden="true" />
            <span>{f.text}</span>
            {f.soon && <span className="ml-auto shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">Soon</span>}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function PlanCards({ onAskDowngrade }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start lg:gap-5">
      {PLAN_ORDER.map((id) => <PlanCard key={id} planId={id} onAskDowngrade={onAskDowngrade} />)}
    </div>
  );
}
