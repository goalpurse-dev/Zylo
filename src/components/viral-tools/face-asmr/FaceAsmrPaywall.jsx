import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Check, X, Lock } from "lucide-react";
import { startCheckout } from "../../../lib/payments";
import { supabase } from "../../../lib/supabaseClient";

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    monthly: 20, yearlyPerMonth: 16,
    yearlyNote: "Billed $192/yr",
    accent: "#8B5CF6", btnFrom: "#5B21B6", btnTo: "#7C3AED",
    features: ["750 credits / month", "~25 AI videos with sound", "Face ASMR", "AI Fruit Story", "Micro Camera Animal", "Clay Rescue", "Watermark-free exports", "Standard speed"],
    priceIds: { monthly: "price_1TGKT6Htn4q5rIncI47V5Ein", yearly: "price_1TYWNYHtn4q5rIncWMa3mmvI" },
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 42, yearlyPerMonth: 35,
    yearlyNote: "Billed $420/yr",
    accent: "#A855F7", btnFrom: "#7C3AED", btnTo: "#A855F7",
    popular: true,
    features: ["1,600 credits / month", "~53 AI videos with sound", "Face ASMR", "AI Fruit Story", "Micro Camera Animal", "Clay Rescue", "Watermark-free exports", "Priority queue"],
    priceIds: { monthly: "price_1TGKSqHtn4q5rIncIf8RPa6e", yearly: "price_1TYWOWHtn4q5rIncTmN3GXdy" },
  },
  {
    id: "generative",
    name: "Generative",
    monthly: 85, yearlyPerMonth: 70,
    yearlyNote: "Billed $840/yr",
    accent: "#C084FC", btnFrom: "#9333EA", btnTo: "#C084FC",
    features: ["3,200 credits / month", "~106 AI videos with sound", "Face ASMR", "AI Fruit Story", "Micro Camera Animal", "Clay Rescue", "Unlimited history", "Fast-lane generation"],
    priceIds: { monthly: "price_1TGKSSHtn4q5rIncSTurqkCN", yearly: "price_1TYWP8Htn4q5rIncbugChVhS" },
  },
];

async function handleSubscribe(tier, billing) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (window.location.href = "/signup");
  await startCheckout({
    type: "subscription",
    priceId: tier.priceIds[billing],
    userId: user.id,
    email: user.email,
    metadata: { email: user.email, plan: tier.id },
  });
}

