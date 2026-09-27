import { ArrowRight, BookOpen, CalendarDays, Layers3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../components/workspace/footer.jsx";

const STEPS = [
  {
    icon: Sparkles,
    title: "Build your persistent world",
    text: "Name a universe and a premise built to sustain all 30 days. Zyvo writes a master story bible and generates 5 reusable reference images — your cast and key locations — once, up front.",
  },
  {
    icon: CalendarDays,
    title: "Choose your pace",
    text: "1, 2, 3, or 5 days per episode. A daily series runs 30 episodes with maximum continuity; a 5-day pace runs 6 episodes with bigger jumps between them.",
  },
  {
    icon: Layers3,
    title: "Generate the next episode, whenever you're ready",
    text: "Each episode is 7 scenes, about 35–42 seconds, narrated — and only charged when you generate it. No episode until the last one.",
  },
  {
    icon: BookOpen,
    title: "The story remembers everything",
    text: "Relationship changes, characters introduced, mysteries opened and resolved, and the cliffhanger from the last episode all carry forward automatically — you're never asked to re-explain the world.",
  },
];

const PACE_OPTIONS = [
  { label: "1 Day", episodes: "30 episodes", desc: "Daily story series with maximum continuity." },
  { label: "2 Days", episodes: "15 episodes", desc: "Faster story progression." },
  { label: "3 Days", episodes: "10 episodes", desc: "More action per episode." },
  { label: "5 Days", episodes: "6 episodes", desc: "Shorter series with bigger jumps." },
];

const FEATURES = [
  "A persistent world bible carried across every episode",
  "Up to 10 reusable reference images — 5 built up front, 2 more allowed per episode",
  "7 scenes per episode, about 35–42 seconds, narrated",
  "Only one episode reserved at a time — no skipping ahead",
  "The planner already knows where the story is going, but won't spoil it early",
  "Episode summaries track relationships, new characters, and open mysteries",
  "Setup is charged once; each episode is billed separately when you generate it",
];

const FAQS = [
  {
    q: "How is Series different from a regular 30 Days video?",
    a: "A single 30 Days video tells one complete 8-scene story in one sitting. Series mode builds a persistent world once, then lets you generate new 7-scene episodes over time — continuing the same story, cast, and world each time, up to 30 total days.",
  },
  {
    q: "Do I have to generate every episode right away?",
    a: "No. Setup — your world bible and 5 reference images — is generated and charged once. After that, you generate and pay for one episode at a time, whenever you're ready for the next one.",
  },
  {
    q: "Does the AI remember what happened in previous episodes?",
    a: "Yes. Every episode's summary — relationship changes, new characters, mysteries opened and resolved, and the cliffhanger — feeds into planning the next one, so the story continues without you re-explaining anything.",
  },
  {
    q: "Can I skip ahead to a later day?",
    a: "No — episodes generate in order, one at a time, so the continuity stays intact. You can only start the next episode once the current one is complete.",
  },
  {
    q: "How many days per episode should I pick?",
    a: "1 day per episode gives you 30 episodes with the tightest continuity. 5 days per episode gives you 6 episodes with bigger story jumps. Pick based on how often you want to post versus how much happens per episode.",
  },
  {
    q: "Which plans include Series mode?",
    a: "Series mode uses the same plan eligibility as standard 30 Days videos — included on Starter, Pro, and Generative plans. It isn't available on the free plan.",
  },
];

export default function ThirtyDaysSeriesLanding() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080A0E] text-white">
      <main>
        <section className="relative border-b border-white/[0.07]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(190,242,100,0.13),transparent_34%),radial-gradient(circle_at_80%_35%,rgba(52,211,153,0.12),transparent_38%)]" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.08fr_0.72fr] lg:gap-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-lime-200">
                <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
                New · 30 Days Series
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                One world.
                <span className="block bg-gradient-to-r from-lime-200 via-white to-emerald-300 bg-clip-text text-transparent">
                  Thirty days of story.
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
                Build your world once. Come back whenever you're ready and generate the next episode — same cast, same world, same story, continuing exactly where you left off.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/workspace/thirty-days"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-6 py-3 text-sm font-black text-[#111509] transition hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0E]"
                >
                  Start Your Series
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <span className="text-sm text-white/38">Persistent world · pay per episode · up to 30 days</span>
              </div>
              <p className="mt-4 text-[12px] text-white/30">Included on Starter, Pro, and Generative plans.</p>
            </div>

            <div className="relative mx-auto w-full max-w-[340px]">
              <div className="absolute -inset-10 rounded-full bg-lime-300/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.65)]">
                <img
                  src="/blog-assets/30-days-series-landing-hero.png"
                  alt="A glowing green doorway standing open on a dark asteroid, a swirling emerald portal visible inside it"
                  width={1200}
                  height={896}
                  className="aspect-[4/3] w-full rounded-[19px] object-cover"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200">How Series mode works</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Build once. Continue whenever.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {STEPS.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime-300/10 text-lime-200">
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
            <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[24px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.5)]">
              <img
                src="/blog-assets/30-days-series-landing-cast.png"
                alt="Five glowing green human silhouettes standing together, connected by a single thread of light running through all of them"
                width={1200}
                height={896}
                className="aspect-[4/3] w-full rounded-[19px] object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-6 text-center text-sm text-white/40">Your cast and key locations, generated once and reused in every episode.</p>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200">Pick your pace</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">How many days should each episode cover?</h2>
            <p className="mt-4 text-white/48">All four options run the same 30-day story — they just differ in how many episodes it takes to get there.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {PACE_OPTIONS.map((p) => (
              <div key={p.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
                <p className="text-xl font-black text-white">{p.label}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-lime-200/70">{p.episodes}</p>
                <p className="mt-3 text-[13px] leading-5 text-white/50">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0D1015]">
          <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
            <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[24px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.5)]">
              <img
                src="/blog-assets/30-days-series-landing-cliffhanger.png"
                alt="A glowing green doorway frame, the portal inside half bright and half fading into shadow"
                width={1200}
                height={896}
                className="aspect-[4/3] w-full rounded-[19px] object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-6 text-center text-sm text-white/40">The planner already knows where the story goes next — it just won't tell you early.</p>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div>
            <BookOpen className="h-8 w-8 text-lime-300" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-black tracking-[-0.035em]">Built to remember, not just repeat</h2>
            <p className="mt-4 max-w-2xl leading-7 text-white/50">
              A series isn't the same premise generated three times — it's one continuous story. Every episode's outcome, every relationship shift, every open thread feeds directly into planning the next one.
            </p>
          </div>
          <ul className="mt-8 grid gap-3 text-sm text-white/64 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map((item) => (
              <li key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">{item}</li>
            ))}
          </ul>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0D1015]">
          <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200 mb-4">Guides</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["What Is 30 Days Series Mode?", "How the continuation mechanic actually works, step by step.", "/blog/what-is-30-days-series-mode"],
                ["How the Story Remembers Everything", "World bible, persistent cast, and spoiler-gated planning explained.", "/blog/30-days-series-world-bible-explained"],
                ["Pick Your Days-Per-Episode", "How 1, 2, 3, or 5 days per episode changes your series.", "/blog/30-days-series-days-per-episode"],
                ["Series vs Single Video", "Which one should you actually start with?", "/blog/30-days-series-vs-single-video"],
                ["Write a Real Cliffhanger", "How to end an episode so the next one gets watched.", "/blog/30-days-series-cliffhangers"],
                ["How to Turn One 30 Days Story Into a Series", "A practical getting-started walkthrough.", "/blog/30-days-video-series"],
              ].map(([title, text, href]) => (
                <Link key={href} to={href} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-lime-300/30">
                  <h3 className="text-base font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">{text}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-center text-3xl font-black tracking-[-0.035em]">30 Days Series FAQs</h2>
          <div className="mt-9 space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <summary className="cursor-pointer list-none pr-6 text-base font-bold marker:hidden">{item.q}</summary>
                <p className="mt-3 text-sm leading-6 text-white/50">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 pb-16 sm:px-6">
          <Link to="/30-days-video-maker" className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-violet-300/30">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/35">Just want one video?</p>
              <h3 className="mt-1 text-base font-bold text-white">Try a single 30 Days story instead</h3>
              <p className="mt-1 text-sm text-white/50">One complete 8-scene story, no ongoing commitment.</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-white/30" aria-hidden="true" />
          </Link>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-[1000px] rounded-[28px] border border-lime-200/15 bg-[linear-gradient(135deg,rgba(190,242,100,0.12),rgba(52,211,153,0.14))] px-6 py-12 text-center sm:px-10">
            <h2 className="text-3xl font-black tracking-[-0.035em]">Start the story you'll keep coming back to</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/52">Build your world once, then generate the next episode whenever you're ready.</p>
            <Link to="/workspace/thirty-days" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200">
              Open 30 Days Series
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
