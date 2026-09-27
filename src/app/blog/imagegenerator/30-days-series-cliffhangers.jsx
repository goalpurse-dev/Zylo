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
    title: "What Is 30 Days Series Mode? Continue Your Story Episode by Episode",
    description: "How the continuation mechanic actually works, step by step.",
    date: "26.08.2026",
    slug: "/blog/what-is-30-days-series-mode",
  },
  {
    title: "AI Fruit Story Cliffhanger Endings: How to Make Viewers Come Back for Part 2",
    description: "Four cliffhanger structures that consistently drive part-2 demand.",
    date: "21.08.2026",
    slug: "/blog/ai-fruit-story-cliffhangers",
  },
];

const PRINCIPLES = [
  { title: "Let the planner's tease guide you, don't fight it", desc: "Each episode already generates a next-episode tease behind the scenes — read it before deciding what to emphasize in your own caption or framing." },
  { title: "End on a change, not a pause", desc: "A cliffhanger works because something shifted — a relationship, a reveal, a decision — not because the video simply stopped at an arbitrary point." },
  { title: "Trust the spoiler gate", desc: "The planner already knows where the story is going but won't reveal it early — you can safely end an episode on real tension without accidentally giving away what happens next." },
  { title: "Keep the open thread singular", desc: "One clear unresolved question is more compelling than three vague ones — it gives viewers exactly one specific reason to want the next episode." },
];

export default function ThirtyDaysSeriesCliffhangers() {
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
            Craft
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How to Write a Cliffhanger That Makes Your Next 30 Days Episode a Must-Watch
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Series mode already tracks a cliffhanger and next-episode tease behind the scenes for every episode — here's how to actually use that instead of working against it.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 26, 2026 · 5 min read · Craft</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-series-cliffhangers-hero.png"
            alt="A glowing green doorway frame, the portal swirling brightly at the top and fading into soft shadow tendrils at the bottom"
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
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">The mechanic behind it</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Every episode's summary records mysteries opened, relationships changed, and a cliffhanger — all of which the next episode's planning already reads. See{" "}
              <Link to="/blog/30-days-series-world-bible-explained" className="text-lime-300 hover:underline font-semibold">exactly what carries forward between episodes</Link>.
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
