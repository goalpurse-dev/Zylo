import { ArrowRight, Clapperboard, Mic2, Sparkles, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../components/workspace/footer.jsx";

const STEPS = [
  {
    icon: Sparkles,
    title: "Name any universe",
    text: "LEGO Ninjago, Pokémon, Hogwarts, Naruto, One Piece, Minecraft — or type in any fictional world you want to visit.",
  },
  {
    icon: Wand2,
    title: "Describe your 30 days",
    text: "Write your own premise, or let AI write a viral-shaped one for you. You're always the protagonist — even when the premise is a world-level crisis.",
  },
  {
    icon: Clapperboard,
    title: "Zyvo builds a consistent world",
    text: "A world bible locks the visual style and canon characters, then generates 8 scene images across four milestone days and animates each into a 5-second clip — with you compositionally central in every one.",
  },
  {
    icon: Mic2,
    title: "AI narrates your actual footage",
    text: "Once the 8 clips are done, Zyvo watches them and writes one continuous hook and narration story from what actually happens on screen. Edit it, pick a voice, and export the stitched video.",
  },
];

const QUALITY_TIERS = [
  { tag: "Included", label: "V2", detail: "1K scenes · Seedance 1.5 Pro", plan: "Starter" },
  { tag: "Sharper", label: "V3", detail: "2K scenes · Veo 3.1 Lite", plan: "Pro" },
  { tag: "Best", label: "V4", detail: "4K scenes · Seedance 2.0", plan: "Generative" },
];

const UNIVERSES = ["LEGO Ninjago", "Pokémon", "Hogwarts", "Naruto", "One Piece", "Minecraft", "Or type your own"];

const FEATURES = [
  "8 scenes per story, 2 scenes on each milestone day",
  "Vertical 9:16, built for TikTok, Reels, and Shorts",
  "You stay the protagonist in every scene, never a background extra",
  "Named canon characters appear alongside you, kept visually consistent",
  "Narration is written after watching your actual finished clips",
  "12 voice options, from high-energy hooks to calm narrators",
  "Watermark-free export on every eligible plan",
];

const FAQS = [
  {
    q: "What is 30 Days?",
    a: "30 Days is a video format where you name any fictional universe and a premise for spending 30 days inside it. Zyvo generates four milestone days with two connected scenes each, keeps you as the protagonist, narrates the finished footage, and stitches a final vertical video.",
  },
  {
    q: "Can I use any fictional world, or only the examples shown?",
    a: "The examples — LEGO Ninjago, Pokémon, Hogwarts, Naruto, One Piece, Minecraft — are just starting points. You can type in any world you want to visit.",
  },
  {
    q: "Do I have to write the premise myself?",
    a: "No. Turn on AI idea mode and Zyvo writes a viral-shaped premise for your chosen universe, which you can use as-is or edit before generating.",
  },
  {
    q: "How long is the final video?",
    a: "Eight scenes at roughly 5 seconds each, stitched with narration into one continuous vertical video — about 40 seconds total.",
  },
  {
    q: "Do the clips come with sound?",
    a: "The 8 generated clips are silent. Narration is added afterward: Zyvo writes a continuous story from your actual finished footage, you pick one of 12 voices, and the final export combines the clips with that narration.",
  },
  {
    q: "Which plans include 30 Days?",
    a: "30 Days is included on Starter, Pro, and Generative plans, with three image-quality tiers — 1K on Starter, 2K on Pro, and 4K on Generative. It isn't available on the free plan.",
  },
];

export default function ThirtyDaysLanding() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080A0E] text-white">
      <main>
        <section className="relative border-b border-white/[0.07]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(192,132,252,0.14),transparent_34%),radial-gradient(circle_at_80%_35%,rgba(122,59,255,0.16),transparent_38%)]" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.08fr_0.72fr] lg:gap-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Viral template
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                30
                <span className="block bg-gradient-to-r from-violet-300 via-white to-fuchsia-300 bg-clip-text text-transparent">
                  Days
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
                See what happens when YOU enter any fictional world for 30 days. Name a universe, describe the premise, and Zyvo builds eight connected scenes across Day 1, 10, 20, and 30 — narrated from your actual finished footage.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/workspace/thirty-days"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-fuchsia-300 px-6 py-3 text-sm font-black text-[#160b20] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0E]"
                >
                  Create Your Story
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <span className="text-sm text-white/38">4 milestone days · 8 scenes · narrated · vertical 9:16</span>
              </div>
              <p className="mt-4 text-[12px] text-white/30">Included on Starter, Pro, and Generative plans.</p>
            </div>

            <div className="relative mx-auto w-full max-w-[300px]">
              <div className="absolute -inset-8 rounded-full bg-violet-400/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.65)]">
                <video
                  src="/library/lego.mp4"
                  poster="/community-posters/lg-1.jpg"
                  className="aspect-[9/16] w-full rounded-[27px] object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">How it works</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">From one universe to a full story</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {STEPS.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-300/10 text-violet-200">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-black text-white/20">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/48">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0D1015]">
          <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
            <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[28px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.5)]">
              <video
                src="/library/lego2.mp4"
                poster="/community-posters/lg-2.jpg"
                className="aspect-[9/16] w-full rounded-[22px] object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
            <p className="mt-6 text-center text-sm text-white/40">A real 30 Days generation — LEGO Ninjago universe, straight out of Zyvo.</p>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Any world you can name</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Pick a universe, or bring your own</h2>
            <p className="mt-4 text-white/48">These are just starting points — type in anything you want to spend 30 days inside.</p>
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            {UNIVERSES.map((u) => (
              <span key={u} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-bold text-white/80">{u}</span>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0D1015]">
          <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Quality tiers</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Choose your resolution</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {QUALITY_TIERS.map((t) => (
                <div key={t.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-200/70">{t.tag}</p>
                  <h3 className="mt-2 text-2xl font-black">{t.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">{t.detail}</p>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-white/30">{t.plan} plan and above</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div>
            <Mic2 className="h-8 w-8 text-violet-300" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-black tracking-[-0.035em]">Built to keep you as the lead</h2>
            <p className="mt-4 max-w-2xl leading-7 text-white/50">
              Every scene locks a world bible of visual rules and canon characters, but you stay the compositionally central figure throughout — named characters interact with you, they never replace you as the story's lead.
            </p>
          </div>
          <ul className="mt-8 grid gap-3 text-sm text-white/64 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map((item) => (
              <li key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">{item}</li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 pt-16 sm:px-6">
          <Link to="/30-days-series-video-maker" className="flex items-center justify-between rounded-2xl border border-lime-300/20 bg-lime-300/[0.05] p-6 transition hover:border-lime-300/40">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-lime-200">New · Series mode</p>
              <h3 className="mt-1 text-base font-bold text-white">Want an ongoing story instead of one video?</h3>
              <p className="mt-1 text-sm text-white/50">Build your world once, then generate a new episode whenever you're ready — up to 30 days long.</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-lime-300/60" aria-hidden="true" />
          </Link>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0D1015] mt-16">
          <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300 mb-4">Guides</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["What Is the 30 Days AI Video Trend?", "How the four-day, eight-scene story format works.", "/blog/what-is-30-days-ai-trend"],
                ["50 Universe Ideas", "Fifty fictional universes to try, grouped by mood.", "/blog/30-days-universe-ideas"],
                ["Build a Series", "A step-by-step walkthrough for starting your first 30 Days Series.", "/blog/30-days-video-series"],
                ["10 Mistakes to Avoid", "The structural choices that quietly hold results back, with a fix for each.", "/blog/30-days-mistakes"],
                ["30 Days vs AI Fruit Story", "Which multi-scene story format fits what you want to make.", "/blog/30-days-vs-ai-fruit-story"],
                ["How Long Does It Take?", "What actually takes time, from premise to finished video.", "/blog/30-days-time"],
                ["Quality Tiers Explained", "V2 vs V3 vs V4 — what each tier actually changes.", "/blog/30-days-quality-tiers"],
                ["Write a Viral Premise", "A four-part formula, with weak-vs-strong examples.", "/blog/30-days-premise-formula"],
                ["Halloween Special", "Ten spooky premises for any universe you already love.", "/blog/30-days-halloween-special"],
                ["Is It Worth It?", "Exactly where the credits go, and what you get back.", "/blog/is-30-days-worth-it"],
                ["Every Zyvo AI Video Format Compared", "Six format-specific AI video tools, side by side.", "/blog/every-zyvo-video-format-compared"],
              ].map(([title, text, href]) => (
                <Link key={href} to={href} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-violet-300/30">
                  <h3 className="text-base font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">{text}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-center text-3xl font-black tracking-[-0.035em]">30 Days FAQs</h2>
          <div className="mt-9 space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <summary className="cursor-pointer list-none pr-6 text-base font-bold marker:hidden">{item.q}</summary>
                <p className="mt-3 text-sm leading-6 text-white/50">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-[1000px] rounded-[28px] border border-violet-200/15 bg-[linear-gradient(135deg,rgba(192,132,252,0.14),rgba(122,59,255,0.16))] px-6 py-12 text-center sm:px-10">
            <h2 className="text-3xl font-black tracking-[-0.035em]">Your 30 days start now</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/52">Name a world, describe your 30 days, and let Zyvo build and narrate the story.</p>
            <Link to="/workspace/thirty-days" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">
              Open 30 Days
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
