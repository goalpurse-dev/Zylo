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
    title: "How to Write a Cliffhanger That Makes Your Next 30 Days Episode a Must-Watch",
    description: "What actually makes an ending pull viewers into the next episode.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-cliffhangers",
  },
  {
    title: "1, 2, 3, or 5 Days Per Episode? How to Structure Your 30 Days Series",
    description: "How your pace choice changes the whole series.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-days-per-episode",
  },
];

const MECHANICS = [
  { title: "The master story bible", desc: "Written once at setup, it locks the universe's visual style, hard rules, and overall arc — every future episode is planned against this same document." },
  { title: "A persistent reference library", desc: "5 reference images built at setup — your cast and key locations — reused in every episode. Up to 2 new references can be added per episode as the story introduces new characters or places, up to 10 total." },
  { title: "Hidden future beats", desc: "The planner knows roughly where the story is heading beyond the current episode, but deliberately withholds that from what it reveals — so the story can build toward something without spoiling itself early." },
  { title: "Episode summaries", desc: "After each episode, Zyvo records what changed — relationships, new characters, mysteries opened or resolved, and the cliffhanger — and feeds that directly into planning the next one." },
  { title: "One open episode at a time", desc: "You can't skip ahead or run two episodes in parallel — each one has to finish before the next is planned, which is exactly what keeps the continuity intact." },
];

export default function ThirtyDaysSeriesWorldBibleExplained() {
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
            Mechanics
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How 30 Days Series Mode Remembers Your Story
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Continuing a story convincingly means remembering more than just the world — it means remembering what already happened. Here's exactly what carries forward between episodes.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 26, 2026 · 6 min read · Mechanics</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-series-world-bible-hero.png"
            alt="A glowing green geometric network of connected spheres and lines forming a structured web pattern"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {MECHANICS.map((m) => (
            <div key={m.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <p className="text-[15px] font-bold text-white mb-1.5">{m.title}</p>
              <p className="text-[14px] leading-relaxed text-white/55">{m.desc}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why this matters for the finished video</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Real continuity is what separates a series from three unrelated videos in the same setting. Because the story bible and episode summaries carry forward automatically, the cliffhanger you end an episode on can actually pay off later — see{" "}
              <Link to="/blog/30-days-series-cliffhangers" className="text-lime-300 hover:underline font-semibold">how to write one that lands</Link>.
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