export default function FaceAsmrPaywall({ open, onClose, isGuest, dismissable = true, toolName = "Face ASMR", previewSrc = "/face/preview.mp4" }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [billing, setBilling] = useState("yearly");

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (open && videoRef.current) videoRef.current.play().catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={dismissable ? onClose : undefined}
      />

      <div
        className="relative z-10 flex w-full max-w-[880px] flex-col overflow-hidden rounded-t-[28px] border border-white/10 sm:rounded-[28px] md:flex-row"
        style={{ background: "linear-gradient(160deg,#0d0f14,#0b0c12)", maxHeight: "92dvh", boxShadow: "0 32px 80px rgba(0,0,0,0.85)" }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/50 transition hover:bg-white/12 hover:text-white"
        >
          <X size={15} />
        </button>

        {/* Left — phone video, desktop only */}
        <div className="relative hidden flex-shrink-0 items-center justify-center bg-black/40 p-8 md:flex md:w-[240px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgba(122,59,255,0.18),transparent)]" />
          <div className="relative w-full max-w-[155px]">
            <div className="overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
              <div className="aspect-[9/19.5] w-full overflow-hidden">
                <video
                  ref={videoRef}
                  src={previewSrc}
                  className="h-full w-full object-cover"
                  autoPlay muted loop playsInline preload="none"
                />
              </div>
            </div>
            <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-white/15" />
          </div>
        </div>

        {/* Right — content */}
        <div className="flex flex-1 flex-col overflow-y-auto">

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4 pr-14 sm:px-6">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
              <Lock size={14} className="text-white/60" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white leading-tight">
                {isGuest ? `Sign up to use ${toolName}` : "Subscription Required"}
              </h2>
              <p className="text-[11px] text-white/40 mt-0.5">
                {isGuest
                  ? `Create a free account to get started with ${toolName}.`
                  : `You need a paid plan to create ${toolName} videos.`}
              </p>
            </div>
          </div>

          {isGuest ? (
            <div className="flex flex-col items-center gap-5 p-6 text-center">
              <div className="relative w-[120px] flex-shrink-0">
                <div className="overflow-hidden rounded-[22px] border border-white/15 bg-black shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
                  <div className="aspect-[9/19.5] w-full overflow-hidden">
                    <video src={previewSrc} className="h-full w-full object-cover" autoPlay muted loop playsInline preload="none" />
                  </div>
                </div>
                <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-white/15" />
              </div>
              <div className="space-y-3 w-full max-w-[300px]">
                <p className="text-[13px] text-white/50">Create your free Zyvo account to start making viral {toolName} videos.</p>
                <button
                  onClick={() => { onClose(); navigate("/signup"); }}
                  className="w-full rounded-[12px] py-3 text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#7A3BFF,#A855F7)" }}
                >Create Free Account →</button>
                <button
                  onClick={() => { onClose(); navigate("/login"); }}
                  className="block w-full text-xs text-white/30 transition hover:text-white/60"
                >Already have an account? Log in</button>
              </div>
            </div>
          ) : (
            <>
              {/* Billing toggle */}
              <div className="flex justify-center pt-4 pb-0">
                <div
                  className="inline-flex items-center rounded-full p-1 gap-0.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {["yearly", "monthly"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setBilling(opt)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200"
                      style={billing === opt
                        ? { background: "linear-gradient(135deg,#7C3AED,#A855F7)", color: "#fff" }
                        : { color: "rgba(255,255,255,0.35)" }}
                    >
                      {opt === "yearly" ? "Annual" : "Monthly"}
                      {opt === "yearly" && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            background: billing === "yearly" ? "rgba(255,255,255,0.18)" : "rgba(167,243,208,0.15)",
                            color: billing === "yearly" ? "#fff" : "#6EE7B7",
                          }}
                        >–17%</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tier cards */}
              <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-3 sm:p-5">
                {TIERS.map((tier) => {
                  const price = billing === "yearly" ? tier.yearlyPerMonth : tier.monthly;
                  const note  = billing === "yearly" ? tier.yearlyNote : "Billed monthly";
                  return (
                    <div
                      key={tier.id}
                      className="relative flex flex-col overflow-hidden rounded-[18px] border"
                      style={{
                        borderColor: tier.popular ? `${tier.accent}40` : "rgba(255,255,255,0.07)",
                        background: tier.popular ? "linear-gradient(160deg,#130B28,#1C0A3A)" : "rgba(255,255,255,0.02)",
                        boxShadow: tier.popular ? `0 0 36px ${tier.accent}18` : "none",
                      }}
                    >
                      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg,${tier.accent}CC,${tier.accent}30)` }} />

                      {tier.popular && (
                        <div
                          className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                          style={{ background: `${tier.accent}20`, color: tier.accent, border: `1px solid ${tier.accent}40` }}
                        >Popular</div>
                      )}

                      <div className="flex flex-col gap-3 p-4">
                        <div className="text-[13px] font-bold" style={{ color: tier.accent }}>{tier.name}</div>

                        <div className="flex items-center justify-between gap-2 sm:block">
                          <div className="flex items-end gap-1">
                            <span className="text-[28px] font-extrabold leading-none text-white sm:text-[32px]">${price}</span>
                            <span className="mb-1 text-[11px] text-white/30">/mo</span>
                          </div>
                          <button
                            onClick={() => handleSubscribe(tier, billing)}
                            className="flex-shrink-0 rounded-[10px] px-4 py-2 text-[12px] font-bold text-white transition hover:opacity-90 sm:hidden"
                            style={{ background: `linear-gradient(135deg,${tier.btnFrom},${tier.btnTo})` }}
                          >Get {tier.name}</button>
                        </div>

                        <div className="text-[10px] text-white/25">{note}</div>

                        <button
                          onClick={() => handleSubscribe(tier, billing)}
                          className="hidden w-full rounded-[10px] py-2.5 text-[12px] font-bold text-white transition hover:opacity-90 sm:block"
                          style={{ background: `linear-gradient(135deg,${tier.btnFrom},${tier.btnTo})` }}
                        >Get {tier.name}</button>

                        <ul className="space-y-1.5">
                          {tier.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-white/45">
                              <Check size={11} className="mt-0.5 flex-shrink-0" style={{ color: `${tier.accent}CC` }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="px-5 pb-4 text-center">
            <p className="text-[10px] text-white/20">Instant access · Cancel anytime · Billed via Stripe</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
