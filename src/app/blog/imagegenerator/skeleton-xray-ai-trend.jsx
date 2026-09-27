import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "10 AI Image Styles You Didn't Know You Could Generate",
    description: "Six lesser-known Zyvo image styles most creators never try.",
    date: "23.08.2026",
    slug: "/blog/hidden-ai-image-styles",
  },
  {
    title: "AI Image Generator Examples: 8 Real Styles You Can Create Right Now",
    description: "Real examples across eight distinct Zyvo image styles.",
    date: "21.05.2026",
    slug: "/blog/ai-image-generator-examples",
  },
  {
    title: "How to Write the Perfect AI Image Generator Prompt (Formula + Examples)",
    description: "A repeatable prompt formula with weak-vs-strong examples.",
    date: "09.08.2026",
    slug: "/blog/ai-image-generator-prompt-formula",
  },
];

const TIPS = [
  { title: "Use a plain, well-lit reference photo", desc: "A clear, front-facing photo with simple lighting gives the generator the clearest outline to build the glowing skeletal overlay on top of." },
  { title: "Pick a color pair with real contrast", desc: "Cyan-and-magenta or blue-and-orange reads more clearly as an X-ray glow than two colors close together on the color wheel." },
  { title: "Try it on pets, not just people", desc: "The dog X-ray version of this style is genuinely one of the most-shared variations — any clear side-profile pet photo works well." },
  { title: "Keep the pose simple", desc: "A straightforward standing or sitting pose translates into a cleaner, more readable skeletal silhouette than a complex or partially obscured one." },
];

export default function SkeletonXrayAiTrend() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>The Skeleton X-Ray AI Photo Trend</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Style Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            The Viral Skeleton X-Ray AI Photo Trend: How to Create Your Own
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A glowing, neon-colored skeletal overlay on a photo of yourself — or your dog. Here's how the style works and how to get a clean result.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 23, 2026 · 5 min read · Style Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/skeleton-xray-trend-hero.png"
              alt="A stylized neon X-ray style portrait showing a glowing skeletal structure inside a translucent human silhouette"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/skeleton-xray-trend-dog.png"
              alt="A stylized neon X-ray style silhouette of a dog showing a glowing skeletal structure inside a translucent outline"
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
              The X-ray style turns a normal photo into a glowing, artistic skeletal scan — part sci-fi, part medical-imaging aesthetic, entirely stylized rather than realistic. It's one of Zyvo's named image styles, built specifically for this look, with a dedicated version for pet photos too.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why it performs well</h2>
            <p className="text-[17px] leading-relaxed">
              It's instantly recognizable, visually striking against a dark feed, and works for a subject almost anyone has on hand — a selfie or a photo of a pet. That combination of novelty and low barrier to entry is what tends to drive a style into heavy rotation.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Tips for a clean result</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {TIPS.map((t) => (
                <div key={t.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{t.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">More styles worth trying</h2>
            <p className="text-[17px] leading-relaxed">
              Skeleton X-Ray is one of several named styles in Zyvo's image generator most creators never open. See{" "}
              <Link to="/blog/hidden-ai-image-styles" className="text-[#7A3BFF] hover:underline font-semibold">the six other lesser-known styles</Link>{" "}
              worth trying next.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try the X-Ray Style</h2>
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
