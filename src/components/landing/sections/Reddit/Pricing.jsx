// src/components/landing/sections/Reddit/Pricing.jsx
import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import useLivePlanPrices from "../../../pricing/useLivePlanPrices";
import { PLAN_CREDITS } from "../../../../../supabase/functions/_shared/stripePlanPrices.js";

/* ─── Plan data ───────────────────────────────────────────────────────────── */
// Prices are live from Stripe (useLivePlanPrices); credits are what new
// subscriptions get (PLAN_CREDITS). Every line is true on today's product.
const TIERS = [
  {
    id: "starter",
    name: "Starter",
    blurb: "Every tool and template at V2 quality",
    accent: "#9B72F5",
    btnFrom: "#5B21B6",
    btnTo: "#7C3AED",
    cta: { label: "Start creating", to: "/signup?plan=starter" },
    popular: false,
    features: [
      { text: `${PLAN_CREDITS.starter.toLocaleString("en-US")} credits / month`, star: true },
      { text: "Every Zyvo tool and template" },
      { text: "V2 quality" },
      { text: "Long Form YouTube videos" },
      { text: "Watermark-free exports" },
      { text: "Email support" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "Sharper V3 quality and more credits",
    accent: "#A855F7",
    btnFrom: "#6D28D9",
    btnTo: "#A855F7",
    cta: { label: "Get Pro", to: "/signup?plan=pro" },
    popular: true,
    features: [
      { text: `${PLAN_CREDITS.pro.toLocaleString("en-US")} credits / month`, star: true },
      { text: "Every Zyvo tool and template" },
      { text: "V2 + V3 quality" },
      { text: "Long Form YouTube videos" },
      { text: "Faster queue on busy days" },
      { text: "Priority support" },
    ],
  },
  {
    id: "generative",
    name: "Generative",
    blurb: "Every quality tier and the most credits",
    accent: "#C084FC",
    btnFrom: "#7C3AED",
    btnTo: "#C084FC",
    cta: { label: "Get Generative", to: "/signup?plan=generative" },
    popular: false,
    features: [
      { text: `${PLAN_CREDITS.generative.toLocaleString("en-US")} credits / month`, star: true },
      { text: "Every Zyvo tool and template" },
      { text: "V2 + V3 + V4 quality" },
      { text: "Long Form YouTube videos" },
      { text: "First in the queue on busy days" },
      { text: "Priority support" },
    ],
  },
];

/* ─── Card ────────────────────────────────────────────────────────────────── */
function PlanCard({ tier, index, price }) {
  const isPopular = !!tier.popular;

  return (
    <div
      className={`relative flex flex-col rounded-[24px] overflow-hidden pricing-lp-card pricing-lp-float-${index + 1}`}
      style={{
        background: isPopular
          ? "linear-gradient(160deg, #130B28 0%, #1C0A3A 40%, #0E0E20 100%)"
          : "linear-gradient(160deg, #0B0D1A 0%, #0E1020 100%)",
        boxShadow: isPopular
          ? "0 0 0 1px rgba(168,85,247,0.25), 0 20px 60px rgba(109,40,217,0.15)"
          : "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Colored top bar */}
      <div
        className="h-[3px] w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${tier.accent}CC, ${tier.accent}30)` }}
      />

      {/* Popular badge */}
      {isPopular && (
        <div
          className="absolute top-4 right-4 text-[10px] font-bold tracking-[0.1em] px-3 py-1 rounded-full"
          style={{
            background: `${tier.accent}1A`,
            color: tier.accent,
            border: `1px solid ${tier.accent}40`,
          }}
        >
          RECOMMENDED: UNLOCKS V3
        </div>
      )}

      <div className="flex flex-col flex-1 p-6 md:p-7">

        {/* Name + blurb */}
        <div className="mb-5">
          <div className="text-base font-bold mb-0.5" style={{ color: tier.accent }}>
            {tier.name}
          </div>
          <div className="text-white/35 text-xs">{tier.blurb}</div>
        </div>

        {/* Price */}
        <div className="flex items-end gap-1.5 mb-1">
          <span className="text-[52px] font-extrabold leading-none tracking-tighter text-white">
            {price}
          </span>
          <span className="text-white/30 text-sm mb-2">/mo</span>
        </div>
        <div className="text-xs text-white/20 mb-5">billed monthly · cancel anytime</div>

        {/* CTA */}
        <Link
          to={tier.cta.to}
          className="w-full flex items-center justify-center py-3.5 rounded-2xl font-bold text-sm text-white mb-5 transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
          style={{
            background: `linear-gradient(135deg, ${tier.btnFrom}, ${tier.btnTo})`,
            boxShadow: isPopular ? `0 8px 24px rgba(109,40,217,0.28)` : "none",
          }}
        >
          {tier.cta.label} →
        </Link>

        {/* Divider */}
        <div className="mb-5 h-px bg-white/[0.05]" />

        {/* Features */}
        <ul className="space-y-3 flex-1">
          {tier.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <Check
                className="w-4 h-4 mt-[1px] shrink-0"
                style={{ color: f.star ? tier.accent : tier.accent + "80" }}
              />
              <span className={f.star ? "text-white font-semibold" : "text-white/50"}>
                {f.text}
              </span>
            </li>
          ))}
        </ul>

        <p className="text-center text-[11px] text-white/15 mt-6">
          Instant access · Cancel anytime
        </p>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function Pricing() {
  const live = useLivePlanPrices("monthly");
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: "#07080F" }}
    >
      {/* Ambient purple blobs — subtle, no big glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(109,40,217,0.10) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative max-w-[1060px] mx-auto px-4 sm:px-6 py-16 md:py-20">

        {/* Social proof pill */}
        <div className="flex justify-center mb-6">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <span className="text-white font-semibold">18,700+</span>&nbsp;creators signed up
          </span>
        </div>

        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-4 text-white">
            Make more videos{" "}
            <span
              style={{
                background: "linear-gradient(90deg,#A855F7,#C084FC)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              every month.
            </span>
          </h2>
          <p className="text-white/40 text-base max-w-md mx-auto">
            Every plan includes every Zyvo tool. Start free, upgrade when you're ready.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 mb-6">
          {TIERS.map((t, i) => (
            <PlanCard key={t.id} tier={t} index={i} price={live.main(t.id)} />
          ))}
        </div>

        {/* Guarantee strip */}
        <div className="flex items-center justify-center mt-6 mb-3">
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Not happy in 7 days?{" "}
              <span className="text-white font-bold">Unused credits refunded.</span>{" "}
              No questions asked.
            </span>
          </div>
        </div>

        {/* Free */}
        <div className="mt-8 flex flex-col gap-4 rounded-[20px] p-6 sm:flex-row sm:items-center sm:justify-between" style={{ background: "#0D0F1C" }}>
          <div>
            <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>Free</div>
            <div className="text-3xl font-extrabold text-white">€0</div>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
              5 free AI images every 30 days and a look around every tool. Making videos needs a plan. No card needed.
            </p>
          </div>
          <Link
            to="/signup"
            className="inline-flex shrink-0 justify-center items-center px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98]"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
          >
            Start for free
          </Link>
        </div>

        {/* Trust footer */}
        <div
          className="text-center pt-8 mt-8 flex items-center justify-center gap-8 text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)" }}
        >
          <span>🔒 Stripe-secured</span>
          <span>⚡ Instant access</span>
          <span>✕ Cancel anytime</span>
        </div>

      </div>
    </section>
  );
}
