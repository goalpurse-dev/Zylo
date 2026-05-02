import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { startCheckout, openBillingPortal } from "../lib/payments";
import { supabase } from "../lib/supabaseClient";
import { Check, ChevronDown, Shield } from "lucide-react";

/* ─── Stripe IDs ─────────────────────────────────────────────────────────── */
const PRICE_IDS = {
  starter:    "price_1TGKT6Htn4q5rIncI47V5Ein",
  pro:        "price_1TGKSqHtn4q5rIncIf8RPa6e",
  generative: "price_1TGKSSHtn4q5rIncSTurqkCN",
};
const TOPUP_PRICE_IDS = {
  mini:     "price_1TGKjDHtn4q5rInczlym0Dcz",
  standard: "price_1SpZczHtn4q5rInctZoF9rJV",
  max:      "price_1TGKjxHtn4q5rIncQzzCGyrR",
};

/* ─── Plan data ───────────────────────────────────────────────────────────── */
const TIERS = [
  {
    id: "starter",
    name: "Starter",
    monthly: 12,
    yearlyPerMonth: 10,
    blurb: "For creators just getting started",
    accent: "#38BDF8",
    glow:   "rgba(56,189,248,0.12)",
    btnFrom: "#1E6FA8",
    btnTo:   "#2E9EDB",
    features: [
      "600 credits / month",
      "Up to 200 AI images",
      "Up to 30 AI videos",
      "Up to 300 viral scripts",
      "Image & video prompts per scene",
      "Watermark-free exports",
      "Private creation library",
      "Standard generation speed",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 25,
    yearlyPerMonth: 21,
    blurb: "What 80% of viral creators use",
    popular: true,
    accent: "#A855F7",
    glow:   "rgba(168,85,247,0.22)",
    btnFrom: "#7A3BFF",
    btnTo:   "#A855F7",
    strikethrough: 32,
    badge: "25% OFF",
    features: [
      "1,200 credits / month",
      "Up to 400 AI images",
      "Up to 60 AI videos",
      "Up to 600 viral scripts",
      "Image & video prompts per scene",
      "Watermark-free exports",
      "Private creation library",
      "Priority generation queue",
      "Advanced prompt controls",
    ],
  },
  {
    id: "generative",
    name: "Generative",
    monthly: 50,
    yearlyPerMonth: 42,
    blurb: "Built for high-output production",
    accent: "#FB923C",
    glow:   "rgba(251,146,60,0.12)",
    btnFrom: "#B45309",
    btnTo:   "#F97316",
    features: [
      "2,500 credits / month",
      "Up to 830 AI images",
      "Up to 125 AI videos",
      "Up to 1,250 viral scripts",
      "Image & video prompts per scene",
      "Watermark-free exports",
      "Unlimited creation history",
      "Fast-lane generation",
      "Priority support",
    ],
  },
];

const TOPUPS = [
  { id: "mini",     price: 6.99,  credits: 300 },
  { id: "standard", price: 11.99, credits: 500, best: true },
  { id: "max",      price: 19.99, credits: 900 },
];

const FAQS = [
  { q: "Can I cancel anytime?",
    a: "Yes. Manage your plan in the Stripe portal. It stays active until the end of your paid period — no surprise charges." },
  { q: "Do unused credits roll over?",
    a: "Monthly credits add to your balance — they don't reset to zero. One-time packs never expire." },
  { q: "How do upgrades and downgrades work?",
    a: "Both are handled securely in Stripe. Upgrades are instant (prorated). Downgrades take effect at your next renewal." },
  { q: "Do you offer refunds?",
    a: "Unused credits are refundable within 7 days. Once credits are spent, refunds can't be issued due to AI generation costs." },
  { q: "What can I create with Zyvo?",
    a: "Scroll-stopping AI images in 20+ styles, viral short-form videos, image-to-video, and AI-powered viral scripts with image & video prompts per scene — all export-ready, no watermark." },
  { q: "Is there a free plan?",
    a: "Yes — sign up free and get 5 image generations to try Zyvo. No card required. Upgrade anytime you want more." },
];

const TESTIMONIALS = [
  { text: "Went from 0 to 40K followers in 6 weeks using Zyvo videos.", name: "Sarah M.", role: "Content creator" },
  { text: "My ROAS doubled when I switched to AI-generated product images.", name: "Marcus T.", role: "E-commerce brand" },
  { text: "I cancel every tool that doesn't pay for itself. Zyvo pays 10x.", name: "Priya S.", role: "Digital marketer" },
];

const RECENT_SIGNUPS = [
  { name: "Sarah M.", action: "upgraded to Pro" },
  { name: "Marcus T.", action: "just signed up" },
  { name: "Lena K.", action: "upgraded to Pro" },
  { name: "James R.", action: "upgraded to Generative" },
  { name: "Priya S.", action: "just signed up" },
  { name: "Tom H.", action: "upgraded to Pro" },
];

const AVATAR_GRADIENTS = [
  ["#7A3BFF","#A855F7"],
  ["#1E6FA8","#38BDF8"],
  ["#A855F7","#C084FC"],
  ["#FB923C","#F97316"],
  ["#38BDF8","#7A3BFF"],
  ["#7A3BFF","#C084FC"],
];

const PARTICLE_CONFIG = [
  { x: 8,  y: 18, size: 3, dur: 7,   del: 0,   color: "#A855F7" },
  { x: 85, y: 55, size: 2, dur: 10,  del: 2.5, color: "#38BDF8" },
  { x: 42, y: 75, size: 2, dur: 8.5, del: 4,   color: "#A855F7" },
  { x: 68, y: 10, size: 3, dur: 9,   del: 1,   color: "#38BDF8" },
  { x: 22, y: 65, size: 2, dur: 11,  del: 5.5, color: "#FB923C" },
  { x: 92, y: 35, size: 2, dur: 7.5, del: 3,   color: "#A855F7" },
  { x: 55, y: 90, size: 2, dur: 12,  del: 7,   color: "#38BDF8" },
  { x: 14, y: 42, size: 2, dur: 9.5, del: 1.5, color: "#A855F7" },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const USD = 1.08;
function fmt(eur, currency) {
  const val = currency === "USD" ? eur * USD : eur;
  const sym = currency === "USD" ? "$" : "€";
  return `${sym}${Number.isInteger(val) ? val.toFixed(0) : val.toFixed(2)}`;
}
function tierRank(id) { return TIERS.findIndex(t => t.id === id); }

function useCurrentPlan() {
  const [state, setState] = useState({ plan: "free", hasSub: false, loading: true });
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setState({ plan: "free", hasSub: false, loading: false });
      const { data } = await supabase
        .from("profiles").select("plan_code, stripe_subscription_id").eq("id", user.id).single();
      const planCode = data?.plan_code || "free";
      const activeSub = !!data?.stripe_subscription_id;
      // treat as paid if either: has active sub ID, or plan_code is a known paid tier
      const isPaid = activeSub || (planCode !== "free" && planCode !== null);
      setState({ plan: planCode, hasSub: activeSub, isPaid, loading: false });
    })();
  }, []);
  return state;
}

