import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How 30 Days Keeps Your Characters Looking the Same in Every Scene",
    description: "The persistent reference system explained.",
    date: "28.08.2026",
    slug: "/blog/30-days-character-consistency",
  },
  {
    title: "How 30 Days Series Mode Remembers Your Story",
    description: "World bible, persistent cast, and spoiler-gated planning explained.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-world-bible-explained",
  },
  {
    title: "How to Write a Cliffhanger That Makes Your Next 30 Days Episode a Must-Watch",
    description: "What actually makes an ending pull viewers into the next episode.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-cliffhangers",
  },
];

const PRINCIPLES = [
  { title: "Every scene declares where it starts", desc: "Before the planner writes what happens in a scene, it first states what's concretely true the instant that scene begins — the location, who's present, the immediate situation." },
  { title: "And where it ends", desc: "It does the same for the moment the scene ends — so there's an explicit, checkable state on both sides of every cut, not just a vibe." },
  { title: "The next scene has to follow from it", desc: "Scene two's starting state has to be the direct, obvious continuation of scene one's ending state, and so on down the line — seven scenes chained together instead of seven separate snapshots loosely related by premise." },
  { title: "This is what a jump cut usually breaks", desc: "AI-generated short-form video often looks disjointed because each shot is planned in isolation. Chaining state explicitly is what keeps a 7-scene episode feeling like one continuous thing happened, not a slideshow of similar-but-unconnected moments." },
];

export default function ThirtyDaysSceneContinuity() {
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
            Why Every 30 Days Series Episode Flows as One Continuous Scene
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Each of the seven scenes in a Series episode has to explicitly pick up exactly where the previous one left off — here's the mechanic behind why it doesn't feel like seven separate clips.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 28, 2026 · 4 min read · Mechanics</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-scene-continuity-hero.png"
            alt="A chain of glowing green links floating in dark space, each link brighter than the last"
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
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why this is a Series-specific mechanic</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              A single 30 Days video deliberately jumps between milestone days — it's built to compress a whole month into a handful of key moments, not to be one unbroken scene. A <Link to="/blog/what-is-30-days-series-mode" className="text-lime-300 hover:underline font-semibold">Series episode</Link> is different: it only covers the small handful of days you chose per episode, so it has room to actually chain each moment to the next instead of skipping ahead.
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
