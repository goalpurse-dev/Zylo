import { useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabaseClient"
import { Image as ImageIcon, TrendingUp, Compass, HomeIcon } from "lucide-react"
import { startCheckout } from "../lib/payments"

export default function OnboardingModal({ user, onComplete }) {

  const [step, setStep] = useState(1)
  const [selectedPlan, setSelectedPlan] = useState("free")

  const [data, setData] = useState({
    content_type: "",
    goal: "",
    experience: "",
    email_updates: false // ✅ NOT pre-checked anymore
  })

  const [loading, setLoading] = useState(false)

  const next = () => setStep((s) => s + 1)

const handleFinish = async () => {
  try {
    setLoading(true)

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        email_updates: data.email_updates,
        onboarding_completed: true
      })
      .eq("id", user.id)

    if (profileError) {
      console.error("PROFILE UPDATE ERROR:", profileError)
      // ❗ DO NOT BLOCK USER
    }

    const { error: onboardingError } = await supabase
      .from("user_onboarding")
      .upsert(
        {
          user_id: user.id,
          content_type: data.content_type,
          goal: data.goal,
          experience: data.experience,
          email_updates: data.email_updates
        },
        { onConflict: "user_id" }
      )

    if (onboardingError) {
      console.error("ONBOARDING ERROR:", onboardingError)
    }

    // 🔥 fallback safety
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

 const Option = ({ value, label, icon, Icon }) => (
  <button
    onClick={() => {
      setData(prev => ({ ...prev, [value.key]: value.val }))
      next()
    }}
    className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-[#191B1C] hover:bg-[#1A1D2B] border border-white/5 text-white text-sm font-medium transition"
  >
    {/* IMAGE ICON */}
    {icon && <img src={icon} className="w-5 h-5 opacity-80" />}

    {/* LUCIDE ICON */}
    {Icon && <Icon className="w-5 h-5 text-white opacity-80" />}

    <span>{label}</span>
  </button>
)

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-[#090A0A] overflow-y-auto">

     <div className="min-h-screen flex flex-col justify-start px-4 py-6">

       <div className="w-full max-w-6xl mx-auto">

          {/* TITLE */}
          <h1 className="text-xl sm:text-3xl md:text-5xl font-extrabold text-center mb-12">
            Let’s build your{" "}
            <span className="bg-gradient-to-r from-[#9F5CFF] via-[#7A3BFF] to-[#4D8DFF] bg-clip-text text-transparent">
              viral engine
            </span>
          </h1>

          {/* BACK */}
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-xs text-white/40 mb-4 hover:text-white"
            >
              ← Back
            </button>
          )}

          <div key={step} className="animate-[fadeIn_0.4s_ease]">

            {/* STEP 1 */}
            {step === 1 && (
              <>
                <div className="text-sm text-white/40 mb-2">Step 1 / 4</div>

                <h2 className="text-xl font-semibold mb-6">
                  What do you want to create?
                </h2>

                <div className="flex flex-col gap-3">
                  <Option value={{ key:"content_type", val:"tiktok" }} label="Viral TikTok videos" icon="/icons/tiktok.png" />
                  <Option value={{ key:"content_type", val:"shorts" }} label="YouTube Shorts" icon="/icons/youtube.png" />
                 <Option value={{ key:"content_type", val:"images" }} label="AI Images" Icon={ImageIcon} />
                  <Option value={{ key:"content_type", val:"product" }} label="Product content" icon="/icons/shopify.png" />
                </div>
              </>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <>
                <div className="text-sm text-white/40 mb-2">Step 2 / 4</div>

                <h2 className="text-xl font-semibold mb-6">
                  What’s your goal?
                </h2>

                <div className="flex flex-col gap-3">
                  <Option value={{ key:"goal", val:"viral" }} label="Go viral" icon="/icons/graph.png" />
                  <Option value={{ key:"goal", val:"money" }} label="Make money" icon="/icons/dollar.png" />
                  <Option value={{ key:"goal", val:"grow" }} label="Grow a page" Icon={TrendingUp}/>
                  <Option value={{ key:"goal", val:"explore" }} label="Just exploring" Icon={Compass}/>
                </div>
              </>
            )}

            {/* STEP 3 */}
            {step === 3 && (
  <>
    <div className="text-sm text-white/40 mb-2">Step 3 / 4</div>

    <h2 className="text-xl font-semibold mb-3">
      Stay ahead with Zyvo
    </h2>

    <p className="text-sm text-white/50 mb-6">
      Get viral prompts, new tools and updates before everyone else.
    </p>

    <label className="flex items-center gap-3 mb-6 cursor-pointer">
      <input
        type="checkbox"
        checked={data.email_updates}
        onChange={(e)=>setData(prev => ({...prev, email_updates: e.target.checked}))}
        className="w-4 h-4 accent-purple-500"
      />
      <span className="text-sm text-white/70">
        Send me viral prompts & updates
      </span>
    </label>

    <button
      onClick={next}
      className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] font-semibold hover:scale-[1.02] transition"
    >
      Next
    </button>
  </>
)}
{step === 4 && (
  <>
    <div className="text-sm text-white/40 mb-2">Step 4 / 4</div>

    <h2 className="text-xl md:text-2xl font-bold mb-6 text-center">
      Choose your plan
    </h2>

    {/* 🔥 MOBILE-OPTIMIZED CARDS */}
    <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible pt-4 pb-2 snap-x">

      {[
        {
          id: "starter",
          name: "Starter",
          price: "€12",
          cta: "Start Starter",
          features: ["600 credits", "30 videos", "200 images"]
        },
        {
          id: "pro",
          name: "Pro",
          price: "€25",
          cta: "Go Pro",
          popular: true,
          features: ["1,200 credits", "60 videos", "Priority"]
        },
        {
          id: "generative",
          name: "Generative",
          price: "€50",
          cta: "Go All-In",
          features: ["2,500 credits", "125 videos", "Fastest"]
        }
      ].map((plan) => (
        <div
          key={plan.id}
          className="relative min-w-[240px] md:min-w-0 snap-center"
        >

          {/* 🔥 SOFT GLOW */}
          {plan.popular && (
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-purple-600/20 blur-2xl opacity-60 rounded-[24px]" />
            </div>
          )}

          {/* 🔥 CARD */}
          <div
            className={`
              relative rounded-[20px] p-4 md:p-6 backdrop-blur-xl
              border

              ${
                plan.popular
                  ? `
                    border-[#7A3BFF]/40
                    bg-[linear-gradient(180deg,rgba(35,20,70,0.7),rgba(10,12,20,0.95))]
                    shadow-[0_20px_50px_rgba(122,59,255,0.25)]
                    scale-[1.02]
                  `
                  : `
                    border-white/10
                    bg-[linear-gradient(180deg,rgba(18,20,31,0.65),rgba(10,12,20,0.95))]
                    shadow-[0_10px_30px_rgba(0,0,0,0.4)]
                  `
              }
            `}
          >

            {/* BADGE */}
            {plan.popular && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white font-semibold">
                MOST POPULAR
              </div>
            )}

            {/* NAME */}
            <div className="text-sm md:text-lg font-semibold text-white">
              {plan.name}
            </div>

            {/* PRICE */}
            <div className="mt-1 flex items-end gap-1">
              <div className="text-2xl md:text-4xl font-bold text-white">
                {plan.price}
              </div>
              <div className="text-[10px] md:text-sm text-white/50 mb-[2px]">
                /mo
              </div>
            </div>

            {/* FEATURES */}
            <div className="mt-3 space-y-2 text-xs md:text-sm text-white/70">
              {plan.features.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-1 h-1 bg-[#8B5CFF] rounded-full mt-[6px]" />
                  {f}
                </div>
              ))}
            </div>

            {/* CTA */}
  <button
  onClick={async () => {
    try {
      setLoading(true)

      // ✅ Save onboarding FIRST (critical)
    const { error: profileError } = await supabase
  .from("profiles")
  .update({
    email_updates: data.email_updates,
    onboarding_completed: true
  })
  .eq("id", user.id)

      if (profileError) {
        console.error("ONBOARDING SAVE FAILED:", profileError)
        return
      }

      // 🔥 Fallback safety (prevents modal from ever showing again)
      localStorage.setItem("onboarding_completed", "true")

      // ✅ Price map
      const priceMap = {
        starter: "price_1TGKT6Htn4q5rIncI47V5Ein",
        pro: "price_1TGKSqHtn4q5rIncIf8RPa6e",
        generative: "price_1TGKSSHtn4q5rIncSTurqkCN"
      }

      // ✅ Get user
      const {
        data: { user: currentUser }
      } = await supabase.auth.getUser()

      // ✅ Then go to Stripe
      await startCheckout({
        type: "subscription",
        priceId: priceMap[plan.id],
        userId: currentUser.id,
        email: currentUser.email
      })

    } catch (err) {
      console.error("CHECKOUT ERROR:", err)
    } finally {
      setLoading(false)
    }
  }}
  className={`
    mt-4 h-9 md:h-11 w-full rounded-lg font-semibold text-sm
    ${
      plan.popular
        ? "bg-gradient-to-r from-[#8B5CFF] to-[#6D4AFF] text-white"
        : "bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] text-white"
    }
  `}
>
  {plan.cta}
</button>

          </div>
        </div>
      ))}
    </div>

    {/* 🔥 ALWAYS VISIBLE ACTIONS */}
    <div className="flex justify-center gap-3 mt-6">

      <button
        onClick={async () => {
  const success = await handleFinish()

  if (success) {
    window.location.href = "/workspace/home"
  }
}}
        className="
          px-4 py-2 rounded-lg text-xs
          bg-[#191B1C]
          border border-white/10
          text-white/70
        "
      >
        Skip
      </button>

      <button
       onClick={async () => {
  const success = await handleFinish()

  if (success) {
    window.location.href = "/workspace/pricing"
  }
}}
        className="
          px-4 py-2 rounded-lg text-xs
          bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6]
          text-white
        "
      >
        Explore Plans
      </button>

    </div>
  </>
)}

          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}