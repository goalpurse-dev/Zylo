import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is 30 Days Series Mode? Continue Your Story Episode by Episode",
    description: "How the continuation mechanic actually works, step by step.",
    date: "26.08.2026",
    slug: "/blog/what-is-30-days-series-mode",
  },
  {
    title: "1, 2, 3, or 5 Days Per Episode? How to Structure Your 30 Days Series",
    description: "How your pace choice changes the whole series.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-days-per-episode",
  },
  {
    title: "30 Days Series vs Single Video: Which Should You Start With?",
    description: "Two different commitments, built from the same tool.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-vs-single-video",
  },
];

const STEPS = [
  { n: "01", title: "Switch to Series mode", desc: "Inside 30 Days, toggle from Single Video to Series before you start — this is a separate flow with its own setup, not a setting you add afterward." },
  { n: "02", title: "Name a universe built to last 30 days", desc: "A premise that can only really cover one moment won't sustain a full series. Pick a universe and a premise with room for relationships, mysteries, and stakes to develop over time." },
  { n: "03", title: "Pick your days-per-episode", desc: "This is set once and shapes the whole series — 1 day per episode gives you 30 tightly-connected episodes, 5 days gives you 6 episodes with bigger jumps." },
  { n: "04", title: "Let setup build your persistent world", desc: "Zyvo writes a story bible and generates 5 reference images — your cast and key locations — once. This is the only step charged upfront." },
  { n: "05", title: "Generate your first episode", desc: "Seven scenes, narrated, about 35–42 seconds. Come back whenever you're ready for the next one — the story continues exactly where it left off." },
];

export default function ThirtyDaysVideoSeries() {
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
            Getting Started
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How to Turn One 30 Days Story Into a Series
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A practical, step-by-step walkthrough for starting your first 30 Days Series — from switching modes to generating your first episode.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 26, 2026 · 5 min read · Getting Started</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/30-days-series-landing-progress.png"
              alt="A glowing green pathway made of connected stepping-stone platforms stretching into the distance toward a bright light"
              width={1200}
              height={896}
              className="aspect-[4/3] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/30-days-series-days-per-episode-hero.png"
              alt="Four glowing green pathways of different step-spacing stretching from a single starting point toward a bright horizon"
              width={1200}
              height={896}
              className="aspect-[4/3] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

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
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Not sure which pace to pick?</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              See{" "}
              <Link to="/blog/30-days-series-days-per-episode" className="text-lime-300 hover:underline font-semibold">how each days-per-episode option changes your series</Link>{" "}
              before you commit — it can't be changed once a series is running.
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
