import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How Long Does a 30 Days Video Take to Make?",
    description: "From naming a universe to a finished video — what actually takes time.",
    date: "25.08.2026",
    slug: "/blog/30-days-time",
  },
  {
    title: "Is 30 Days Worth It? Credits, Cost, and What You Actually Get",
    description: "An honest breakdown of the credit cost against what you get back.",
    date: "25.08.2026",
    slug: "/blog/is-30-days-worth-it",
  },
  {
    title: "What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month",
    description: "How the eight-scene, four-milestone-day story format actually works.",
    date: "24.08.2026",
    slug: "/blog/what-is-30-days-ai-trend",
  },
];

const TIERS = [
  { label: "V2", tag: "Included", plan: "Starter and above", detail: "1K scene images, animated with Seedance 1.5 Pro", note: "The fastest and most affordable way to test a new universe and premise before committing to a sharper render." },
  { label: "V3", tag: "Sharper", plan: "Pro and above", detail: "2K scene images, animated with Veo 3.1 Lite", note: "A meaningful step up in detail and motion quality — the tier most creators settle on for regular posting." },
  { label: "V4", tag: "Best", plan: "Generative", detail: "4K scene images, animated with Seedance 2.0", note: "The highest fidelity available, aimed at a finished story worth polishing rather than a quick test." },
];

export default function ThirtyDaysQualityTiers() {
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
            Quality Tiers
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            30 Days Quality Tiers Explained: V2 vs V3 vs V4
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Three quality tiers, three different animation models, three plan levels. Here's exactly what changes between them.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 25, 2026 · 5 min read · Quality Tiers</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-quality-tiers-hero.png"
            alt="Three glowing purple rectangular panels of increasing size and brightness arranged side by side in a dark studio"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {TIERS.map((t) => (
            <div key={t.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="text-[20px] font-black text-white">{t.label}</span>
                <span className="rounded-full border border-violet-300/20 bg-violet-300/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-200">{t.tag}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-white/30">{t.plan}</span>
              </div>
              <p className="text-[14px] font-semibold text-white/75 mb-1.5">{t.detail}</p>
              <p className="text-[14px] leading-relaxed text-white/55">{t.note}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Which one should you actually pick</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Start on V2 to confirm a universe and premise are worth telling, then upgrade to V3 or V4 once you know the story is worth the extra credits. See{" "}
              <Link to="/blog/is-30-days-worth-it" className="text-violet-300 hover:underline font-semibold">an honest cost breakdown</Link>{" "}
              to weigh the tiers against what you get back.
            </p>
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
