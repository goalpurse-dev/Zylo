// src/components/TrustedMarquee.jsx
import React from "react";

const ITEMS = [
  { icon: "🏆", label: "Best AI Provider" },
  { icon: "🎯", label: "Most Accurate Ads" },
  { icon: "👥", label: "5000+ Daily Customers" },
  { icon: "⚡", label: "Instant Creative Launch" },
  { icon: "📈", label: "Verified Conversion Lift" },
  { icon: "🎥", label: "High-Retention Videos" },
  { icon: "🛍️", label: "Ecom-Ready Creatives" },
  { icon: "🧠", label: "Zylo™ Precision Engine" },
  { icon: "🤝", label: "Elite Brand Partners" },
  { icon: "🛡️", label: "Secure Infrastructure" },
  { icon: "🇪🇺", label: "GDPR Compliant" },
  { icon: "💳", label: "Stripe & PayPal Protected" },
  { icon: "🧪", label: "Built-In A/B Testing" },
  { icon: "🌍", label: "Global Scale Ready" },
  { icon: "🖼️", label: "Studio-Grade Product Shots" },
  { icon: "📊", label: "Smart Budget Control" },
  { icon: "🤖", label: "No-Code Automations" },
  { icon: "👨‍👩‍👧‍👦", label: "Creator-First Tools" },
  { icon: "🚀", label: "Launch in Minutes" },
  { icon: "✨", label: "Zylo™ Glazing Effects" },
];

export default function TrustedMarquee() {
  return (
    // exact page bg, no visible separating lines
    <section className="w-full bg-[#0c1218] pt-6 pb-4">
      <div className="px-10">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
         
        </p>
      </div>

      {/* seamless full-width marquee, no borders / no extra bg */}
      <div className="w-full overflow-hidden bg-[#0c1218] px-10">
        <div className="flex flex-nowrap whitespace-nowrap">
          <div className="flex flex-nowrap items-center gap-10 animate-zylo-marquee-slow">
            {renderItems()}
            {renderItems("dup-")}
          </div>
        </div>
      </div>

      <style>
        {`
        @keyframes zylo-marquee-slow {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-zylo-marquee-slow {
          animation: zylo-marquee-slow 45s linear infinite;
        }
        `}
      </style>
    </section>
  );
}

function renderItems(prefix = "") {
  return ITEMS.map(({ icon, label }, i) => (
    <div
      key={prefix + i}
      className="
        inline-flex items-center gap-6
        text-xs sm:text-sm font-semibold text-white
      "
    >
      <span className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-[#0c1218] shadow-[0_0_12px_rgba(0,0,0,0.7)]">
        <span className="text-sm sm:text-base">{icon}</span>
        <span>{label}</span>
      </span>
    </div>
  ));
}
