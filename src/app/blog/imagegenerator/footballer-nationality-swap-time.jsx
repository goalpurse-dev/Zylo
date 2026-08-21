import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is Footballer Nationality Swap? (And How It Works)",
    description: "Why the format works, what actually gets generated, and how to create one in Zyvo.",
    date: "13.08.2026",
    slug: "/blog/footballer-nationality-swap-explained",
  },
  {
    title: "15 Footballer Nationality Swap Video Ideas You Can Try",
    description: "Fifteen structural concepts, from rival-nation swaps to full world-tour sequences.",
    date: "21.08.2026",
    slug: "/blog/footballer-nationality-swap-ideas",
  },
  {
    title: "5 Tips for the Most Believable Footballer Nationality Swap Video",
    description: "Background style, expression, jersey contrast, and spoken-line length.",
    date: "13.08.2026",
    slug: "/blog/footballer-nationality-swap-tips",
  },
];

const STEPS = [
  { n: "1", title: "Name a footballer and a nation", time: "Under a minute", desc: "Enter the player's name and choose the nation you want to picture them representing." },
  { n: "2", title: "Pick a background and quality tier", time: "Under a minute", desc: "Choose stadium tunnel, press conference, or training ground, plus 480p, 720p, or 1080p." },
  { n: "3", title: "Generation", time: "Scales with scene count", desc: "Each scene is a 6-second vertical talking clip — generating 3 to 5 scenes for a full sequence takes longer than a single clip." },
  { n: "4", title: "Review and stitch", time: "Under a minute", desc: "Preview each scene, then stitch multiple scenes into one continuous video if you generated a sequence." },
];

const FAQS = [
  {
    q: "How long does one Footballer Nationality Swap clip take?",
    a: "A single 6-second scene generates quickly. A full sequence of 3 to 5 stitched scenes takes longer since each scene generates individually before being combined.",
  },
  {
    q: "Does a higher quality tier take longer?",
    a: "Higher resolution settings generally take somewhat longer to generate than lower ones, though the difference is usually modest.",
  },
  {
    q: "Can I speed things up by skipping the spoken line?",
    a: "The talking, lip-synced element is core to the format, so it's included by default — but keeping the spoken line short helps it sync more convincingly without adding meaningful generation time.",
  },
];

export default function FootballerNationalitySwapTime() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Footballer Nationality Swap Time</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Getting Started
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How Long Does a Footballer Nationality Swap Video Take to Make?
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            From naming a player to a finished, stitched sequence — what actually takes time, step by step.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Getting Started</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/footballer-swap-time-hero.png"
              alt="An abstract glowing purple stopwatch with a soccer ball silhouette faintly visible behind it"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/footballer-swap-time-stadium.png"
              alt="An empty stadium tunnel with bright lights at the far end"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <p className="text-[17px] leading-relaxed">
              A single Footballer Nationality Swap clip is quick to set up — most of the time is generation time running in the background, not manual work.
            </p>
          </section>

          <section>
            <div className="space-y-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-xl border border-[#E5E0F5] bg-white p-5 flex gap-4">
                  <span className="text-[20px] font-black text-[#D8CFF0] leading-none shrink-0">{s.n}</span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <p className="text-[15px] font-bold text-[#110829]">{s.title}</p>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#7A3BFF]">{s.time}</span>
                    </div>
                    <p className="text-[13px] text-[#6b7280] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Generate Your First Swap</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Start with a single scene to see the full timeline, then build up to a stitched sequence. For premise ideas, see{" "}
              <Link to="/blog/footballer-nationality-swap-ideas" className="text-[#7A3BFF] hover:underline font-semibold">15 video ideas</Link>.
            </p>
            <Link
              to="/footballer-nationality-swap-ai"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Footballer Nationality Swap →
            </Link>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <div key={f.q} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-2">{f.q}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        <div className="mt-20">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
