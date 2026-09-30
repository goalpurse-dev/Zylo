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
 * Real example videos, each made with Zyvo (the two Long Form ones are the
 * first 60 s of real finished videos, copied to public-assets/pricing).
 */
const PUB = "https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/";
export const EXAMPLES = {
  fruit: {
    title: "Ken Reads Everything", tool: "AI Fruit Story", tier: "V2", note: "9:16, 26 s",
    src: `${PUB}generated/fruit/a8ad2f35-6ad4-4071-bdae-4555afd13f51/b102da41-abee-4e66-b4ff-c01e20bfc716/final-f1d897c2-4304-488a-80cc-f8165af5651b.mp4`,
  },
  longForm: [
    {
      title: "How did ancient humans hunt", tool: "Long Form", tier: "V3", note: "first 60 s of 9.6 min",
      src: `${PUB}public-assets/pricing/longform-ancient-humans-hunt-60s.mp4`, poster: `${PUB}public-assets/pricing/longform-ancient-humans-hunt-poster.jpg`,
    },
    {
      title: "What did humans do when it rained", tool: "Long Form", tier: "V3", note: "first 60 s of 7.9 min",
      src: `${PUB}public-assets/pricing/longform-humans-rain-60s.mp4`, poster: `${PUB}public-assets/pricing/longform-humans-rain-poster.jpg`,
    },
  ],
};

/** Caption row: fixed height (--c) so the desktop stack math stays exact. */
function ExampleCaption({ e }) {
  return (
    <figcaption className="flex h-14 items-center justify-between gap-3 px-3">
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-white">{e.title}</span>
        <span className="block truncate text-[11px] text-white/40">{e.tool} · {e.tier} · {e.note}</span>
      </span>
      <span className="shrink-0 rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-lime-300">Made with Zyvo</span>
    </figcaption>
  );
}

// Desktop: right column width --r; each Long Form card = r·9/16 video + --c
// caption; the stack = 2 cards + --g gap. The Fruit video is exactly that tall
// minus its own caption, and 9:16 wide, so both sides end on the same line.
// Borders: each card has a 1px border, so a Long Form video is (r − 2px) wide
// and each card is 2px taller than video + caption; the Fruit card gets the
// same 2px back so the two sides end on the same pixel.
const FRUIT_H = "md:h-[calc(2*((var(--r)_-_2px)*9/16_+_var(--c))_+_var(--g)_-_var(--c)_+_2px)]";
const FRUIT_W = "md:w-[calc((2*((var(--r)_-_2px)*9/16_+_var(--c))_+_var(--g)_-_var(--c)_+_2px)*9/16)]";

export function MadeWithZyvo() {
  const { fruit, longForm } = EXAMPLES;
  return (
    <section aria-labelledby="examples-title">
      <Heading eyebrow="Made with Zyvo"><span id="examples-title">Real videos from Zyvo tools</span></Heading>
      <div className="flex flex-col gap-4 [--c:56px] [--g:16px] md:flex-row md:justify-center md:gap-[var(--g)] md:[--r:400px] lg:[--r:520px]">
        <figure className="m-0 mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F1112] md:mx-0 md:w-auto md:max-w-none md:shrink-0">
          <video src={fruit.src} controls playsInline preload="metadata" className={cx("block aspect-[9/16] w-full bg-black object-cover md:aspect-auto", FRUIT_H, FRUIT_W)} />
          <ExampleCaption e={fruit} />
        </figure>
        <div className="flex flex-col gap-4 md:w-[var(--r)] md:shrink-0 md:gap-[var(--g)]">
          {longForm.map((e) => (
            <figure key={e.src} className="m-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F1112]">
              <video src={e.src} poster={e.poster} controls playsInline preload="none" className="block aspect-video w-full bg-black" />
              <ExampleCaption e={e} />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// Each line checked against the product (2026-10-01): every paid plan opens every
// tool; exports carry no watermark; creations are saved per account; support is
// by email/contact form; plans cancel in the Stripe portal. Not listed: "Brand
// creation" and "Viral Video/Script Builder" (not separate tools) and script
// writing (built into some tools, not every one).
const INCLUDED = [
  "Every Zyvo tool and template",
  "Long Form YouTube videos",
  "Watermark-free exports",
  "Your creations saved in your library",
  "Email support",
  "Cancel anytime",
];

export function EveryPlanIncludes() {
  return (
    <section aria-labelledby="included-title" className="rounded-[24px] border border-white/[0.07] bg-[#0F1112] p-5 sm:p-6">
      <h2 id="included-title" className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">Every plan includes</h2>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
        <p className="mt-1.5 max-w-[56ch] text-[13px] text-white/50">Sign up free: 5 AI images every 30 days and a look around every tool. Making videos needs a plan. No card needed.</p>
      </div>
      {!account.signedIn && (
        <Link to="/signup" className={cx("inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 px-5 text-[14px] font-bold text-white/75 hover:text-white", FOCUS)}>Sign up free</Link>
      )}
    </section>
  );
}

const FAQS = [
  { q: "Can I cancel anytime?", a: "Yes. Manage your plan in the Stripe portal. It stays active until the end of your paid period, with no surprise charges." },
  { q: "Do unused credits roll over?", a: "Monthly credits add to your balance; they don't reset to zero. One-time packs never expire." },
  { q: "How do upgrades and downgrades work?", a: "Both are handled securely in Stripe. Upgrades are instant (prorated). Downgrades take effect at your next renewal." },
  { q: "Do you offer refunds?", a: "Unused credits are refundable within 7 days. Once credits are spent, refunds can't be issued because of AI generation costs." },
  { q: "What do V2, V3 and V4 mean?", a: "They're quality tiers for Zyvo's templates and Long Form. V2 is on every plan, V3 needs Pro, V4 needs Generative. Higher tiers look sharper and use more credits." },
  { q: "Is there a free plan?", a: "Yes. Sign up free for 5 AI images every 30 days and a look around every tool. Making videos needs a plan." },
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
