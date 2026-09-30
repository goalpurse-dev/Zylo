import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "The Viral Skeleton X-Ray AI Photo Trend: How to Create Your Own",
    description: "A glowing neon skeletal overlay style, for people and pets.",
    date: "23.08.2026",
    slug: "/blog/skeleton-xray-ai-trend",
  },
  {
    title: "Voxel-Style AI Photos: Turn Any Prompt Into Blocky Art",
    description: "How the blocky voxel style works and where it shines.",
    date: "23.08.2026",
    slug: "/blog/voxel-style-ai-images",
  },
  {
    title: "Noir vs Cyberpunk: The Two Moodiest AI Image Styles Compared",
    description: "Two opposite ways to make an image feel cinematic.",
    date: "23.08.2026",
    slug: "/blog/noir-vs-cyberpunk-ai-images",
  },
];

const STYLES = [
  { name: "Lego", desc: "Renders a scene built entirely from blocky, brick-based construction — a fun, toy-like alternative to realistic renders." },
  { name: "Pixel Art", desc: "Reduces an image down to a retro, 8-bit-style grid of visible pixels — great for nostalgic gaming-adjacent content." },
  { name: "Noir", desc: "High-contrast black and white with dramatic shadow — instantly cinematic without any color grading work." },
  { name: "Comic", desc: "Bold outlines and halftone dot shading, styled like a printed comic-book panel." },
  { name: "Lowpoly", desc: "Faceted, geometric 3D shapes with visible flat polygon surfaces — a distinct, modern-minimalist look." },
  { name: "Vintage Portrait", desc: "Aged, sepia-toned photographic styling that reads as an old found photograph rather than a modern shot." },
];

export default function HiddenAiImageStyles() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>10 Hidden AI Image Styles</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Style Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            10 AI Image Styles You Didn't Know You Could Generate
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Most creators generate in the same two or three styles and stop. Here are six named Zyvo styles that rarely get opened, and what each one actually looks like.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 23, 2026 · 5 min read · Style Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/hidden-ai-styles-hero.png"
              alt="A row of six small abstract art style swatch tiles showing voxel, pixel art, noir, comic, lowpoly, and vintage treatments"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/hidden-ai-styles-swatches.png"
              alt="A row of five plain glowing color swatch cards in silver, cyan, magenta, teal, and gold"
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
              Zyvo's image generator ships with far more named styles than the handful most creators default to. Here are six worth a second look.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {STYLES.map((s) => (
                <div key={s.name} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{s.name}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Two more worth their own deep dive</h2>
            <p className="text-[17px] leading-relaxed">
              Minecraft and the moodier Noir/Cyberpunk pairing are distinct enough to deserve their own breakdown — see{" "}
              <Link to="/blog/voxel-style-ai-images" className="text-[#7A3BFF] hover:underline font-semibold">the blocky voxel style explained</Link>{" "}
              and{" "}
              <Link to="/blog/noir-vs-cyberpunk-ai-images" className="text-[#7A3BFF] hover:underline font-semibold">Noir vs Cyberpunk compared</Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try a New Style Today</h2>
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
