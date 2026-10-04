// src/components/Pricing.jsx
import React from "react";
import { Link } from "react-router-dom";
import useLivePlanPrices from "./pricing/useLivePlanPrices";
import { PLAN_CREDITS } from "../../supabase/functions/_shared/stripePlanPrices.js";

/** Brand palette */
const BLUE = "#1677FF";

function CornerRibbon({ label = "Best Value" }) {
  return (
    <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none">
      <div
        className="absolute transform rotate-45 text-[11px] font-bold text-white tracking-wide text-center py-1"
        style={{
          background: "linear-gradient(90deg, #7A3BFF, #9B4DFF, #FF57B2)",
          top: "20px",
          right: "-40px",
          width: "140px",
          boxShadow: "0 3px 6px rgba(0,0,0,0.25)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ---------------------------------- Data --------------------------------- */
/* ---------------------------------- Data --------------------------------- */
// Prices are live from Stripe (useLivePlanPrices, per month on monthly
// billing); credits are what new subscriptions get (PLAN_CREDITS).
const tiers = [
  {
    id: "starter",
    name: "Starter",
    period: "/month",
    blurb: "Every tool and template at V2 quality",
    cta: { label: "Get Starter", to: "/signup?plan=starter" },
    popular: false,
    features: [
      `${PLAN_CREDITS.starter.toLocaleString("en-US")} credits / mo`,
      "All Zyvo tools & templates",
      "V2 quality",
      "Long Form YouTube videos",
      "Watermark-free exports",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    period: "/month",
    blurb: "Sharper V3 quality and more credits",
    cta: { label: "Get Pro", to: "/signup?plan=pro" },
    popular: true,
    features: [
      `${PLAN_CREDITS.pro.toLocaleString("en-US")} credits / mo`,
      "All Zyvo tools & templates",
      "V2 + V3 quality",
      "Faster queue on busy days",
      "Priority support",
    ],
  },
  {
    id: "generative",
    name: "Generative",
    period: "/month",
    blurb: "Every quality tier and the most credits",
    cta: { label: "Get Generative", to: "/signup?plan=generative" },
    popular: false,
    features: [
      `${PLAN_CREDITS.generative.toLocaleString("en-US")} credits / mo`,
      "All Zyvo tools & templates",
      "V2 + V3 + V4 quality",
      "First in the queue on busy days",
      "Priority support",
    ],
  },
];

/** Small blue tick icon */
const Tick = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/* --------------------------------- Cards --------------------------------- */
function PlanCard({ tier, price }) {
  const core = (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 flex flex-col h-full relative overflow-hidden text-white shadow-xl">
      {tier.popular && <CornerRibbon label="Unlocks V3" />}

      {/* Plan name */}
      <div className="mb-2 font-extrabold text-xl text-white">{tier.name}</div>

      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-4xl font-extrabold text-white">{price}</div>
        <div className="text-sm text-zinc-400">{tier.period}</div>
      </div>

      <div className="text-sm text-zinc-400 mt-1">{tier.blurb}</div>

      <ul className="mt-5 space-y-2 text-sm text-zinc-200">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-[3px]" style={{ color: BLUE }}>
              <Tick className="w-4 h-4" />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        to={tier.cta.to}
        className="mt-6 inline-flex justify-center items-center h-11 rounded-xl font-semibold transition"
        style={{
          background: BLUE,
          color: "#fff",
          boxShadow: "0 6px 14px rgba(22,119,255,0.3)",
        }}
      >
        {tier.cta.label}
      </Link>
    </div>
  );

  if (!tier.popular) return <div className="relative">{core}</div>;

  return (
    <div className="relative">
      <div className="p-[2px] rounded-2xl bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] shadow-lg">
        {core}
      </div>
    </div>
  );
}

function SecondaryCard({ title, price, subtitle, ctaLabel, to, children }) {
  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 flex flex-col justify-between text-white shadow-xl">
      <div>
        <div className="text-2xl font-bold text-white">{title}</div>
        <div className="mt-1 text-3xl font-extrabold text-white">{price}</div>
        {subtitle && <div className="mt-1 text-sm text-zinc-400">{subtitle}</div>}
        <div className="mt-5 text-sm text-zinc-300 leading-6">{children}</div>
      </div>
      <div className="mt-6">
        <Link
          to={to}
          className="inline-flex justify-center items-center h-11 rounded-xl px-4 font-semibold transition"
          style={{ border: `2px solid ${BLUE}`, color: BLUE }}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

/* --------------------------------- Page ---------------------------------- */
export default function Pricing() {
  const live = useLivePlanPrices("monthly");
  return (
    <section className="bg-[#0c1218] text-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-14">
        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            The right plan,{" "}
            <span className="bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] bg-clip-text text-transparent">
              for the right team
            </span>
          </h1>
          <div className="text-zinc-400 mt-3">
            Start free. Upgrade when you’re ready. Cancel anytime.
             <div className="text-zinc-400 mt-3">
              V5 uses the best AI model available in the world right now.
             </div>
          </div>
        </div>

        {/* Main tier grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <PlanCard key={t.id} tier={t} price={live.main(t.id)} />
          ))}
        </div>

        {/* Free */}
        <div className="mt-8">
          <SecondaryCard
            title="Free"
            price="€0"
            subtitle="Sign up free, no card needed"
            ctaLabel="Try for free"
            to="/signup"
          >
            5 free AI images every 30 days and a look around every tool.
            Making videos needs a plan.
          </SecondaryCard>
        </div>

        {/* Trust row + See more */}
<div className="mt-8 text-center">
  <div className="text-xs text-zinc-500">
    Unused credits refunded within 7 days · Secure checkout · No hidden fees
  </div>

  <Link
    to="/pricing"
    className="inline-flex items-center justify-center mt-4 h-11 px-6 rounded-xl font-semibold transition border"
    style={{ borderColor: "#1677FF", color: "#1677FF" }}
  >
    See more
  </Link>
</div>

      </div>
    </section>
  );
}
