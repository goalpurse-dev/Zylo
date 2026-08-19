import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Write the Perfect AI Image Generator Prompt (Formula + Examples)",
    description: "A repeatable 6-part prompt formula, with weak-vs-strong examples for cinematic, product, and anime styles.",
    date: "19.08.2026",
    slug: "/blog/ai-image-generator-prompt-formula",
  },
  {
    title: "Which AI Image Style Works Best?",
    description: "Anime, 3D, or realistic — use only the best AI image styles and learn to control them.",
    date: "12.03.2026",
    slug: "/blog/which-ai-image-style-works-best",
  },
  {
    title: "10 AI Image Generator Mistakes to Avoid (And How to Fix Each One)",
    description: "The most common reasons AI-generated images come back looking generic, and the fix for each.",
    date: "19.08.2026",
    slug: "/blog/ai-image-generator-mistakes",
  },
];

const EXAMPLES = [
  { src: "/legacy-blog-assets/astronaut.jpg", style: "Cinematic", title: "A lone astronaut on a desert dune", desc: "Cinematic style leans on dramatic lighting and wide framing — built for thumbnails and hero images that need to stop a scroll." },
  { src: "/legacy-blog-assets/dragob.jpg", style: "3D", title: "A stylized 3D dragon illustration", desc: "3D style renders subjects with depth and stylized shading — the same visual language behind Zyvo's character-driven video formats." },
  { src: "/legacy-blog-assets/samurai.jpg", style: "Realistic", title: "A realistic samurai portrait", desc: "Realistic style aims for photographic accuracy in lighting, texture, and proportion — best for portraits and lifelike scenes." },
  { src: "/legacy-blog-assets/wolf.jpg", style: "Cinematic", title: "A wolf in dramatic lighting", desc: "The same cinematic style applied to wildlife subjects — proof the formula holds regardless of subject matter." },
  { src: "/legacy-blog-assets/greek.png", style: "3D", title: "A Greek mythology–inspired scene", desc: "3D style handles mythological and fantasy subjects with the same stylized depth as character work." },
  { src: "/legacy-blog-assets/beach.png", style: "Realistic", title: "A realistic beach scene", desc: "Realistic style for environments and landscapes — useful for backgrounds and establishing shots." },
  { src: "/legacy-blog-assets/village.png", style: "Realistic", title: "A quiet countryside village", desc: "Environmental realism works well for scene-setting shots that need to feel grounded and specific." },
  { src: "/legacy-blog-assets/nyc.png", style: "Cinematic", title: "A cinematic city street scene", desc: "Urban environments rendered with cinematic lighting read as establishing shots for video content." },
];

export default function AIImageGeneratorExamples() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>AI Image Generator Examples</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Real Examples
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            AI Image Generator Examples: 8 Real Styles You Can Create Right Now
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Real output across Zyvo's cinematic, 3D, and realistic styles — what each one is actually good at, so you can pick the right one before you write a prompt.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 19, 2026 · 6 min read · Real Examples</p>
        </header>

        <div className="max-w-5xl space-y-12">

          <p className="text-[17px] leading-relaxed text-[#374151] max-w-3xl">
            Every image below was generated with Zyvo's AI image generator. Each one shows what a given style is actually built for, so you can match the style to the job instead of guessing.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {EXAMPLES.map((ex, i) => (
              <div key={ex.src} className="overflow-hidden rounded-2xl border border-[#241b38] bg-[#090a0d] shadow-sm">
                <img
                  src={ex.src}
                  alt={ex.title}
                  width={640}
                  height={640}
                  className="aspect-square w-full object-cover"
                  loading={i < 2 ? "eager" : "lazy"}
                  decoding="async"
                  {...(i < 2 ? { fetchPriority: "high" } : {})}
                />
                <div className="bg-white p-5">
                  <span className="inline-block bg-purple-100 text-purple-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide mb-2">
                    {ex.style}
                  </span>
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{ex.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{ex.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <section className="max-w-3xl pt-4 border-t border-[#E5E0F5]">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Generate Your Own</h2>
            <p className="text-[16px] leading-relaxed mb-6 text-[#374151]">
              Pick a style above, then use the{" "}
              <Link to="/blog/ai-image-generator-prompt-formula" className="text-[#7A3BFF] hover:underline font-semibold">6-part prompt formula</Link>{" "}
              to write your own version. Generate it directly in{" "}
              <Link to="/image-generator" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI image generator</Link>.
            </p>
            <Link
              to="/image-generator"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the AI Image Generator →
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
