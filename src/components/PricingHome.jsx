// src/components/Pricing.jsx
import React from "react";
import { Link } from "react-router-dom";

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
const tiers = [
  {
    id: "starter",
    name: "Starter",
    price: "$25",
    period: "/month",
    blurb: "Best for getting started",
    cta: { label: "Get Starter", to: "/signup?plan=starter" },
    popular: false,
    features: [
      "1,200 credits / mo",
      "≈ 120 product photos / mo",
      "≈ 10 v4 ads / mo",
      "≈ 60 clips / mo ",
      "5 avatars available",
      "Up to v4 model access",
      "2 brands · 2 products/brand",
      "Watermark-free exports",
      "Standard queue",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$50",
    period: "/month",
    blurb: "Grow with advanced tools",
    cta: { label: "Get Pro", to: "/signup?plan=pro" },
    popular: true, // Best value ribbon
    features: [
      "2,500 credits / mo",
      "≈ 250 product photos / mo",
      "≈ 6 v5 ads / mo",

      "≈ 125 clips / mo",
      "20 avatars available",
      "Access to v5 models",
      "5 brands · 5 products/brand",
      "Brand Kit + templates",
      "Priority queue",
      "Email support",
    ],
  },
  {
    id: "generative",
    name: "Generative",
    price: "$90",
    period: "/month",
    blurb: "For power users & teams",
    cta: { label: "Get Generative", to: "/signup?plan=generative" },
    popular: false,
    features: [
      "5,000 credits / mo",
      "≈ 500 product photos / mo", 
      "≈ 12 v5 ads / mo", 
      "≈ 250 clips / mo ",
      "50 avatars available",
      "Access to v5 models",
      "Unlimited brands & products",
      "Collaboration & approvals",
      "Fast lane queue",
      "Chat support",
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
function PlanCard({ tier }) {
  const core = (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 flex flex-col h-full relative overflow-hidden text-white shadow-xl">
      {tier.popular && <CornerRibbon label="Best value" />}

      {/* Plan name */}
      <div className="mb-2 font-extrabold text-xl text-white">{tier.name}</div>

      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-4xl font-extrabold text-white">{tier.price}</div>
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
            <PlanCard key={t.id} tier={t} />
          ))}
        </div>

        {/* Secondary row: Free & Enterprise */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <SecondaryCard
            title="Free"
            price="$0"
            subtitle="Try ZyloAI with weekly credits"
            ctaLabel="Try for free"
            to="/signup"
          >
            10 minutes and 1 AI avatar per week, 4 exports per week with a
            small watermark. Access to core tools so you can learn the workflow.
          </SecondaryCard>

          <SecondaryCard
            title="Enterprise"
            price="Custom"
            subtitle="For organizations that need scale"
            ctaLabel="Contact sales"
            to="/contact"
          >
            SSO & roles, unlimited workspaces, custom model options, SLAs and
            priority support. Flexible invoicing and procurement support.
          </SecondaryCard>
        </div>

        {/* Trust row + See more */}
<div className="mt-8 text-center">
  <div className="text-xs text-zinc-500">
    14-day money-back guarantee · Secure checkout · No hidden fees
  </div>

  <Link
    to="/pricing"            // change to your route (e.g., /docs/pricing)
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
