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
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
  {
    title: "The Complete Zyvo Content Workflow: From Idea to Published Post",
    description: "How every Zyvo tool connects — generation, publishing, and analytics — in one workflow.",
    date: "21.08.2026",
    slug: "/blog/zyvo-content-workflow",
  },
  {
    title: "Best AI Video Generators for TikTok in 2026",
    description: "What actually separates a good AI video generator from a disappointing one.",
    date: "21.08.2026",
    slug: "/blog/best-ai-video-generators-tiktok",
  },
  {
    title: "Faceless YouTube Channel Ideas Using AI in 2026",
    description: "Six AI-generated formats that never require appearing on camera.",
    date: "21.08.2026",
    slug: "/blog/faceless-youtube-channel-ideas",
  },
  {
    title: "Every Zyvo AI Video Format Compared: Which One Should You Try Next?",
    description: "Six format-specific AI video tools, side by side.",
    date: "21.08.2026",
    slug: "/blog/every-zyvo-video-format-compared",
  },
];

const TOOLS = [
  { name: "AI Fruit Story Maker", output: "Multi-scene video, talking characters", bestFor: "Character-driven drama storylines", guide: "/blog/what-is-ai-fruit-story", href: "/ai-fruit-story-maker" },
  { name: "2AM Worlds Generator", output: "Six cinematic still images", bestFor: "Nostalgic, atmospheric worldbuilding", guide: "/blog/what-is-the-2am-worlds-ai-trend", href: "/2am-worlds-ai-generator" },
  { name: "Behind the Scenes", output: "Movie-set still + 8-second video", bestFor: "Big, satisfying spectacle", guide: "/blog/behind-the-scenes-trend-explained", href: "/behind-the-scenes-video-maker" },
  { name: "Clay Rescue", output: "Short claymation-style video", bestFor: "Wholesome, feel-good content", guide: "/blog/what-is-clay-rescue", href: "/clay-rescue-maker" },
  { name: "Micro Camera Animal", output: "POV video sequence", bestFor: "Curiosity-driven documentary content", guide: "/blog/what-is-micro-camera-animal", href: "/micro-camera-animal-maker" },
  { name: "Face ASMR", output: "Short texture-transformation video", bestFor: "Content using your own face", guide: "/blog/what-is-face-asmr", href: "/face-asmr-maker" },
  { name: "Cartoon Drive-By", output: "10-second continuous vertical video", bestFor: "Travel-style, motion-driven content", guide: "/blog/cartoon-drive-by-explained", href: "/cartoon-drive-by-video-maker" },
  { name: "Footballer Nationality Swap", output: "6-second talking clips, stitchable", bestFor: "Sports content", guide: "/blog/footballer-nationality-swap-explained", href: "/footballer-nationality-swap-ai" },
  { name: "AI Image Generator", output: "Single images, any style", bestFor: "General-purpose visuals, any use case", guide: "/blog/ai-image-generator-prompt-formula", href: "/image-generator" },
];

export default function ZyvoTemplateComparison() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Zyvo Template Comparison</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Comparison
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            The Ultimate Zyvo Template Comparison: All 9 Tools Side by Side
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Every Zyvo tool, its real output format, and what it's actually best for — in one reference table.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 7 min read · Comparison</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/zyvo-template-comparison-hero.png"
            alt="An abstract grid of nine glowing purple and violet geometric panels arranged in three rows of three"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <p className="text-[17px] leading-relaxed">
              Every Zyvo tool is built around a different output format and use case. This table is the full reference — click through to each tool's complete guide for the details behind the summary.
            </p>
          </section>

          <section>
            <div className="overflow-x-auto rounded-2xl border border-[#E5E0F5]">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead className="bg-purple-50">
                  <tr>
                    <th className="px-4 py-3 font-bold text-[#110829]">Tool</th>
                    <th className="px-4 py-3 font-bold text-[#110829]">Output</th>
                    <th className="px-4 py-3 font-bold text-[#110829]">Best for</th>
                    <th className="px-4 py-3 font-bold text-[#110829]">Guide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0F5]">
                  {TOOLS.map((t) => (
                    <tr key={t.href}>
                      <td className="px-4 py-3 font-bold text-[#110829]">
                        <Link to={t.href} className="hover:text-[#7A3BFF] hover:underline">{t.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-[#374151]">{t.output}</td>
                      <td className="px-4 py-3 text-[#6b7280]">{t.bestFor}</td>
                      <td className="px-4 py-3">
                        <Link to={t.guide} className="text-[#7A3BFF] font-semibold hover:underline">Read guide →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Still deciding?</h2>
            <p className="text-[17px] leading-relaxed">
              For a faster, if-then style walkthrough instead of a full table, see{" "}
              <Link to="/blog/which-zyvo-template" className="text-[#7A3BFF] hover:underline font-semibold">the quick decision guide</Link>. Once you've generated something, the next step is publishing and tracking it — see{" "}
              <Link to="/blog/zyvo-content-workflow" className="text-[#7A3BFF] hover:underline font-semibold">the complete content workflow</Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try Any Tool Free</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Every tool above has a free entry point using your account's credit balance.
            </p>
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
