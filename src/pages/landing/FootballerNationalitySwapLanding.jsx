import { ArrowRight, Globe2, IdCard, Mic, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../components/workspace/footer.jsx";

const STEPS = [
  {
    icon: Sparkles,
    title: "Name a footballer and a nationality",
    text: "Enter any footballer's name and choose the nation you want to picture them representing instead.",
  },
  {
    icon: IdCard,
    title: "Zyvo builds the media-day photo",
    text: "A photorealistic 'media day' portrait is generated in that nation's jersey, holding a name card with a localized name.",
  },
  {
    icon: Mic,
    title: "Animate the talking introduction",
    text: "The photo is animated into a short talking clip with lip-synced audio in the appropriate language and accent.",
  },
];

const FEATURES = [
  "Photorealistic jersey and likeness rendering",
  "Localized name and language per nationality",
  "3 background styles: tunnel, press room, training ground",
  "4 expression presets",
  "Lip-synced spoken audio, no music track",
  "3–5 scenes stitched into one video",
];

const FAQS = [
  {
    q: "What is Nationality Swap?",
    a: "It's an entertainment format that reimagines a footballer as if they represented a different nation — a new jersey, a localized name card, and a short talking introduction clip in that nation's language.",
  },
  {
    q: "Is this affiliated with real players, clubs, or federations?",
    a: "No. Nationality Swap generates original, fan-made AI content for entertainment purposes. It is not affiliated with, endorsed by, or produced in partnership with any footballer, club, or national football federation.",
  },
  {
    q: "How long is the generated video?",
    a: "Each scene is a 6-second vertical talking clip. You can generate 3 to 5 scenes and stitch them into one continuous video.",
  },
  {
    q: "Can I choose the video quality?",
    a: "Yes. Three tiers are available — 480p, 720p, and 1080p — all with generated audio.",
  },
];

export default function FootballerNationalitySwapLanding() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080A0E] text-white">
      <main>
        <section className="relative border-b border-white/[0.07]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.13),transparent_34%),radial-gradient(circle_at_80%_35%,rgba(122,59,255,0.15),transparent_38%)]" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.08fr_0.72fr] lg:gap-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                New in Zyvo
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Footballer
                <span className="block bg-gradient-to-r from-amber-200 via-white to-violet-300 bg-clip-text text-transparent">
                  Nationality Swap
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
                Picture any footballer representing a different nation — a new jersey, a localized name, and a short talking media-day introduction, generated in seconds.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/workspace/footballer-nationality-swap"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-300 px-6 py-3 text-sm font-black text-[#150F02] transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0E]"
                >
                  Create a Nationality Swap
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <span className="text-sm text-white/38">6 seconds per scene · vertical video</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[300px]">
              <div className="absolute -inset-8 rounded-full bg-amber-300/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.65)]">
                <img
                  src="/template/nationality-swap/preview.png"
                  alt="AI-generated media-day photo of a footballer wearing a different nation's jersey, holding a name card"
                  width="620"
                  height="620"
                  loading="eager"
                  fetchPriority="high"
                  className="aspect-square w-full rounded-[27px] object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">How it works</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">From one idea to a talking media-day clip</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-300/10 text-amber-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-black text-white/20">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/48">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0D1015]">
          <div className="mx-auto grid max-w-[1100px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div>
              <Globe2 className="h-8 w-8 text-violet-300" aria-hidden="true" />
              <h2 className="mt-5 text-3xl font-black tracking-[-0.035em]">Built for believable media-day detail</h2>
              <p className="mt-4 leading-7 text-white/50">
                The workflow keeps the same face, build, and expression while swapping the jersey, name card, and spoken language — so the result reads as a real media-day moment, not a costume.
              </p>
            </div>
            <ul className="grid gap-3 text-sm text-white/64 sm:grid-cols-2">
              {FEATURES.map((item) => (
                <li key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-center text-3xl font-black tracking-[-0.035em]">Nationality Swap FAQs</h2>
          <div className="mt-9 space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <summary className="cursor-pointer list-none pr-6 text-base font-bold marker:hidden">{item.q}</summary>
                <p className="mt-3 text-sm leading-6 text-white/50">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 pb-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200 mb-4">Guides</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/blog/footballer-nationality-swap-explained" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-amber-300/30">
              <h3 className="text-base font-bold text-white">What Is Footballer Nationality Swap?</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">Why the format works and how to generate one.</p>
            </Link>
            <Link to="/blog/footballer-nationality-swap-tips" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-amber-300/30">
              <h3 className="text-base font-bold text-white">5 Tips for the Most Believable Clip</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">Five deliberate choices that make the result land.</p>
            </Link>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-[1000px] rounded-[28px] border border-amber-200/15 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(122,59,255,0.15))] px-6 py-12 text-center sm:px-10">
            <h2 className="text-3xl font-black tracking-[-0.035em]">Give any player a new nation</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/52">Name the player and the nation, choose a style, then let Zyvo build and animate the clip.</p>
            <Link to="/workspace/footballer-nationality-swap" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
              Open Nationality Swap
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
