import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How 30 Days Series Mode Remembers Your Story",
    description: "World bible, persistent cast, and spoiler-gated planning explained.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-world-bible-explained",
  },
  {
    title: "30 Days Series vs Single Video: Which Should You Start With?",
    description: "Two different commitments, built from the same tool.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-vs-single-video",
  },
  {
    title: "What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month",
    description: "How the single-video, eight-scene story format works.",
    date: "24.08.2026",
    slug: "/blog/what-is-30-days-ai-trend",
  },
];

const STEPS = [
  { n: "01", title: "Build the world once", desc: "Name a universe and a premise built to sustain all 30 days. Zyvo writes a master story bible and generates 5 reusable reference images — your cast and key locations — in one setup step." },
  { n: "02", title: "Choose your pace", desc: "Pick how many days each episode covers: 1 (30 episodes), 2 (15), 3 (10), or 5 (6 episodes). This is set once per series and shapes how the whole story unfolds." },
  { n: "03", title: "Generate an episode whenever you're ready", desc: "Each episode is 7 scenes, narrated, about 35–42 seconds. You're only charged for the episode you generate — not for the whole series upfront." },
  { n: "04", title: "The next episode picks up automatically", desc: "The planner already knows the world, the cast, and everything that's happened so far — you never re-explain the premise. Episodes generate in order; you can't skip ahead." },
  { n: "05", title: "The series completes at Day 30", desc: "Once the current day reaches 30, the series is marked complete — every episode stays available afterward." },
];

export default function WhatIs30DaysSeriesMode() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-300">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">30 Days Series</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Explained
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            What Is 30 Days Series Mode? Continue Your Story Episode by Episode
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A single 30 Days video tells one complete story in one sitting. Series mode builds a persistent world once, then lets you pick up the same story whenever you're ready for the next episode.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 26, 2026 · 6 min read · Explained</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-series-mode-hero.png"
            alt="An abstract glowing green ribbon of light unfurling and curling through a dark cosmic void"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-white/15 leading-none">{s.n}</span>
                <h2 className="text-[17px] font-bold text-white m-0">{s.title}</h2>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55">{s.desc}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why this is different from just posting more videos</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Generating three separate 30 Days videos in the same universe gives you three unrelated stories that happen to share a setting. Series mode gives you one continuous story — the same cast, the same open threads, the same consequences carrying forward. See{" "}
              <Link to="/blog/30-days-series-world-bible-explained" className="text-lime-300 hover:underline font-semibold">exactly how it remembers your story</Link>{" "}
              between episodes.
            </p>
            <Link
              to="/30-days-series-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Explore 30 Days Series
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>

        <div className="mt-20 -mx-6 rounded-[24px] bg-[#F7F5FA] py-10 sm:mx-0">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
