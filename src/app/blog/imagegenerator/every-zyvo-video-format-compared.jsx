import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Which Zyvo Template Should You Start With? A Quick Decision Guide",
    description: "Match what you want to make to the right Zyvo tool in under two minutes.",
    date: "21.08.2026",
    slug: "/blog/which-zyvo-template",
  },
  {
    title: "The Ultimate Zyvo Template Comparison: All 9 Tools Side by Side",
    description: "Every Zyvo tool, its real output format, and what it's actually best for.",
    date: "21.08.2026",
    slug: "/blog/zyvo-template-comparison",
  },
  {
    title: "Building a Multi-Format Weekly Content Calendar With Zyvo",
    description: "How to combine several formats into one sustainable weekly posting rhythm.",
    date: "21.08.2026",
    slug: "/blog/multi-format-weekly-calendar",
  },
];

const FORMATS = [
  { name: "Behind the Scenes", output: "Still image → 8s video, with sound", best: "Big spectacle, dramatic payoff", learn: "/blog/behind-the-scenes-trend-explained", make: "/behind-the-scenes-video-maker" },
  { name: "Clay Rescue", output: "Multi-scene claymation sequence", best: "Wholesome, feel-good resolution", learn: "/blog/what-is-clay-rescue", make: "/clay-rescue-maker" },
  { name: "Micro Camera Animal", output: "POV journey through an underground world", best: "Calm, documentary-style curiosity", learn: "/blog/what-is-micro-camera-animal", make: "/micro-camera-animal-maker" },
  { name: "Face ASMR", output: "Single satisfying texture video", best: "Personal, sensory content using your own photo", learn: "/blog/what-is-face-asmr", make: "/face-asmr-maker" },
  { name: "Cartoon Drive-By", output: "Continuous 10s vertical video", best: "Atmospheric travel-style visuals", learn: "/blog/cartoon-drive-by-explained", make: "/cartoon-drive-by-video-maker" },
  { name: "Footballer Nationality Swap", output: "6s talking clips, stitched into a sequence", best: "Sports content and quick novelty cameos", learn: "/blog/footballer-nationality-swap-explained", make: "/footballer-nationality-swap-ai" },
];

export default function EveryZyvoVideoFormatCompared() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Every Zyvo AI Video Format Compared</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Comparison Hub
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Every Zyvo AI Video Format Compared: Which One Should You Try Next?
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Six format-specific AI video tools, side by side — what each one actually outputs, and where to learn more or start making.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 7 min read · Comparison Hub</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/every-format-compared-hero.png"
              alt="An abstract glowing purple network diagram of six connected geometric nodes linked by radiating lines"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/every-format-compared-grid.png"
              alt="An abstract glowing purple grid of rows and columns made of light, minimalist data-table style"
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
              Zyvo's video tools are each built around one specific, proven format rather than a single general-purpose generator. Here's exactly what each one outputs, and which mood it's built for.
            </p>
          </section>

          <section>
            <div className="overflow-x-auto rounded-2xl border border-[#E5E0F5]">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="bg-[#F3EFFB]">
                    <th className="px-4 py-3 font-bold text-[#110829]">Format</th>
                    <th className="px-4 py-3 font-bold text-[#110829]">What it outputs</th>
                    <th className="px-4 py-3 font-bold text-[#110829]">Best for</th>
                  </tr>
                </thead>
                <tbody>
                  {FORMATS.map((f, i) => (
                    <tr key={f.name} className={i % 2 === 0 ? "bg-white" : "bg-[#FBFAFE]"}>
                      <td className="px-4 py-3 font-semibold text-[#110829] align-top">
                        <Link to={f.learn} className="hover:text-[#7A3BFF] hover:underline">{f.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{f.output}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{f.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Not limited to one</h2>
            <p className="text-[17px] leading-relaxed">
              Plenty of creators run two or three of these formats at once, each covering a different mood in the same content mix. See{" "}
              <Link to="/blog/multi-format-weekly-calendar" className="text-[#7A3BFF] hover:underline font-semibold">how to combine several formats into one weekly rhythm</Link>{" "}
              once you've picked your first.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try Any Format Free</h2>
            <Link
              to="/signup"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Start Creating Free →
            </Link>
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
