import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { startCheckout } from "../../lib/payments";
import { supabase } from "../../lib/supabaseClient";
import { formatMoney } from "../../lib/planPrices";
import KeyButton from "../ui/zyvo/KeyButton";
import { FOCUS, cx } from "../ui/zyvo/styles";
import { DISPLAY_FONT } from "./PlanCards";
import { LoadError, Num, usePricingData } from "./PricingData";

function Heading({ eyebrow, children, sub }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300">{eyebrow}</p>
      <h2 style={DISPLAY_FONT} className="mt-1 text-[32px] font-extrabold uppercase leading-none text-white sm:text-[38px]">{children}</h2>
      {sub && <p className="mt-2 max-w-[65ch] text-[13px] text-white/50">{sub}</p>}
    </div>
  );
}

/**
 * Real example videos, each made with Zyvo. An entry without a public `src`
 * is not shown (the Long Form sample needs a public copy first).
 */
export const EXAMPLES = [
  {
    id: "fruit",
    tool: "AI Fruit Story",
    title: "Ken Reads Everything",
    meta: "AI Fruit Story · V2 · 9:16",
    src: "https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/fruit/a8ad2f35-6ad4-4071-bdae-4555afd13f51/b102da41-abee-4e66-b4ff-c01e20bfc716/final-f1d897c2-4304-488a-80cc-f8165af5651b.mp4",
    aspect: "9:16",
  },
  {
    id: "longForm",
    tool: "Long Form",
    title: "How did ancient humans hunt",
    meta: "Long Form · V3 · 16:9 · first 60 s of a 9.6-min video",
    src: null,
    aspect: "16:9",
  },
];

export function MadeWithZyvo() {
  const shown = EXAMPLES.filter((e) => e.src);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="examples-title">
      <Heading eyebrow="Made with Zyvo"><span id="examples-title">Real videos from Zyvo tools</span></Heading>
      <div className="flex flex-wrap gap-4">
        {shown.map((e) => (
          <figure key={e.id} className={cx("m-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F1112]", e.aspect === "9:16" ? "w-full max-w-[300px]" : "w-full max-w-[640px] flex-1")}>
            <video src={e.src} controls playsInline preload="metadata" className={cx("block w-full bg-black", e.aspect === "9:16" ? "aspect-[9/16]" : "aspect-video")} />
            <figcaption className="flex items-center justify-between gap-3 p-3">
              <span>
                <span className="block text-[13px] font-bold text-white">{e.title}</span>
                <span className="block text-[11px] text-white/40">{e.meta}</span>
              </span>
              <span className="shrink-0 rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-lime-300">Made with Zyvo</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const INCLUDED = [
  "Every Zyvo tool and template",
  "Long Form YouTube videos",
  "Viral Video Builder and Script Builder",
  "Brand creation",
  "Watermark-free exports",
  "Private creation library",
  "Email support",
  "Cancel anytime",
];

export function EveryPlanIncludes() {
  return (
    <section aria-labelledby="included-title" className="rounded-[24px] border border-white/[0.07] bg-[#0F1112] p-5 sm:p-6">
      <h2 id="included-title" className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">Every plan includes</h2>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {INCLUDED.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[13px] text-white/70"><Check className="h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />{f}</li>
        ))}
      </ul>
    </section>
  );
}

export function Topups() {
  const { prices } = usePricingData();
  const packs = prices.status === "ready" ? Object.entries(prices.prices.topups) : [];
  const best = packs.length ? packs.reduce((a, b) => (b[1].credits / b[1].price > a[1].credits / a[1].price ? b : a))[0] : null;
  return (
    <section aria-labelledby="packs-title">
      <Heading eyebrow="On your plan" sub="One-time packs. They never expire and stack on top of your plan."><span id="packs-title">Need more credits?</span></Heading>
      {prices.status === "error" && <LoadError what="pack prices" onRetry={prices.retry} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(packs.length ? packs : [["mini"], ["standard"], ["max"]]).map(([id, pack]) => (
          <div key={id} className={cx("flex flex-col gap-3 rounded-2xl border p-4", id === best ? "border-lime-300/35 bg-lime-300/[0.04]" : "border-white/[0.08] bg-[#111314]")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{id} pack</span>
              {id === best && <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[9px] font-black uppercase text-[#11150D]">Most credits per €</span>}
            </div>
            <p className="text-[26px] font-black leading-none text-white"><Num status={prices.status} value={pack?.price} format={(v) => formatMoney(v, prices.prices.currency)} /></p>
            <p className="text-[12.5px] text-white/50"><Num status={prices.status} value={pack?.credits} /> credits</p>
            <KeyButton size="md" variant={id === best ? "lime" : "white"} disabled={!pack}
              onClick={async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { window.location.href = "/signup"; return; }
                await startCheckout({ type: "topup", pack: id, userId: user.id, email: user.email });
              }}>Buy pack</KeyButton>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FreePlan() {
  const { account } = usePricingData();
  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-white/[0.07] bg-[#0F1112] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="free-title">
      <div>
        <h2 id="free-title" style={DISPLAY_FONT} className="text-[28px] font-extrabold uppercase leading-none text-white">Free</h2>
        <p className="mt-1.5 max-w-[56ch] text-[13px] text-white/50">Sign up free to look around every tool and its examples. Making videos needs a plan. No card needed to sign up.</p>
      </div>
      {!account.signedIn && (
        <Link to="/signup" className={cx("inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 px-5 text-[14px] font-bold text-white/75 hover:text-white", FOCUS)}>Sign up free</Link>
      )}
    </section>
  );
}

const FAQS = [
  { q: "Can I cancel anytime?", a: "Yes. Manage your plan in the Stripe portal. It stays active until the end of your paid period, with no surprise charges." },
  { q: "Do prices include VAT?", a: "Yes. The prices shown are what you pay; Stripe includes VAT in them." },
  { q: "Do unused credits roll over?", a: "Monthly credits add to your balance; they don't reset to zero. One-time packs never expire." },
  { q: "How do upgrades and downgrades work?", a: "Both are handled securely in Stripe. Upgrades are instant (prorated). Downgrades take effect at your next renewal." },
  { q: "Do you offer refunds?", a: "Unused credits are refundable within 7 days. Once credits are spent, refunds can't be issued because of AI generation costs." },
  { q: "What do V2, V3 and V4 mean?", a: "They're quality tiers for Zyvo's templates and Long Form. V2 is on every plan, V3 needs Pro, V4 needs Generative. Higher tiers look sharper and use more credits." },
  { q: "Is there a free plan?", a: "You can sign up free and look around every tool and its examples. Making videos needs a plan." },
];

export function Faq() {
  const [open, setOpen] = useState(null);
  return (
    <section aria-labelledby="faq-title">
      <Heading eyebrow="Questions"><span id="faq-title">Frequently asked</span></Heading>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {FAQS.map((f, i) => (
          <div key={f.q} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0F1112]">
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}
              className={cx("flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[13.5px] font-semibold text-white/80 hover:bg-white/[0.02]", FOCUS)}>
              {f.q}
              <ChevronDown className={cx("h-4 w-4 shrink-0 text-white/35 transition-transform motion-reduce:transition-none", open === i && "rotate-180")} aria-hidden="true" />
            </button>
            {open === i && <p className="px-5 pb-5 text-[13px] leading-relaxed text-white/50">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
