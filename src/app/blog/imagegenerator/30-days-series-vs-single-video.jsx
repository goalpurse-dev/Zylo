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
    title: "What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month",
    description: "How the single-video, eight-scene story format works.",
    date: "24.08.2026",
    slug: "/blog/what-is-30-days-ai-trend",
  },
  {
    title: "Is 30 Days Worth It? Credits, Cost, and What You Actually Get",
    description: "Exactly where the credits go, and what you get back for them.",
    date: "25.08.2026",
    slug: "/blog/is-30-days-worth-it",
  },
];

const COMPARISON_ROWS = [
  { label: "Commitment", single: "One sitting — describe, generate, done", series: "Ongoing — build the world once, return for new episodes" },
  { label: "Scenes per generation", single: "8 scenes across 4 milestone days", series: "7 scenes per episode, one episode at a time" },
  { label: "Length", single: "One ~40-second video", series: "One ~35–42 second video per episode, up to 30 days worth" },
  { label: "Billing", single: "One charge for the whole story", series: "Setup charged once; each episode charged separately when generated" },
  { label: "Continuity", single: "Self-contained — nothing carries beyond it", series: "Persistent cast, world bible, and story state carried across every episode" },
  { label: "Best for", single: "Testing a universe, or a complete one-off story", series: "A recurring posting series with real narrative continuity" },
];

export default function ThirtyDaysSeriesVsSingleVideo() {
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
            Comparison
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            30 Days Series vs Single Video: Which Should You Start With?
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Same universe-building idea, two very different commitments. Here's exactly what changes between them.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 26, 2026 · 5 min read · Comparison</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-series-vs-single-hero.png"
            alt="A split image: a single glowing green doorway with a portal on the left, a chain of five connected glowing doorways on the right"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="bg-white/[0.04]">
                    <th className="px-4 py-3 font-bold text-white">What matters</th>
                    <th className="px-4 py-3 font-bold text-lime-200">Single Video</th>
                    <th className="px-4 py-3 font-bold text-lime-200">Series</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((r, i) => (
                    <tr key={r.label} className={i % 2 === 0 ? "" : "bg-white/[0.02]"}>
                      <td className="px-4 py-3 font-semibold text-white align-top">{r.label}</td>
                      <td className="px-4 py-3 text-white/55 align-top">{r.single}</td>
                      <td className="px-4 py-3 text-white/55 align-top">{r.series}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[24px] font-black text-white mb-4 tracking-[-0.01em]">Start with Single Video if you're testing a universe</h2>
            <p className="text-[16px] leading-relaxed">
              It's the lower-commitment option — one charge, one finished story, no ongoing decision to make. See{" "}
              <Link to="/blog/what-is-30-days-ai-trend" className="text-lime-300 hover:underline font-semibold">how the single-video format works</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[24px] font-black text-white mb-4 tracking-[-0.01em]">Start with Series if you already know you'll post regularly</h2>
            <p className="text-[16px] leading-relaxed">
              The setup cost is worth it once you're generating more than a couple of episodes, since the persistent world and continuity are exactly what a single video can't offer.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try Either</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/30-days-series-video-maker"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
              >
                Explore Series Mode
              </Link>
              <Link
                to="/30-days-video-maker"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-[14px] font-black text-white transition hover:bg-white/5"
              >
                Explore Single Video
              </Link>
            </div>
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
