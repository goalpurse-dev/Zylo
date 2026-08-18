import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import ArticleFooterBlock from "../../components/blog/ArticleFooterBlock.jsx";

const EXAMPLES = [
  { src: "/legacy-blog-assets/astronaut.jpg", alt: "Cinematic AI-generated image of an astronaut" },
  { src: "/legacy-blog-assets/dragob.jpg", alt: "3D-style AI-generated dragon illustration" },
  { src: "/legacy-blog-assets/samurai.jpg", alt: "Realistic AI-generated samurai portrait" },
  { src: "/legacy-blog-assets/wolf.jpg", alt: "Cinematic AI-generated wolf image" },
  { src: "/legacy-blog-assets/greek.png", alt: "AI-generated Greek mythology style scene" },
  { src: "/legacy-blog-assets/beach.png", alt: "AI-generated realistic beach scene" },
];

const STYLES = [
  { name: "Cinematic", desc: "Dramatic lighting and composition built for scroll-stopping thumbnails and hero shots." },
  { name: "3D", desc: "Stylized 3D rendering — the same look behind Zyvo's character-driven video formats." },
  { name: "Anime", desc: "Clean anime-inspired linework and color for character and world art." },
  { name: "Realistic", desc: "Photoreal output for portraits, product shots, and lifestyle imagery." },
  { name: "Product", desc: "Clean-background, ecommerce-ready product visuals with AI background removal." },
];

const FAQS = [
  {
    q: "What styles can I generate?",
    a: "Cinematic, 3D, anime, realistic, and product-focused styles, all from a single text prompt — no separate tool or model switching required.",
  },
  {
    q: "Can I use this for product photos?",
    a: "Yes. The generator includes AI background removal and clean-background product presets built for ecommerce and Shopify listings.",
  },
  {
    q: "Is it free to start?",
    a: "Yes, Zyvo's image generator has a free entry point, with paid tiers for higher volume and resolution.",
  },
  {
    q: "What sizes and platforms is this built for?",
    a: "Output works for TikTok, Instagram Reels, and YouTube thumbnails and covers, as well as square and landscape formats for product listings and ads.",
  },
];

export default function ImageGeneratorLanding() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>AI Image Generator</span>
        </nav>

        <header className="mb-14 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            AI Image Generator
          </span>
          <h1 className="text-[44px] font-bold text-[#110829] leading-tight mb-6">
            Zyvo AI Image Generator: Create Scroll-Stopping Images in Seconds
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Generate cinematic, 3D, anime, realistic, and product-ready images from a single prompt — for TikTok, Instagram Reels, YouTube, and ecommerce. No design skills needed, free to start.
          </p>
        </header>

        <div className="mb-16 grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl overflow-hidden">
          {EXAMPLES.map((ex, i) => (
            <div key={ex.src} className="aspect-square overflow-hidden rounded-xl border border-[#ECE8F2] bg-[#090a0d]">
              <img
                src={ex.src}
                alt={ex.alt}
                width={400}
                height={400}
                className="w-full h-full object-cover"
                loading={i < 3 ? "eager" : "lazy"}
                decoding="async"
                {...(i < 3 ? { fetchPriority: "high" } : {})}
              />
            </div>
          ))}
        </div>

        <div className="mb-16 text-center">
          <Link
            to="/workspace/image-generator"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[16px] px-9 py-4 rounded-[14px] hover:opacity-90 transition"
          >
            Start Generating Free
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="max-w-3xl mx-auto space-y-14 text-[#374151]">

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5 text-center">Five Styles, One Generator</h2>
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-4 text-center">How It Works</h2>
            <div className="space-y-3">
              {[
                { n: "1", title: "Describe what you want", desc: "Write a plain-language prompt, or pick a style preset to guide the look." },
                { n: "2", title: "Generate in seconds", desc: "Zyvo renders your image directly in the workspace — no external tools." },
                { n: "3", title: "Download or publish", desc: "Export the image, or send it straight into Zyvo's other content tools." },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-[#E5E0F5] bg-white p-5 flex gap-4">
                  <span className="text-[20px] font-black text-[#D8CFF0] leading-none shrink-0">{s.n}</span>
                  <div>
                    <p className="text-[15px] font-bold text-[#110829] mb-1">{s.title}</p>
                    <p className="text-[14px] text-[#6b7280] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5 text-center">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <div key={f.q} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-2">{f.q}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="text-center pt-4">
            <Link
              to="/workspace/image-generator"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the AI Image Generator
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </section>

        </div>

        <ArticleFooterBlock slug="/image-generator" />
      </div>
      <Footer />
    </div>
  );
}
