import { useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabaseClient"
import { Check } from "lucide-react"
import { startCheckout } from "../lib/payments"

/* ─── Pricing data (mirrors Pricing.jsx) ─────────────────────────── */
const PLAN_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "€12",
    priceNote: "/mo",
    blurb: "Launch faster with enough credits for consistent weekly content",
    popular: false,
    cta: "Start Starter",
    perDay: "From only €0.40/day",
    features: [
      "600 credits / month",
      "Up to 200 AI images",
      "30 AI videos / month",
      "All styles & models",
      "Watermark-free exports",
      "Private creation library",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€25",
    originalPrice: "€32",
    priceNote: "/mo",
    blurb: "Most creators choose this to go viral faster",
    popular: true,
    cta: "Go Pro",
    badge: "25% OFF",
    perDay: "From only €0.83/day",
    features: [
      "1,200 credits / month",
      "Up to 400 AI images",
      "60 AI videos / month",
      "Priority generation queue",
      "Advanced prompt controls",
      "Watermark-free exports",
    ],
  },
  {
    id: "generative",
    name: "Generative",
    price: "€50",
    priceNote: "/mo",
    blurb: "Built for high-output workflows and serious production",
    popular: false,
    cta: "Go All-In",
    perDay: "Built for daily production",
    features: [
      "2,500 credits / month",
      "Up to 830 AI images",
      "125 AI videos / month",
      "Fast-lane generation",
      "Unlimited creation history",
      "Priority support",
    ],
  },
]

const PRICE_IDS = {
  starter: "price_1TGKT6Htn4q5rIncI47V5Ein",
  pro: "price_1TGKSqHtn4q5rIncIf8RPa6e",
  generative: "price_1TGKSSHtn4q5rIncSTurqkCN",
}

/* ─── Reusable tick ──────────────────────────────────────────────── */
const Tick = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

/* ─── Progress dots ──────────────────────────────────────────────── */
function Steps({ current, total }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-10">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i + 1 === current ? 24 : 8,
            height: 8,
            background: i + 1 <= current ? "linear-gradient(90deg,#7A3BFF,#9D6BFF)" : "rgba(255,255,255,0.1)",
          }}
        />
      ))}
    </div>
  )
}

