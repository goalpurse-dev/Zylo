import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "30 Days Quality Tiers Explained: V2 vs V3 vs V4",
    description: "What each quality tier actually changes, and which one is worth it.",
    date: "25.08.2026",
    slug: "/blog/30-days-quality-tiers",
  },
  {
    title: "How Long Does a 30 Days Video Take to Make?",
    description: "From naming a universe to a finished video — what actually takes time.",
    date: "25.08.2026",
    slug: "/blog/30-days-time",
  },
  {
    title: "Is AI Content Creation Worth It in 2026? An Honest Breakdown",
    description: "Where AI generation clearly wins, where it clearly doesn't.",
    date: "21.08.2026",
    slug: "/blog/is-ai-content-worth-it",
  },
];

const BREAKDOWN = [
  { part: "Reference images", desc: "4 to 6 images that lock the world's key locations and characters before any scene generates.", cost: "20–30 credits" },
  { part: "Eight scene images", desc: "Two per milestone day, across Day 1, 10, 20, and 30.", cost: "40 credits on V2" },
  { part: "Eight animated clips", desc: "Each scene image turned into a 5-second video clip.", cost: "48 credits on V2" },
  { part: "Narration and export", desc: "AI-written narration from your real footage, plus the voice generation itself.", cost: "18 credits on Starter" },
];

export default function Is30DaysWorthIt() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-violet-300">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">30 Days</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-violet-200 mb-6">
            Honest Breakdown
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Is 30 Days Worth It? Credits, Cost, and What You Actually Get
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A full 30 Days story costs more credits than a single-image generation — here's exactly where those credits go, and what you get back for them.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 25, 2026 · 6 min read · Honest Breakdown</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/is-30-days-worth-it-hero.png"
            alt="A glowing golden scale balancing a small glowing purple doorway portal shape against a stack of golden coin-like discs"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <p className="text-[16px] leading-relaxed">
              On the V2 tier (Starter plan), a full 30 Days generation runs roughly 126 to 136 credits depending on how many reference images the world bible needs. Here's what that actually buys.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {BREAKDOWN.map((b) => (
                <div key={b.part} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-[14px] font-bold text-white">{b.part}</p>
                    <span className="text-[11px] font-bold text-violet-200 whitespace-nowrap">{b.cost}</span>
                  </div>
                  <p className="text-[13px] text-white/55 leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[24px] font-black text-white mb-4 tracking-[-0.01em]">Why the cost jumps on V3 and V4</h2>
            <p className="text-[16px] leading-relaxed">
              Video credits scale the most between tiers — V2's Seedance 1.5 Pro clips cost 6 credits each, V3's Veo 3.1 Lite clips cost 18, and V4's Seedance 2.0 clips cost 80, before the sharper scene images are even counted. See{" "}
              <Link to="/blog/30-days-quality-tiers" className="text-violet-300 hover:underline font-semibold">the full tier breakdown</Link>{" "}
              to decide where the jump is worth it for you.
            </p>
          </section>

          <section>
            <h2 className="text-[24px] font-black text-white mb-4 tracking-[-0.01em]">What you're actually paying for</h2>
            <p className="text-[16px] leading-relaxed">
              Compared to generating eight separate clips and writing your own narration by hand, the cost covers a locked-consistent world bible, a real narration script written from your finished footage, and one continuous exported story — not just raw generation.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try It on V2 First</h2>
            <Link
              to="/30-days-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-fuchsia-300 px-7 py-3.5 text-[14px] font-black text-[#160b20] transition hover:brightness-110"
            >
              Explore 30 Days
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
