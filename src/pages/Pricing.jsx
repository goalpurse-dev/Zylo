// src/components/Pricing.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { startCheckout, openBillingPortal } from "../lib/payments";
import { supabase } from "../lib/supabaseClient";



/** >>> YOUR REAL STRIPE PRICE IDS <<< */
const PRICE_IDS = {
  starter: "price_1TGKT6Htn4q5rIncI47V5Ein",
  pro: "price_1TGKSqHtn4q5rIncIf8RPa6e",
  generative: "price_1TGKSSHtn4q5rIncSTurqkCN",
};

/** >>> TOP-UP STRIPE PRICE IDS <<< */
const TOPUP_PRICE_IDS = {
  mini: "price_1TGKjDHtn4q5rInczlym0Dcz",     // €6.99
  standard: "price_1SpZczHtn4q5rInctZoF9rJV",  // €11.99
  max: "price_1TGKjxHtn4q5rIncQzzCGyrR",       // €19.99
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
  monthly: 12,
  yearlyPerMonth: 10,
  blurb: "Launch faster with enough credits for consistent weekly content",
  popular: false,
  features: [
    "600 credits / month",
    "Up to 200 images",
    "Generate up to 30 AI videos",
    "Watermark-free exports",
    "Private creation library",
    "Standard generation speed",
    "Email support",
    "30 generations / day"
  ],
},
{
  id: "pro",
  name: "Pro",
  monthly: 25,
  yearlyPerMonth: 21,
  blurb: "Most creators choose this to go viral faster",
  popular: true,
  features: [
    "1,200 credits / month",
    "Create up to 400 AI images",
    "Generate up to 60 AI videos",
    "Watermark-free exports",
    "Private creation library",
    "Priority generation queue",
    "Advanced prompt controls",
    "Email support",
    "100 generations / day"
  ],
},
{
  id: "generative",
  name: "Generative",
  monthly: 50,
  yearlyPerMonth: 42,
  blurb: "Built for high-output workflows, serious production, and faster iteration",
  popular: false,
  features: [
    "2,500 credits / month",
    "Create up to 830 AI images",
    "Generate up to 125 AI videos",
    "Watermark-free exports",
    "Unlimited creation history",
    "Fast-lane generation",
    "Advanced prompt controls",
    "Priority support",
    "300 generations / day"
  ],
}
];