/* ─── Option card (steps 1–2) ────────────────────────────────────── */
function OptionCard({ icon, emoji, label, sublabel, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/[0.07] bg-[#111318] hover:border-[#7A3BFF]/50 hover:bg-[#16192A] transition-all duration-200 text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-[#1A1D2B] border border-white/10 flex items-center justify-center shrink-0 group-hover:border-[#7A3BFF]/30 transition text-lg">
        {emoji ? <span>{emoji}</span> : icon && <img src={icon} className="w-5 h-5 opacity-80" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{label}</div>
        {sublabel && <div className="text-white/40 text-xs mt-0.5">{sublabel}</div>}
      </div>
      <div className="text-white/20 group-hover:text-[#7A3BFF] transition text-lg">→</div>
    </button>
  )
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function OnboardingModal({ user, onComplete }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState({ content_type: "", goal: "", experience: "", email_updates: false })
  const [loading, setLoading] = useState(false)

  const next = () => setStep((s) => s + 1)

  const handleFinish = async () => {
    try {
      setLoading(true)

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ email_updates: data.email_updates, onboarding_completed: true })
        .eq("id", user.id)

      if (profileError) console.error("PROFILE UPDATE ERROR:", profileError)

      const { error: onboardingError } = await supabase
        .from("user_onboarding")
        .upsert(
          { user_id: user.id, content_type: data.content_type, goal: data.goal, experience: data.experience, email_updates: data.email_updates },
          { onConflict: "user_id" }
        )

      if (onboardingError) console.error("ONBOARDING ERROR:", onboardingError)

      localStorage.setItem("onboarding_completed", "true")
      onComplete?.()
      return true
    } catch (err) {
      console.error("HANDLE FINISH ERROR:", err)
      return false
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-[#07080F] overflow-y-auto">

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-[#7A3BFF]/10 blur-[120px]" />
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-start px-4 py-10">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <img src="/assets/ai/robot.webp" alt="Zyvo" className="w-8 h-8 rounded-full border border-[#7A3BFF]/30" />
          <span className="text-white font-bold text-lg tracking-tight">Zyvo</span>
        </div>

        <div className={`w-full ${step === 4 ? "max-w-5xl" : "max-w-lg"}`} key={step} style={{ animation: "fadeSlideUp 0.35s ease forwards" }}>

          <Steps current={step} total={4} />

          {/* ── STEP 1 ───────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="text-center mb-8">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#7A3BFF] mb-3">Step 1 of 4</div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  What do you want to create?
                </h2>
                <p className="text-white/40 text-sm mt-2">We'll personalise your experience</p>
              </div>
              <div className="flex flex-col gap-3">
                <OptionCard emoji="🎵" label="Viral TikTok videos" sublabel="Short-form content that blows up" onClick={() => { setData(p => ({ ...p, content_type: "tiktok" })); next() }} />
                <OptionCard emoji="▶️" label="YouTube Shorts" sublabel="Quick content for the YouTube algorithm" onClick={() => { setData(p => ({ ...p, content_type: "shorts" })); next() }} />
                <OptionCard emoji="🖼️" label="AI Images" sublabel="Generate viral visuals and product shots" onClick={() => { setData(p => ({ ...p, content_type: "images" })); next() }} />
                <OptionCard emoji="🛍️" label="Product content" sublabel="Ads, listings, and brand visuals" onClick={() => { setData(p => ({ ...p, content_type: "product" })); next() }} />
              </div>
            </>
          )}

          {/* ── STEP 2 ───────────────────────────────────── */}
          {step === 2 && (
            <>
              <button onClick={() => setStep(s => s - 1)} className="text-xs text-white/30 hover:text-white mb-6 transition flex items-center gap-1">
                ← Back
              </button>
              <div className="text-center mb-8">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#7A3BFF] mb-3">Step 2 of 4</div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  What's your main goal?
                </h2>
                <p className="text-white/40 text-sm mt-2">This helps us show you the right tools first</p>
              </div>
              <div className="flex flex-col gap-3">
                <OptionCard emoji="🚀" label="Go viral" sublabel="Blow up on TikTok, Reels, or Shorts" onClick={() => { setData(p => ({ ...p, goal: "viral" })); next() }} />
                <OptionCard emoji="💰" label="Make money" sublabel="Monetise content and grow revenue" onClick={() => { setData(p => ({ ...p, goal: "money" })); next() }} />
                <OptionCard emoji="📈" label="Grow a page" sublabel="Build an audience and increase reach" onClick={() => { setData(p => ({ ...p, goal: "grow" })); next() }} />
                <OptionCard emoji="🧭" label="Just exploring" sublabel="See what Zyvo can do" onClick={() => { setData(p => ({ ...p, goal: "explore" })); next() }} />
              </div>
            </>
          )}

          {/* ── STEP 3 ───────────────────────────────────── */}
          {step === 3 && (
            <>
              <button onClick={() => setStep(s => s - 1)} className="text-xs text-white/30 hover:text-white mb-6 transition flex items-center gap-1">
                ← Back
              </button>
              <div className="text-center mb-8">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#7A3BFF] mb-3">Step 3 of 4</div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  Stay ahead of the curve
                </h2>
                <p className="text-white/40 text-sm mt-3 max-w-sm mx-auto">
                  Get viral prompts, new AI tools, and creator tips before everyone else — straight to your inbox.
                </p>
              </div>

              {/* Opt-in card */}
              <div
                onClick={() => setData(p => ({ ...p, email_updates: !p.email_updates }))}
                className={`cursor-pointer flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 mb-6 ${
                  data.email_updates
                    ? "border-[#7A3BFF]/50 bg-[#16192A]"
                    : "border-white/[0.07] bg-[#111318] hover:border-[#7A3BFF]/30"
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                  data.email_updates ? "bg-[#7A3BFF] border-[#7A3BFF]" : "border-white/20"
                }`}>
                  {data.email_updates && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">Send me viral prompts & updates</div>
                  <div className="text-white/40 text-xs mt-1">Weekly drops. No spam, ever. Unsubscribe anytime.</div>
                </div>
              </div>

              <button
                onClick={next}
                className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm transition hover:brightness-110 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#7A3BFF,#9D6BFF)", boxShadow: "0 4px 20px rgba(122,59,255,0.4)" }}
              >
                Continue →
              </button>
            </>
          )}

          {/* ── STEP 4: PRICING ──────────────────────────── */}
          {step === 4 && (
            <div className="w-full max-w-5xl mx-auto">
              <button onClick={() => setStep(s => s - 1)} className="text-xs text-white/30 hover:text-white mb-6 transition flex items-center gap-1">
                ← Back
              </button>

              <div className="text-center mb-6">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#7A3BFF] mb-3">Step 4 of 4</div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                  Choose your plan
                </h2>
                <p className="text-white/40 text-sm mt-2">Upgrade anytime. Cancel anytime. No hidden fees.</p>
              </div>

              {/* ── Free tier CTA — above plans ── */}
              <div className="flex flex-col items-center gap-2.5 mb-6">
                <div className="w-full sm:w-auto p-[1px] rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(122,59,255,0.5), rgba(157,107,255,0.2), rgba(122,59,255,0.1))" }}>
                  <button
                    onClick={async () => {
                      const success = await handleFinish()
                      if (success) window.location.href = "/workspace/home"
                    }}
                    disabled={loading}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-[15px] font-semibold text-white text-[15px] tracking-[-0.01em] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5 group"
                    style={{ background: "linear-gradient(135deg, rgba(122,59,255,0.12), rgba(10,8,22,0.9))" }}
                    onMouseEnter={(e) => (e.currentTarget.parentElement.style.background = "linear-gradient(135deg, rgba(122,59,255,0.8), rgba(157,107,255,0.5), rgba(122,59,255,0.3))")}
                    onMouseLeave={(e) => (e.currentTarget.parentElement.style.background = "linear-gradient(135deg, rgba(122,59,255,0.5), rgba(157,107,255,0.2), rgba(122,59,255,0.1))")}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9D6BFF] group-hover:bg-white transition-colors duration-200" />
                    Continue for free
                    <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-white/35">
                  <svg className="w-3 h-3 text-[#7A3BFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <span>10 free image generations · No credit card needed</span>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <span className="text-xs text-white/25 font-medium whitespace-nowrap">or unlock more with a plan</span>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>

              {/* Cards — scrollable row on mobile, 3-col on desktop */}
              <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible pb-2 snap-x snap-mandatory">
                {PLAN_TIERS.map((plan) => (
                  <div
                    key={plan.id}
                    className="relative min-w-[270px] md:min-w-0 snap-center flex flex-col"
                  >
                    {/* Popular glow backdrop */}
                    {plan.popular && (
                      <div className="absolute -inset-2 bg-[#7A3BFF]/15 blur-2xl rounded-3xl pointer-events-none" />
                    )}

                    {/* Card border wrapper (purple ring for popular) */}
                    <div className={`relative flex flex-col flex-1 rounded-[22px] ${plan.popular ? "p-[1.5px] bg-gradient-to-b from-[#9D6BFF] to-[#7A3BFF]" : ""}`}>
                      <div className={`relative flex flex-col flex-1 rounded-[21px] p-5 ${
                        plan.popular
                          ? "bg-[linear-gradient(180deg,rgba(20,14,40,0.98),rgba(10,8,22,0.98))]"
                          : "bg-[#111318] border border-white/[0.08]"
                      }`}>

                        {/* Top accent line */}
                        <div className={`absolute top-0 inset-x-8 h-px ${plan.popular ? "bg-gradient-to-r from-transparent via-[#9D6BFF]/60 to-transparent" : "bg-white/[0.06]"}`} />

                        {/* Popular badge */}
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] px-3 py-1 rounded-full bg-gradient-to-r from-[#7A3BFF] to-[#9D6BFF] text-white font-bold tracking-wide shadow-lg whitespace-nowrap">
                            MOST POPULAR
                          </div>
                        )}

                        {/* Discount badge */}
                        {plan.badge && (
                          <div className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-md bg-[#FF4D6D]/10 text-[#FF4D6D] border border-[#FF4D6D]/20 font-bold">
                            {plan.badge}
                          </div>
                        )}

                        {/* Name */}
                        <div className="text-white font-bold text-base mb-2">{plan.name}</div>

                        {/* Price row */}
                        <div className="flex items-end gap-1.5 mb-1">
                          {plan.originalPrice && (
                            <div className="text-sm text-white/30 line-through mb-0.5">{plan.originalPrice}</div>
                          )}
                          <div className="text-3xl font-extrabold text-white leading-none">{plan.price}</div>
                          <div className="text-xs text-white/40 mb-0.5">{plan.priceNote}</div>
                        </div>

                        {/* Per-day callout */}
                        <div className="text-[11px] text-[#9D6BFF] font-medium mb-3">{plan.perDay}</div>

                        {/* Blurb */}
                        <div className="text-xs text-white/50 leading-relaxed mb-4">{plan.blurb}</div>

                        {/* CTA */}
                        <button
                          disabled={loading}
                          onClick={async () => {
                            try {
                              setLoading(true)

                              const { error: profileError } = await supabase
                                .from("profiles")
                                .update({ email_updates: data.email_updates, onboarding_completed: true })
                                .eq("id", user.id)

                              if (profileError) console.error("ONBOARDING SAVE FAILED:", profileError)

                              localStorage.setItem("onboarding_completed", "true")

                              const { data: { user: currentUser } } = await supabase.auth.getUser()

                              await startCheckout({
                                type: "subscription",
                                priceId: PRICE_IDS[plan.id],
                                userId: currentUser.id,
                                email: currentUser.email,
                              })
                            } catch (err) {
                              console.error("CHECKOUT ERROR:", err)
                            } finally {
                              setLoading(false)
                            }
                          }}
                          className="w-full rounded-xl py-2.5 font-bold text-sm text-white mb-4 transition active:scale-[0.98] disabled:opacity-50"
                          style={plan.popular
                            ? { background: "linear-gradient(135deg,#8B5CFF,#6D4AFF)", boxShadow: "0 4px 20px rgba(122,59,255,0.5)" }
                            : { background: "linear-gradient(135deg,#7A3BFF,#9F5CFF)" }
                          }
                          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
                        >
                          {loading ? "Loading..." : plan.cta}
                        </button>

                        {/* Feature list */}
                        <ul className="space-y-2 flex-1">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-start gap-2.5 text-xs text-white/65">
                              <span className="text-[#9D6BFF] mt-[1px] shrink-0"><Tick /></span>
                              {f}
                            </li>
                          ))}
                        </ul>

                        {/* Cancel note */}
                        <div className="mt-4 text-center text-[10px] text-white/25">Instant access · Cancel anytime</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Try for free — bottom reminder */}
              <div className="flex flex-col items-center mt-5">
                <button
                  onClick={async () => {
                    const success = await handleFinish()
                    if (success) window.location.href = "/workspace/home"
                  }}
                  disabled={loading}
                  className="text-sm text-white/50 hover:text-white transition disabled:opacity-50"
                >
                  No thanks, continue for free →
                </button>
              </div>

            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  )
}
