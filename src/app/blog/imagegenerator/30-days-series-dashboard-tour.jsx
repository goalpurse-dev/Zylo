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
    description: "Choosing an episode cadence before you start.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-days-per-episode",
  },
  {
    title: "30 Days Series vs Single Video: Which Should You Start With?",
    description: "Same universe-building idea, two very different commitments.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-vs-single-video",
  },
];

const PRINCIPLES = [
  { title: "Opening a series always lands on its home screen", desc: "You get a dashboard first: your next episode's day range, a one-line tease of what's coming, and every episode you've already made as a small preview card — never dropped straight into a specific episode's scenes." },
  { title: "One card, one clear action", desc: "The next-episode card either shows you what to generate next, live progress while it's actively being made, or \"Needs Attention\" if a scene didn't pass and needs a retry — never more than one of those at once." },
  { title: "Clicking a past episode opens its own view", desc: "Tap any preview card and you get that specific episode: its finished scenes on one side, and the caption/voiceover step on the other if you haven't narrated it yet. A finished, narrated episode just plays." },
  { title: "The Single Video / Series toggle is always there", desc: "It sits above everything else in the left panel, whichever screen you're looking at — so switching back to Single Video is never more than one click away, even mid-series." },
];

export default function ThirtyDaysSeriesDashboardTour() {
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
            Guide
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            A Tour of Your 30 Days Series Dashboard
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            One home screen per series: what's next, what's already made, and one click into either. Here's what everything on it actually means.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 28, 2026 · 4 min read · Guide</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-series-dashboard-tour-hero.png"
            alt="A grid of small glowing green rounded panels floating in dark space, one panel brighter than the rest"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <p className="text-[15px] font-bold text-white mb-1.5">{p.title}</p>
              <p className="text-[14px] leading-relaxed text-white/55">{p.desc}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why it's built this way</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              A series you're actively building has three different things you might want at any moment: generate the next chunk of story, check on one that's mid-generation, or rewatch/finish narrating one you already made. Splitting those into a dashboard plus a per-episode view means you're never staring at seven scene cards you didn't ask to see, and never more than one click from the episode you actually want — including{" "}
              <Link to="/blog/30-days-series-cliffhangers" className="text-lime-300 hover:underline font-semibold">picking up right where the last cliffhanger left off</Link>.
            </p>
            <Link
              to="/30-days-series-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Open your 30 Days Series
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
