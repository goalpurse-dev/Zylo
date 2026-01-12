// src/components/Pricing.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { startCheckout, openBillingPortal } from "../lib/payments";
import { supabase } from "../lib/supabaseClient";



/** >>> YOUR REAL STRIPE PRICE IDS <<< */
const PRICE_IDS = {
  starter: "price_1SPRwvHtn4q5rIncXWHHI5ZB",
  pro: "price_1SPRxxHtn4q5rInc0fWPi6yM",
  generative: "price_1SPRyZHtn4q5rIncHLQpTnkI",
};

/** >>> TOP-UP STRIPE PRICE IDS <<< */
const TOPUP_PRICE_IDS = {
  mini: "price_1SPStqHtn4q5rIncVxLdABqO",      // €6.99
  standard: "price_1SPSuEHtn4q5rIncHCKU1Y4A",  // €11.99
  max: "price_1SPSuUHtn4q5rIncbNN8fGqm",       // €19.99
};

const BLUE = "#1677FF";



/* Ribbon on popular plan */
function CornerRibbon({ label = "Best value" }) {
  return (
    <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none">
      <div
        className="bg-[#7A3BFF] absolute transform rotate-45 text-[11px] font-bold text-white tracking-wide text-center py-1"
        style={{
      
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

/* ------------------------------- Plan data -------------------------------- */
const TIERS = [
  {
    id: "starter",
    name: "Starter",
    monthly: 25,
    yearlyPerMonth: 21.25,
    blurb: "Best for getting started",
    popular: false,
    features: [
      "1,200 credits / mo",
      "AI product photo generator",
      "≈ 100 product images / mo",
      "30 Product Backgrounds",
      "Watermark-free exports",
      "2 My Products",
      "Standard queue",
      "Email support",
      "30 creations/day"
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 50,
    yearlyPerMonth: 42.5,
    blurb: "Grow with advanced tools",
    popular: true,
    features: [
      "2,500 credits / mo",
      "AI product photo generator",
      "≈ 210 product photos / mo",
      "≈ 100 Product Backgrounds",
      "Watermark-free exports",
      "5 My Products",
      "Priority queue",
      "Email support",
      "100 creations/day"
    ],
  },
  {
    id: "generative",
    name: "Generative",
    monthly: 90,
    yearlyPerMonth: 76.5,
    blurb: "For power users & teams",
    popular: false,
    features: [
      "5,000 credits / mo",
      "AI product photo generator",
      "≈ 420 product photos / mo",
      "≈ All 210+ Product Backgrounds",
      "Watermark-free exports",
      "Unlimited My Products",
      "Fast lane queue",
      "Chat support",
      "300 creations/day"
    ],
  },
];

const TOPUPS = [
  { id: "mini", title: "Mini", price: 6.99, credits: 300, to: "/buy/credits?pack=mini" },
  { id: "standard", title: "Standard", price: 11.99, credits: 520, to: "/buy/credits?pack=standard" },
  { id: "max", title: "Max", price: 19.99, credits: 900, to: "/buy/credits?pack=max" },
];

const ALL_INCLUDE = [
  "Brand creation",
  "Ad creation",
  "Product creation",
  "Top quality exports",
  "Email support",
];

/* --------------------------- Helpers / hooks --------------------------- */
function useCurrentPlan() {
  const [state, setState] = useState({ plan: "free", hasSub: false, loading: true });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setState({ plan: "free", hasSub: false, loading: false });

      const { data } = await supabase
        .from("profiles")
        .select("plan_code, stripe_subscription_id")
        .eq("id", user.id)
        .single();

      setState({
        plan: data?.plan_code || "free",
        hasSub: !!data?.stripe_subscription_id,
        loading: false,
      });
    })();
  }, []);

  return state; // { plan, hasSub, loading }
}

function tierRank(code) {
  return TIERS.findIndex((t) => t.id === code);
}

/* ------------------------------ Modal inline ------------------------------ */
function ConfirmModal({ open, onCancel, onConfirm, targetLabel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative z-[1001] w-[92%] max-w-md rounded-2xl border border-white/10 bg-[#110829] p-5 shadow-2xl">
        <div className="text-lg font-semibold mb-1">Confirm downgrade</div>
        <p className="text-sm text-white/80">
          Are you sure you want to switch to <span className="font-semibold">{targetLabel}</span>?
          This change will be scheduled and managed in Stripe’s secure billing portal. You’ll keep
          your current plan until the end of the paid period.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-2 font-semibold hover:bg-white/15"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-white text-black px-4 py-2 font-semibold hover:bg-gray-100"
          >
            Go to downgrade
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- UI cards ------------------------------- */
function PlanCard({ tier, billing, currentPlan, hasSub, onAskDowngrade }) {
  const isYearly = billing === "yearly";
  const price = isYearly ? tier.yearlyPerMonth : tier.monthly;
  const priceStr = `$${Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)}`;
  const subline = isYearly ? `billed annually $${(price * 12).toFixed(2)}` : "/month";

  const curRank = tierRank(currentPlan);
  const thisRank = tierRank(tier.id);

  let ctaLabel = "Choose";
  let hint = "";
  let disabled = false;

  if (tier.id === currentPlan) {
    ctaLabel = "Current plan";
    disabled = true;
  } else if (curRank >= 0 && thisRank > curRank) {
    ctaLabel = "Upgrade";
    hint = "Manage in the billing portal";
  } else if (curRank >= 0 && thisRank < curRank) {
    ctaLabel = "Downgrade";
    hint = "Takes effect next cycle (portal)";
  } else if (currentPlan === "free") {
    ctaLabel = "Get started";
  }

  async function onClick() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return (window.location.href = "/signup");

    const priceId = PRICE_IDS[tier.id];
    if (!priceId) return alert("Price ID not configured.");

    // If user already has a subscription → use Portal for both upgrades & downgrades
    if (hasSub) {
      if (thisRank > curRank) {
        // Upgrade → deep-link to plan picker
        return openBillingPortal({ flow: "change_plan", returnPath: "/pricing" });
      }
      if (thisRank < curRank) {
        // Downgrade → ask first, then deep-link to plan picker
        return onAskDowngrade(tier);
      }
    }

    // No subscription yet → start checkout
    await startCheckout({ type: "subscription", priceId });
  }

  const core = (
    <div className="rounded-2xl bg-[#ECE8F2] border border-zinc-800 p-6 flex flex-col h-full relative overflow-hidden text-[#110829]  shadow-xl">
      {tier.popular && <CornerRibbon label="Best value" />}

      <div className="mb-2 font-bold text-xl">{tier.name}</div>

      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-4xl font-bold">{priceStr}</div>
        <div className="text-sm text-[#4A4A55] font-semibold">/month</div>
      </div>
      <div className="text-sm text-[#4A4A55] font-bold">{subline}</div>

      <div className="text-sm text-[#4A4A55] font-semibold mt-2">{tier.blurb}</div>

      <ul className="mt-5 space-y-2 text-sm text-[#4A4A55]">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-[3px] text-[#7A3BFF]">
              <Tick className="w-4 h-4" />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        disabled={disabled}
        onClick={onClick}
        className={`mt-6 inline-flex justify-center items-center h-11 rounded-xl font-semibold transition w-full ${
          disabled ? "bg-black/30 text-white/60 cursor-not-allowed" : "text-white"
        }`}
        style={!disabled ? { background: "#7A3BFF", boxShadow: "0 6px 14px rgba(22,119,255,0.3)" } : {}}
      >
        {ctaLabel}
      </button>

      {!!hint && <div className="mt-2 text-xs text-zinc-400 text-center">{hint}</div>}

      {isYearly && !tier.popular && (
        <div className="mt-3 text-xs font-semibold text-green-500">
          Save {(1 - (tier.yearlyPerMonth / tier.monthly)) * 100 | 0}% on yearly
        </div>
      )}
    </div>
  );

  if (!tier.popular) return <div className="relative">{core}</div>;
  return (
    <div className="relative">
      <div className="p-[2px] rounded-2xl bg-[#7A3BFF] shadow-lg">
        {core}
      </div>
    </div>
  );
}

function SecondaryCard({ title, price, subtitle, ctaLabel, to, children }) {
  return (
    <div className="rounded-2xl bg-[#F7F5FA] border border-black p-6 flex flex-col justify-between text-[#110829] shadow-xl">
      <div>
        <div className="text-2xl font-semibold">{title}</div>
        <div className="mt-1 text-3xl font-bold">{price}</div>
        {subtitle && <div className="mt-1 text-sm text-[#4A4A55] font-semibold">{subtitle}</div>}
        <div className="mt-5 text-sm text-[#4A4A55] leading-6">{children}</div>
      </div>
      <div className="mt-6">
        <Link
          to={to}
          className="inline-flex justify-center items-center h-11 rounded-xl px-4 font-semibold transition bg-[#7A3BFF] text-white"
   
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */
export default function Pricing() {

  useEffect(() => {
  document.title = "Plans Built For Growth";
}, []);

  const [billing, setBilling] = useState("monthly");
  const { plan, hasSub } = useCurrentPlan();
  const [askTier, setAskTier] = useState(null); // {id, name}

  const planLabel = useMemo(() => {
    const t = TIERS.find((t) => t.id === plan);
    return t ? t.name : plan === "free" ? "Free" : "—";
  }, [plan]);

  return (
    <section className="bg-[#F7F5FA] text-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-14">
        {/* Heading */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#110829]">
            The right plan,{" "}
            <span className="text-[#7A3BFF] bg-clip-text ">
              for the right team
            </span>
          </h1>
          <p className="text-[#4A4A55] font-semibold mt-3">Start free. Upgrade when you’re ready. Cancel anytime.</p>
          <p className="text-[#4A4A55] mt-1 text-sm">V1 uses the best AI model available right now.</p>

          {/* current plan badge */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ECE8F2]  px-3 py-2 text-sm">
            <span className="text-[#4A4A55] font-semibold">Your plan:</span>
            <span className="font-semibold text-[#110829]">{planLabel}</span>
            {hasSub && (
              <button
                onClick={() => openBillingPortal({ flow: "change_plan", returnPath: "/settings" })}
                className="ml-2 rounded-full bg-white text-black px-3 py-1 text-xs font-semibold hover:bg-gray-100"
              >
                Manage / Billing portal
              </button>
            )}
          </div>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-900 p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                billing === "monthly" ? "bg-[#121826] text-white" : "text-zinc-300"
              }`}
            >
              Monthly
            </button>
      
          </div>
        </div>

        {/* Main tier grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((t) => (
            <PlanCard
              key={t.id}
              tier={t}
              billing={billing}
              currentPlan={plan}
              hasSub={hasSub}
              onAskDowngrade={(tier) => setAskTier(tier)}
            />
          ))}
        </div>

        {/* “All plans include” */}
        <div className="mt-10 rounded-2xl border border-[#ECE8F2] bg-[#ECE8F2] p-5">
          <div className=" text-center text-sm font-bold mb-4 text-[#110829] ">All plans include</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-sm text-[#4A4A55]">
            {ALL_INCLUDE.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-[#7A3BFF]">
                  <Tick className="w-4 h-4" />
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Secondary row: Free & Enterprise */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <SecondaryCard
            title="Free"
            price="$0"
            subtitle="Try ZyloAI with weekly credits"
            ctaLabel="Try for free"
            to="/signup"
          >
            10 minutes and 1 AI avatar per week, 4 exports per week with a small watermark.
            Access to core tools so you can learn the workflow.
          </SecondaryCard>

          <SecondaryCard
            title="Enterprise"
            price="Custom"
            subtitle="For organizations that need scale"
            ctaLabel="Contact sales"
            to="/contact"
          >
            SSO & roles, unlimited workspaces, custom model options, SLAs and priority support.
            Flexible invoicing and procurement support.
          </SecondaryCard>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h3 className="text-center text-xl font-bold mb-4 text-[#110829]">FAQs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="rounded-xl border border-black p-4 bg-white">
              <div className="font-semibold mb-1 text-[#110829]">Can I cancel anytime?</div>
              <p className="text-[#4A4A55]">
                Yes. Manage your plan in the Stripe billing portal. Your plan stays active until the end of the paid period.
              </p>
            </div>
            <div className="rounded-xl border border-black p-4 bg-white">
              <div className="font-semibold text-[#110829] mb-1">Do unused credits roll over?</div>
              <p className="text-[#4A4A55]">
                Your balance is additive—monthly plan credits add to your remaining balance. One-time packs never expire.
              </p>
            </div>
            <div className="rounded-xl border border-black p-4 bg-white">
              <div className="font-semibold text-[#110829] mb-1">How do upgrades/downgrades work?</div>
              <p className="text-[#4A4A55]">
                Both upgrades and downgrades are handled in the Stripe billing portal. Upgrades are usually prorated instantly; downgrades take effect on your next renewal.
              </p>
            </div>
            <div className="rounded-xl border border-black p-4 bg-white">
              <div className="font-semibold text-[#110829] mb-1">Do you offer refunds?</div>
              <p className="text-[#4A4A55]">
                14-day money-back guarantee. Contact support if you’re not satisfied.
              </p>
            </div>
          </div>
        </div>

        {/* Top-ups */}
        <div className="mt-12">
          <h3 className="text-center text-xl font-bold text-[#110829] mb-4">Need more credits?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TOPUPS.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl bg-white border border-zinc-800 p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="text-lg font-semibold text-[#110829]">{p.title}</div>
                  <div className="mt-1 text-3xl font-bold text-[#110829]">${p.price}</div>
                  <div className="text-sm text-[#4A4A55]">{p.credits} credits</div>
                </div>

                <button
                  onClick={async () => {
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) {
                      window.location.href = "/signup";
                      return;
                    }
                    const priceId = TOPUP_PRICE_IDS[p.id];
                    if (!priceId) {
                      alert("Top-up price ID not configured for: " + p.id);
                      return;
                    }
                    try {
                      await startCheckout({ type: "topup", priceId });
                    } catch (err) {
                      console.error("Top-up checkout error", err);
                      alert("Could not start checkout. Please try again.");
                    }
                  }}
                  className="bg-[#7A3BFF] mt-6 inline-flex justify-center items-center h-11 rounded-xl font-semibold transition w-full"
               
                >
                  Buy Pack
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Trust row */}
        <div className="mt-10 text-center">
          <div className="text-xs text-zinc-500">
            14-day money-back guarantee · Secure checkout · No hidden fees
          </div>
          <Link
            to="/features"
            className="border-[#7A3BFF] text-[#7A3BFF] inline-flex items-center justify-center mt-4 h-11 px-6 rounded-xl font-semibold transition border"
        
          >
            See more
          </Link>
        </div>
      </div>

      {/* Downgrade modal */}
      <ConfirmModal
        open={!!askTier}
        targetLabel={askTier?.name}
        onCancel={() => setAskTier(null)}
        onConfirm={() => {
          setAskTier(null);
          openBillingPortal({ flow: "change_plan", returnPath: "/pricing" });
        }}
      />
    </section>
  );
}