/* ─── Live counter ────────────────────────────────────────────────────────── */
function useLiveCounter(start) {
  const [count, setCount] = useState(start);
  useEffect(() => {
    const id = setInterval(() => {
      setCount(c => c + Math.floor(Math.random() * 4) + 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);
  return count.toLocaleString();
}

/* ─── Particles ───────────────────────────────────────────────────────────── */
function Particles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PARTICLE_CONFIG.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            animation: `particleFloat ${p.dur}s ease-in-out ${p.del}s infinite`,
            opacity: 0.15,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Signup toast ────────────────────────────────────────────────────────── */
function SignupToast() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setIdx(i => (i + 1) % RECENT_SIGNUPS.length);
      setToastKey(k => k + 1);
    }, 3500);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;
  const s = RECENT_SIGNUPS[idx];
  const [gradFrom, gradTo] = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];

  return (
    <div
      key={toastKey}
      className="flex fixed bottom-[84px] md:bottom-6 left-4 md:left-5 z-50 items-center gap-3 px-4 py-3 rounded-2xl signup-toast-enter"
      style={{
        background: "rgba(13,15,28,0.94)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
        style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
      >
        {s.name[0]}
      </div>
      <div>
        <div className="text-white text-xs font-semibold leading-tight">
          {s.name}{" "}
          <span className="text-white/40 font-normal">{s.action}</span>
        </div>
        <div className="text-white/25 text-[10px]">just now</div>
      </div>
    </div>
  );
}

/* ─── Confirm downgrade ───────────────────────────────────────────────────── */
function ConfirmModal({ open, onCancel, onConfirm, targetLabel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-[24px] bg-[#0D0F1C] p-6 shadow-2xl"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        <p className="text-white font-bold text-lg mb-2">Confirm downgrade</p>
        <p className="text-white/50 text-sm leading-relaxed">
          Switch to <span className="text-white font-semibold">{targetLabel}</span>? You keep your plan until end of billing period. Changes are managed in Stripe.
        </p>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 bg-white/5 hover:bg-white/10 transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-100 transition">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── FAQ accordion ───────────────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0D0F1C" }}>
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-white/[0.03] transition">
        <span className="text-sm font-semibold text-white/80">{q}</span>
        <ChevronDown className={`w-4 h-4 text-white/30 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40" : "max-h-0"}`}>
        <p className="px-5 pb-5 text-sm text-white/40 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ─── Plan card ───────────────────────────────────────────────────────────── */
function PlanCard({ tier, billing, currentPlan, hasSub, currency, onAskDowngrade, animClass }) {
  const isYearly = billing === "yearly";
  const eurPrice = isYearly ? tier.yearlyPerMonth : tier.monthly;
  const priceStr = fmt(eurPrice, currency);
  const curRank = tierRank(currentPlan);
  const thisRank = tierRank(tier.id);
  const isPopular = !!tier.popular;

  let cta = "Get started";
  let disabled = false;
  if (tier.id === currentPlan)                { cta = "Current plan"; disabled = true; }
  else if (thisRank > curRank && curRank >= 0) cta = "Upgrade";
  else if (thisRank < curRank && curRank >= 0) cta = "Downgrade";
  else if (currentPlan === "free") {
    if (tier.id === "starter")    cta = "Start going viral";
    else if (tier.id === "pro")   cta = "Go Pro";
    else                          cta = "Go all-in";
  }

  async function handleClick() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return (window.location.href = "/signup");
    const priceId = PRICE_IDS[tier.id];
    if (!priceId) return;
    if (hasSub) return openBillingPortal({ flow: "change_plan", returnPath: "/pricing" });
    if (thisRank < curRank) return onAskDowngrade(tier);
    await supabase.from("abandoned_checkouts").upsert(
      { email: user.email, status: "pending", recovery_stage: 0, recovered: false, paid: false, updated_at: new Date().toISOString() },
      { onConflict: "email" }
    );
    await startCheckout({ type: "subscription", priceId, userId: user.id, email: user.email,
      metadata: { email: user.email, plan: tier.id } });
  }

  return (
    <div
      className={`relative flex flex-col flex-1 rounded-[24px] overflow-hidden pricing-card-hover ${isPopular ? "pro-border-pulse" : ""} ${animClass}`}
      style={{
        background: isPopular
          ? "linear-gradient(160deg, #130B28 0%, #1C0A3A 40%, #0E0E20 100%)"
          : "linear-gradient(160deg, #0B0D1A 0%, #0E1020 100%)",
        boxShadow: isPopular ? undefined : "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Colored top bar */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${tier.accent}CC, ${tier.accent}40)` }} />

      {/* Popular badge */}
      {isPopular && (
        <div className="absolute top-4 right-4 text-[10px] font-bold tracking-[0.1em] px-3 py-1 rounded-full"
          style={{ background: `${tier.accent}20`, color: tier.accent, border: `1px solid ${tier.accent}40` }}>
          MOST POPULAR
        </div>
      )}

      {tier.badge && !isPopular && (
        <div className="absolute top-4 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400"
          style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
          {tier.badge}
        </div>
      )}

      <div className="flex flex-col flex-1 p-6 md:p-7">

        {/* Plan name + blurb */}
        <div className="mb-5">
          <div className="text-base font-bold mb-0.5" style={{ color: tier.accent }}>{tier.name}</div>
          <div className="text-white/35 text-xs">{tier.blurb}</div>
        </div>

        {/* Price */}
        <div className="mb-1 flex items-end gap-2">
          {tier.strikethrough && (
            <span className="text-sm text-white/20 line-through mb-1.5">{fmt(tier.strikethrough, currency)}</span>
          )}
          <span className="text-[52px] font-extrabold leading-none tracking-tighter text-white">{priceStr}</span>
          <span className="text-white/30 text-sm mb-2">/mo</span>
        </div>

        {isYearly && (
          <div key={`save-${tier.id}-yearly`} className="text-xs font-semibold text-green-400 mb-1 savings-badge-pop">
            Save {Math.round((1 - tier.yearlyPerMonth / tier.monthly) * 100)}% · {fmt(tier.yearlyPerMonth * 12, currency)}/yr
          </div>
        )}

        <div className="text-xs text-white/20 mb-4">
          {tier.id === "starter"    && `≈ ${fmt(0.4, currency)} per day`}
          {tier.id === "pro"        && `≈ ${fmt(0.83, currency)} per day`}
          {tier.id === "generative" && "Unlimited production capacity"}
        </div>

        {/* Urgency — pro only */}
        {isPopular && (
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 blink-dot" />
            <span className="text-[11px] font-medium" style={{ color: "rgba(248,113,113,0.85)" }}>
              Pro plan: 23 spots left at this price
            </span>
          </div>
        )}

        {/* CTA button */}
        <button
          disabled={disabled}
          onClick={handleClick}
          className="w-full py-3.5 rounded-2xl font-bold text-sm mb-4 transition-all duration-200 active:scale-[0.97] btn-pulse"
          style={disabled ? {
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.25)",
            cursor: "default",
          } : {
            background: `linear-gradient(135deg, ${tier.btnFrom}, ${tier.btnTo})`,
            color: "#fff",
            boxShadow: `0 8px 28px ${tier.glow}`,
          }}
        >
          {cta}
        </button>

        {/* Progress bar — pro only */}
        {isPopular && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-white/30">78% of creators choose Pro</span>
              <span className="text-[10px] font-bold" style={{ color: tier.accent }}>78%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: "78%", background: `linear-gradient(90deg, ${tier.btnFrom}, ${tier.accent})` }}
              />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="mb-5" style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

        {/* Feature list */}
        <ul className="space-y-3 flex-1">
          {tier.features.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm check-item"
              style={{ animationDelay: `${0.3 + i * 0.06}s` }}
            >
              <Check className="w-4 h-4 mt-[1px] shrink-0" style={{ color: tier.accent + "CC" }} />
              <span className="text-white/50">{f}</span>
            </li>
          ))}
        </ul>

        {!disabled && (
          <p className="text-center text-[11px] text-white/15 mt-6">Instant access · Cancel anytime</p>
        )}
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function Pricing() {
  const billing = "monthly";
  const [currency, setCurrency] = useState("EUR");
  const [askTier, setAskTier] = useState(null);
  const { plan, hasSub, isPaid, loading: planLoading } = useCurrentPlan();
  const liveCount = useLiveCounter(2000847);

  useEffect(() => { document.title = "Pricing — Zyvo AI"; }, []);

  const planLabel = useMemo(() => {
    const t = TIERS.find(t => t.id === plan);
    return t?.name ?? (plan === "free" ? "Free" : "—");
  }, [plan]);

  // Mobile carousel — Pro (index 1) starts centred
  const mobileTiers = TIERS;
  const carouselRef = useRef(null);
  const [activeCard, setActiveCard] = useState(1);

  // Scroll to Pro on mount
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    // Small delay so layout is painted before we scroll
    const id = setTimeout(() => {
      const cardW = el.scrollWidth / mobileTiers.length;
      el.scrollLeft = cardW; // skip Starter, land on Pro
    }, 80);
    return () => clearTimeout(id);
  }, []);

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const cardW = el.scrollWidth / mobileTiers.length;
    const idx = Math.round(el.scrollLeft / cardW);
    setActiveCard(Math.min(Math.max(idx, 0), mobileTiers.length - 1));
  };

  return (
    <section className="relative min-h-screen text-white overflow-x-hidden" style={{ background: "#07080F" }}>

      {/* Particles */}
      <Particles />

      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(122,59,255,0.12) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] right-[-100px] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(251,146,60,0.06) 0%, transparent 70%)" }} />
        <div className="absolute top-[30%] left-[-80px] w-[350px] h-[350px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-[1100px] mx-auto px-4 sm:px-6 py-10 md:py-16 pb-28 md:pb-16">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="text-center mb-10 md:mb-14">

          {/* Mobile hero */}
          <div className="md:hidden pricing-hero">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white font-semibold">{liveCount}</span>&nbsp;creations and counting
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-3">
              Go viral.<br />
              <span style={{ background: "linear-gradient(90deg,#A855F7,#C084FC)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Or it's free.
              </span>
            </h1>
            <p className="text-white/40 text-sm mb-6 max-w-xs mx-auto">
              Pick your plan. Start creating viral content today.
            </p>
          </div>

          {/* Desktop hero */}
          <div className="hidden md:block pricing-hero">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white font-semibold">{liveCount}</span>&nbsp;creations and counting
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-4">
              Go viral.{" "}
              <span style={{ background: "linear-gradient(90deg,#A855F7,#C084FC,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Or it's free.
              </span>
            </h1>
            <p className="text-white/40 text-base max-w-lg mx-auto mb-8">
              Generate images and videos that stop the scroll. Pick the plan that matches your output.
            </p>
          </div>

          {/* Stats row — desktop only */}
          <div className="hidden md:flex items-center justify-center gap-10 mb-8 pricing-hero-sub">
            {[
              { stat: liveCount, label: "AI creations made" },
              { stat: "800+",    label: "Active creators" },
              { stat: "4.9★",   label: "Average rating" },
            ].map(({ stat, label }) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-white font-bold text-2xl">{stat}</span>
                <span className="text-white/25 text-xs mt-0.5">{label}</span>
              </div>
            ))}
          </div>

          {/* Currency toggle */}
          <div className="flex items-center justify-center pricing-toggle">
            <div className="flex items-center rounded-2xl p-1"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {["EUR", "USD"].map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={currency === c ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
                    : { color: "rgba(255,255,255,0.3)" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Plan cards — desktop ──────────────────────────────────────── */}
        <div className="hidden md:grid grid-cols-3 gap-4 lg:gap-5" id="pricing-section">
          {TIERS.map((t, i) => (
            <PlanCard key={t.id} tier={t} billing={billing} currentPlan={plan} hasSub={hasSub}
              currency={currency} onAskDowngrade={setAskTier}
              animClass={`pricing-card-${i + 1}`} />
          ))}
        </div>

        {/* ── Plan cards — mobile carousel ─────────────────────────────── */}
        <div className="md:hidden -mx-4">
          {/* Scrollable track */}
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="pricing-carousel flex items-stretch gap-3 overflow-x-auto px-4"
            style={{
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {/* Leading spacer so first card can snap to centre */}
            <div className="shrink-0 w-[calc((100vw-72vw)/2-8px)]" />

            {mobileTiers.map((t, i) => (
              <div
                key={t.id}
                className="shrink-0 w-[72vw] flex flex-col"
                style={{ scrollSnapAlign: "center" }}
              >
                <PlanCard
                  tier={t}
                  billing={billing}
                  currentPlan={plan}
                  hasSub={hasSub}
                  currency={currency}
                  onAskDowngrade={setAskTier}
                  animClass={`pricing-card-${i + 1}`}
                />
              </div>
            ))}

            {/* Trailing spacer */}
            <div className="shrink-0 w-[calc((100vw-72vw)/2-8px)]" />
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {mobileTiers.map((t, i) => (
              <button
                key={t.id}
                onClick={() => {
                  const el = carouselRef.current;
                  if (!el) return;
                  const cardW = el.scrollWidth / mobileTiers.length;
                  el.scrollTo({ left: cardW * i, behavior: "smooth" });
                }}
                className="transition-all duration-200"
                style={{
                  width: activeCard === i ? 20 : 6,
                  height: 6,
                  borderRadius: 99,
                  background: activeCard === i ? t.accent : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Guarantee strip ───────────────────────────────────────────── */}
        <div className="flex items-center justify-center mt-6 mb-3">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Shield className="w-4 h-4 shrink-0" style={{ color: "#A855F7" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Not happy in 7 days?{" "}
              <span className="text-white font-bold">Unused credits refunded.</span>{" "}
              No questions asked.
            </p>
          </div>
        </div>

        {!planLoading && isPaid && (
          <p className="text-center text-xs mt-3 mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            Current plan: <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{planLabel}</span>
          </p>
        )}

        {/* ── Testimonials ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8 mb-10 pricing-section">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="rounded-[20px] p-5 flex flex-col gap-4" style={{ background: "#0D0F1C" }}>
              <p className="text-sm leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                "{t.text}"
              </p>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: `linear-gradient(135deg, ${AVATAR_GRADIENTS[i][0]}, ${AVATAR_GRADIENTS[i][1]})` }}
                >
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{t.name}</div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── All plans include ─────────────────────────────────────────── */}
        <div className="rounded-[20px] p-5 md:p-6 mb-10 pricing-section"
          style={{ background: "#0D0F1C" }}>
          <p className="text-center text-[11px] font-bold tracking-[0.15em] uppercase mb-4"
            style={{ color: "rgba(255,255,255,0.2)" }}>
            Every plan includes
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-y-3 gap-x-4">
            {["Viral Script Builder", "Brand creation", "Ad creation", "Top quality exports", "Email support"].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#A855F7" }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* ── Credit top-ups — only for users with an active paid plan ── */}
        {!planLoading && isPaid && (
          <div className="mb-12 pricing-section">
            <div className="flex flex-col items-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-3"
                style={{ background: "rgba(168,85,247,0.12)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.25)" }}>
                ✦ Available on your plan
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Need more credits?</h3>
              <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                One-time packs · never expire · stack on top of your plan
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TOPUPS.map(p => (
                <div key={p.id} className="relative rounded-[20px] p-5 flex flex-col gap-4 pricing-card-hover"
                  style={{
                    background: p.best ? "linear-gradient(160deg,#130B28,#1C0A3A)" : "#0D0F1C",
                    boxShadow: p.best ? "0 0 0 1px rgba(168,85,247,0.3), 0 16px 40px rgba(168,85,247,0.12)" : "none",
                  }}>
                  {p.best && (
                    <div className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                      style={{ background: "rgba(168,85,247,0.15)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.3)" }}>
                      BEST VALUE
                    </div>
                  )}
                  <div>
                    <div className="text-xs uppercase tracking-wider mb-1.5"
                      style={{ color: "rgba(255,255,255,0.25)" }}>{p.id} pack</div>
                    <div className="text-3xl font-extrabold text-white">{fmt(p.price, currency)}</div>
                    <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{p.credits} credits</div>
                  </div>
                  <button
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return (window.location.href = "/signup");
                      await startCheckout({ type: "topup", pack: p.id, userId: user.id, email: user.email });
                    }}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
                    style={p.best ? {
                      background: "linear-gradient(135deg,#7A3BFF,#A855F7)",
                      color: "#fff",
                      boxShadow: "0 6px 20px rgba(122,59,255,0.3)",
                    } : {
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.7)",
                    }}>
                    Buy Pack
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Free + Enterprise ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 pricing-section">
          {[
            { label: "Free", price: fmt(0, currency), sub: "5 image generations to start",
              desc: "Try Zyvo with monthly free credits. No card required.", cta: "Try for free", to: "/signup" },
            { label: "Enterprise", price: "Custom", sub: "For teams and organizations",
              desc: "SSO & roles, unlimited workspaces, custom models, SLAs and priority support.", cta: "Contact sales", to: "/support/contact" },
          ].map(item => (
            <div key={item.label} className="rounded-[20px] p-6 flex flex-col gap-4" style={{ background: "#0D0F1C" }}>
              <div>
                <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>{item.label}</div>
                <div className="text-3xl font-extrabold text-white">{item.price}</div>
                <div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{item.sub}</div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</p>
              <Link to={item.to}
                className="inline-flex justify-center items-center py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98]"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                {item.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <div className="mb-14 pricing-section">
          <h3 className="text-2xl font-bold text-white text-center mb-1">Frequently asked</h3>
          <p className="text-center text-sm mb-6" style={{ color: "rgba(255,255,255,0.25)" }}>
            Everything you need to know before upgrading.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>

        {/* ── Trust footer ──────────────────────────────────────────────── */}
        <div className="text-center pt-6 flex flex-col items-center gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-6 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            <span>🔒 Stripe-secured</span>
            <span>⚡ Instant access</span>
            <span>✕ Cancel anytime</span>
          </div>
          <Link to="/workspace/home"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }}>
            ← Back to workspace
          </Link>
        </div>

      </div>

      {/* Cycling signup toast */}
      <SignupToast />

      <ConfirmModal
        open={!!askTier}
        targetLabel={askTier?.name}
        onCancel={() => setAskTier(null)}
        onConfirm={() => { setAskTier(null); openBillingPortal({ flow: "change_plan", returnPath: "/pricing" }); }}
      />
    </section>
  );
}