const TOPUPS = [
  { id: "mini", title: "Mini", price: 6.99, credits: 300, to: "/buy/credits?pack=mini" },
  { id: "standard", title: "Standard", price: 11.99, credits: 500, to: "/buy/credits?pack=standard" },
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
const usdRate = 1.08;

function formatPrice(eurAmount, currency) {
  const value =
    currency === "USD" ? eurAmount * usdRate : eurAmount;

  const symbol = currency === "USD" ? "$" : "€";

  return `${symbol}${Number.isInteger(value)
    ? value.toFixed(0)
    : value.toFixed(2)
  }`;
}
/* ------------------------------- UI cards ------------------------------- */
function PlanCard({ tier, billing, currentPlan, hasSub, onAskDowngrade, currency }) {
  
  const isYearly = billing === "yearly";
const eurPrice = isYearly ? tier.yearlyPerMonth : tier.monthly;

// simple conversion (you can later make dynamic)
const usdRate = 1.08;
const displayPrice =
  currency === "USD" ? eurPrice * usdRate : eurPrice;

const symbol = currency === "USD" ? "$" : "€";

const priceStr = `${symbol}${Number.isInteger(displayPrice)
  ? displayPrice.toFixed(0)
  : displayPrice.toFixed(2)
}`;
const subline =
  isYearly
    ? `billed annually ${formatPrice(eurPrice * 12, currency)}`
    : "/month";

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
} else if (curRank >= 0 && thisRank < curRank) {
  ctaLabel = "Downgrade";
} else if (currentPlan === "free") {
  if (tier.id === "starter") {
    ctaLabel = "Start basic";
  } else if (tier.id === "pro") {
    ctaLabel = "Go Pro ";
  } else if (tier.id === "generative") {
    ctaLabel = "Go All-In ";
  }
}
async function onClick() {
  console.log("🔥 CLICK DETECTED");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("❌ no user");
    return (window.location.href = "/signup");
  }

  console.log("🔥 USER:", user.email);

  const priceId = PRICE_IDS[tier.id];
  if (!priceId) return alert("Price ID not configured.");

  if (hasSub) {
    console.log("⚠️ has subscription, skipping tracking");
    return openBillingPortal({ flow: "change_plan", returnPath: "/pricing" });
  }

  console.log("🔥 ABOUT TO INSERT");

const { data: existing } = await supabase
  .from("abandoned_checkouts")
  .select("*")
  .eq("email", user.email)
  .maybeSingle();

await supabase.from("abandoned_checkouts").upsert(
  {
    email: user.email,
    recovery_stage: existing?.recovery_stage ?? 0,
    created_at: existing?.created_at ?? new Date().toISOString(),
    paid: false,
    recovered: false,
  },
  { onConflict: "email" }
);

  

  // 👇 WAIT SO YOU CAN SEE LOGS
  await new Promise(res => setTimeout(res, 1500));

  await startCheckout({
    type: "subscription",
    priceId,
    userId: user.id,
    email: user.email,
  });
}

  const core = (
 <div
  className={`relative overflow-hidden rounded-[22px] border p-5 md:p-6 flex flex-col h-full text-[#F4F6FB] transition ${
    tier.popular
      ? "border-[#7A3BFF]/70 bg-[linear-gradient(180deg,rgba(20,22,34,0.98),rgba(11,14,26,0.98))] shadow-[0_0_0_1px_rgba(122,59,255,0.12),0_20px_80px_rgba(122,59,255,0.16)]"
      : "border-white/10 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
  }`}
>
  <div className={`absolute inset-x-0 top-0 h-[2px] ${
    tier.popular
      ? "bg-gradient-to-r from-[#6D4AFF] via-[#9F5CFF] to-[#4D8DFF]"
      : "bg-white/10"
  }`} />
      {tier.popular && (
  <div className="text-xs text-[#CDAEFF] font-semibold mb-1">
    MOST POPULAR
  </div>
)}



      <div className="mb-2 font-bold text-xl">{tier.name}</div>

   <div className="mt-1 flex items-baseline gap-2">
  <div className="text-4xl font-bold">{priceStr}</div>
  <div className="text-sm text-[#B7BBC6] font-semibold">/month</div>
</div>

<button
  disabled={disabled}
  onClick={onClick}
className={`mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl font-semibold transition  ${
  disabled
    ? "cursor-not-allowed bg-white/10 text-white/50"
    : tier.id === "pro"
      ? " hover:scale-[1.06] bg-[linear-gradient(90deg,#8B5CFF,#6D4AFF)] text-white font-semibold shadow-[0_10px_40px_rgba(139,92,255,0.35)] scale-[1.04] ring-1 ring-[#8B5CFF]/40"
      : "bg-[linear-gradient(90deg,#7A3BFF_0%,#9F5CFF_55%,#4D8DFF_100%)] text-white shadow-[0_10px_30px_rgba(122,59,255,0.28)]"
}`}
>
{ctaLabel}
</button>

      
      

      <div className="text-sm text-[#B7BBC6] font-semibold mt-2">{tier.blurb}</div>

      <div className="mt-3 inline-flex w-fit items-center rounded-full border border-[#2A2F45] bg-[#1A1D2B] px-3 py-1 text-xs font-semibold text-[#DDE3F0]">
  {tier.id === "starter" && `From only ${formatPrice(0.4, currency)}/day`}
  {tier.id === "pro" && `From only ${formatPrice(0.83, currency)}/day`}
  {tier.id === "generative" && "Built for daily production"}
</div>



      <ul className="mt-6 space-y-3 text-sm text-[#C7D0E0]">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
           <span className="mt-[2px] text-[#8B5CFF] shrink-0">
              <Tick className="w-4 h-4" />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>



      {!disabled && (
<div className="mt-3 text-center text-xs text-[#7F8AA3]">
  Instant access • Cancel anytime
</div>
)}

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
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] p-6 flex flex-col justify-between text-[#E6E8EE] shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
      <div>
        <div className="text-2xl font-semibold">{title}</div>
        <div className="mt-1 text-3xl font-bold">{price}</div>
        {subtitle && <div className="mt-1 text-sm text-[#B7BBC6] font-semibold">{subtitle}</div>}
        <div className="mt-5 text-sm text-[#B7BBC6] leading-6">{children}</div>
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

  const [currency, setCurrency] = useState("EUR");

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
<section className="relative bg-[#090B12] text-white">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,64,160,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(122,59,255,0.10),transparent_28%)]" />
  <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_18%,transparent_82%,rgba(255,255,255,0.02))]" />

  <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-14">
        {/* Heading */}
{/* Header */}
<div className="mx-auto max-w-3xl text-center mb-6 md:mb-10">
  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-[#C9D1E8] backdrop-blur-sm">
    Trusted by 800+ creators
  </div>

  <h1 className="mt-4 text-3xl md:text-6xl font-extrabold tracking-[-0.03em] leading-[1.05] text-white">
    Go Viral With{" "}
    <span className="bg-gradient-to-r from-[#9F5CFF] via-[#7A3BFF] to-[#4D8DFF] bg-clip-text text-transparent">
      AI Content
    </span>
  </h1>

  
  <p className="mt-4 text-sm md:text-lg text-[#AAB3C5]">
    Create faster, test more ideas, and scale what works.
  </p>
</div>

<div className="flex justify-center mb-6">
  <div className="flex bg-[#1A1D2B] border border-white/10 rounded-xl p-1">
    {["EUR", "USD"].map((c) => (
      <button
        key={c}
        onClick={() => setCurrency(c)}
        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
          currency === c
            ? "bg-[linear-gradient(90deg,#7A3BFF,#9F5CFF)] text-white"
            : "text-[#9DA8BD]"
        }`}
      >
        {c}
      </button>
    ))}
  </div>
</div>



    


        <div className="hidden md:grid grid-cols-3 gap-4 mb-8 mt-4">
 <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
  <div className="text-sm font-semibold text-white">Move faster</div>
  <p className="mt-1 text-sm text-[#9DA8BD]">
    Turn ideas into publish-ready content in minutes.
  </p>
</div>

 <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
  <div className="text-sm font-semibold text-white">Test more ideas</div>
  <p className="mt-1 text-sm text-[#9DA8BD]">
    Generate more variations without slowing down.
  </p>
</div>

<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
  <div className="text-sm font-semibold text-white">Scale what works</div>
  <p className="mt-1 text-sm text-[#9DA8BD]">
    Upgrade when you’re ready for higher output.
  </p>
</div>
</div>


{/* 🔥 MOBILE QUICK ACTION */}
<div className="md:hidden mb-5 mt-4">
  <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,31,0.96),rgba(10,12,20,0.96))] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
    
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs text-[#9DA8BD]">Plans start from</div>

        <div className="mt-1 text-2xl font-extrabold text-white">
        {formatPrice(12, currency)}<span className="text-sm font-medium text-[#9DA8BD]"> /month</span>
        </div>

        <div className="text-[11px] text-[#7F8AA3] mt-1">
          Cancel anytime • Instant access
        </div>
      </div>

      <button
        onClick={() => {
          document.getElementById("pricing-section")?.scrollIntoView({ behavior: "smooth" });
        }}
        className="rounded-xl bg-[linear-gradient(90deg,#7A3BFF_0%,#9F5CFF_55%,#4D8DFF_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(122,59,255,0.28)]"
      >
        View Plans
      </button>
    </div>

  </div>
</div>

        {/* Main tier grid */}
        <div id="pricing-section" className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-2 md:mt-6">
          {TIERS.map((t) => (
            <PlanCard
              key={t.id}
              tier={t}
              billing={billing}
              currentPlan={plan}
              hasSub={hasSub}
              currency={currency}
              onAskDowngrade={(tier) => setAskTier(tier)}
            />
          ))}
        </div>

 <div className="mt-10 hidden md:block text-center text-xs text-[#7F8AA3]">
  Current plan: <span className="text-white font-semibold">{planLabel}</span>
</div>
       

        {/* “All plans include” */}
       <div className="relative mt-10 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
          <div className="mb-4 text-center text-sm font-semibold tracking-[0.08em] uppercase text-[#D7DDF0]">
  All plans include
</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-sm text-[#C7D0E0]">
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
            price={formatPrice(0, currency)}
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
            to="/support/contact"
          >
            SSO & roles, unlimited workspaces, custom model options, SLAs and priority support.
            Flexible invoicing and procurement support.
          </SecondaryCard>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h3 className="text-center text-xl font-bold mb-4 text-[#F4F6FB]">FAQs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="rounded-xl border border-white/10 p-4 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <div className="font-semibold mb-1 text-[#E6E8EE]">Can I cancel anytime?</div>
              <p className="text-[#B7BBC6]">
                Yes. Manage your plan in the Stripe billing portal. Your plan stays active until the end of the paid period.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 p-4 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <div className="font-semibold mb-1 text-[#E6E8EE]">Do unused credits roll over?</div>
              <p className="text-[#B7BBC6]">
                Your balance is additive—monthly plan credits add to your remaining balance. One-time packs never expire.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 p-4 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <div className="font-semibold mb-1 text-[#E6E8EE]">How do upgrades/downgrades work?</div>
              <p className="text-[#B7BBC6]">
                Both upgrades and downgrades are handled in the Stripe billing portal. Upgrades are usually prorated instantly; downgrades take effect on your next renewal.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 p-4 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <div className="font-semibold mb-1 text-[#E6E8EE]">Do you offer refunds?</div>
              <p className="text-[#B7BBC6]">
                Unused credits are refundable within 7 days. Once credits are used, refunds cannot be issued due to AI generation costs.
              </p>
            </div>
          </div>
        </div>

      {/* Top-ups (only for paid plans) */}
{plan !== "free" && (
  <div className="mt-12">
    <h3 className="text-center text-xl font-bold text-[#F4F6FB] mb-4">
      Need more credits?
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {TOPUPS.map((p) => (
        <div
          key={p.id}
         className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))] p-6 flex flex-col justify-between shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
        >
          <div>
            <div className="text-lg font-semibold text-[#F4F6FB]">
              {p.title}
            </div>

            <div className="mt-1 text-3xl font-bold text-[#F4F6FB]">
              {formatPrice(p.price, currency)}
            </div>

            <div className="text-sm text-[#B7BBC6]">
              {p.credits} credits
            </div>
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
                await startCheckout({ type: "topup", pack: p.id });
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
)}

        {/* Trust row */}
        <div className="mt-10 text-center">
          <div className="text-xs text-zinc-500">
            Secure checkout · Instant access · No hidden fees
          </div>
          <Link
            to="/workspace/home"
            className="border-[#2A2F45] bg-[#1A1D2B] text-[#E6E8EE] inline-flex items-center justify-center mt-4 h-11 px-6 rounded-xl font-semibold transition border"
        
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
