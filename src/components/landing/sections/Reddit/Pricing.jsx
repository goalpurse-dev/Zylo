// src/components/Pricing.jsx
import React from "react";
import { Link } from "react-router-dom";

/** Brand palette */
const BLUE = "#007BFF";

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
const tiers = [
  {
    id: "starter",
    name: "Starter",
    price: "$22",
    period: "/month",
    blurb: "Best for getting started",
    cta: { label: "Get Starter", to: "/signup?plan=starter" },
    popular: false,
    features: [
      "300 credits / mo",
      "20 clips / mo",
      "Basic captions & styles",
      "Watermark-free exports",
      "Standard queue",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$45",
    period: "/month",
    blurb: "Grow with advanced tools",
    cta: { label: "Get Pro", to: "/signup?plan=pro" },
    popular: true, // highlighted with ribbon
    features: [
      "1,200 credits / mo",
      "60 clips / mo",
      "Pro captions + templates",
      "Brand Kit",
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
      "3,000 credits / mo",
      "150 clips / mo",
      "AI voiceovers & scenes",
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
    <div className="rounded-2xl bg-white border border-gray-200 p-6 flex flex-col h-full relative overflow-hidden">
      {/* The corner ribbon only for the popular (Pro) plan */}
      {tier.popular && <CornerRibbon label="Best value" />}

      {/* Plan name */}
      <div className="mb-2 text-black font-extrabold text-xl">{tier.name}</div>

      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-4xl font-extrabold text-black">{tier.price}</div>
        <div className="text-sm text-gray-500">{tier.period}</div>
      </div>

      <div className="text-sm text-gray-600 mt-1">{tier.blurb}</div>

      <ul className="mt-5 space-y-2 text-sm text-gray-800">
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
        className="mt-6 inline-flex justify-center items-center h-11 rounded-xl font-semibold"
        style={{
          background: BLUE,
          color: "#fff",
          boxShadow: "0 6px 14px rgba(0,123,255,0.22)",
        }}
      >
        {tier.cta.label}
      </Link>
    </div>
  );

  // Popular plan also gets a subtle gradient ring around the whole card
  if (!tier.popular) return <div className="relative">{core}</div>;

  return (
    <div className="relative">
      <div className="p-[2px] rounded-2xl bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2]">
        {core}
      </div>
    </div>
  );
}

function SecondaryCard({ title, price, subtitle, ctaLabel, to, children }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-6 flex flex-col justify-between">
      <div>
        <div className="text-2xl font-bold text-black">{title}</div>
        <div className="mt-1 text-3xl font-extrabold text-black">{price}</div>
        {subtitle && <div className="mt-1 text-sm text-gray-600">{subtitle}</div>}
        <div className="mt-5 text-sm text-gray-700 leading-6">{children}</div>
      </div>
      <div className="mt-6">
        <Link
          to={to}
          className="inline-flex justify-center items-center h-11 rounded-xl px-4 font-semibold"
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
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-14">
        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-black">
            The right plan,{" "}
            <span className="bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] bg-clip-text text-transparent">
              for the right team
            </span>
          </h1>
          <p className="text-gray-600 mt-3">
            Start free. Upgrade when you’re ready. Cancel anytime.
          </p>
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

        {/* Trust row */}
        <div className="mt-8 text-center text-xs text-gray-500">
          14-day money-back guarantee · Secure checkout · No hidden fees
        </div>
      </div>
    </section>
  );
}
