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
    title: "30 Days Series vs Single Video: Which Should You Start With?",
    description: "Two different commitments, built from the same tool.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-vs-single-video",
  },
  {
    title: "Is 30 Days Worth It? Credits, Cost, and What You Actually Get",
    description: "Exactly where the credits go, and what you get back for them.",
    date: "25.08.2026",
    slug: "/blog/is-30-days-worth-it",
  },
];

const OPTIONS = [
  { label: "1 Day", episodes: "30 episodes", desc: "Maximum continuity — every episode picks up the very next day. Best for a story with fast-moving relationships or a mystery that needs frequent small reveals.", fit: "Daily posting schedules" },
  { label: "2 Days", episodes: "15 episodes", desc: "A middle ground — enough happens per episode to feel like real progress, without the jumps feeling large.", fit: "A few posts per week" },
  { label: "3 Days", episodes: "10 episodes", desc: "More action fits inside each episode, since more in-world time passes between them.", fit: "A weekly posting rhythm" },
  { label: "5 Days", episodes: "6 episodes", desc: "The biggest jumps between episodes — best for a story built around a handful of major turning points rather than granular day-to-day events.", fit: "A short, high-impact series" },
];

export default function ThirtyDaysSeriesDaysPerEpisode() {
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
            Structure
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            1, 2, 3, or 5 Days Per Episode? How to Structure Your 30 Days Series
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Every 30 Days Series tells the same 30-day story — this one choice, set once at setup, decides how many episodes it takes to get there.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 26, 2026 · 5 min read · Structure</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
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

        <div className="max-w-3xl space-y-4 text-white/68">
          {OPTIONS.map((o) => (
            <div key={o.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="text-[20px] font-black text-white">{o.label}</span>
                <span className="rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-200">{o.episodes}</span>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55 mb-2">{o.desc}</p>
              <p className="text-[12px] text-white/35"><span className="font-bold text-white/45">Fits well with: </span>{o.fit}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">This choice is permanent per series</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Days-per-episode is set once when you create a series and can't be changed mid-story — if you're unsure, matching it to your realistic posting cadence matters more than picking the "best" option. See{" "}
              <Link to="/blog/30-days-series-vs-single-video" className="text-lime-300 hover:underline font-semibold">whether Series is the right commitment at all</Link>{" "}
              before you start one.
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
