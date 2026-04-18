import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";
import Hero from "../../../assets/blog/productphoto/example1.png";
import Before from "../../../assets/blog/productphoto/beforeafter.png";
import BgExample from "../../../assets/blog/productphoto/bgexample.png";
import Example2 from "../../../assets/blog/productphoto/example2.png";
import Serum from "../../../assets/grid/product/serum.png";
import Sneaker from "../../../assets/grid/product/sneaker.jpg";

const related = [
  {
    title: "Zyvo vs Midjourney for Product Photos: Which AI Tool Wins?",
    description: "An honest comparison of Zyvo and Midjourney for ecommerce product photography.",
    date: "18.04.2026",
    slug: "/blog/zyvo-vs-midjourney-product-photos",
  },
  {
    title: "AI Background Removal for Product Photos",
    description: "Remove backgrounds instantly and get clean, professional product images.",
    date: "18.01.2026",
    slug: "/blog/ai-background-removal-for-product-photos",
  },
  {
    title: "Best AI Tools for Ecommerce Product Photography",
    description: "Top AI tools to create high-quality ecommerce product images fast.",
    date: "10.01.2026",
    slug: "/blog/best-ai-tools-for-ecommerce",
  },
];

const TOC = [
  { id: "what-is", label: "What is an AI product photo generator?" },
  { id: "how-it-works", label: "How it works" },
  { id: "background-removal", label: "AI background removal for ecommerce" },
  { id: "social-media", label: "Free AI image creator for social media" },
  { id: "why-zyvo", label: "Why Zyvo leads the category" },
  { id: "step-by-step", label: "Step-by-step guide" },
  { id: "faq", label: "FAQ" },
];

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-[#7A3BFF] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-[#110829] text-[15px] pr-4">{q}</span>
        <svg
          className={`w-4 h-4 text-[#7A3BFF] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5 pt-1 bg-white text-[#4A4A55] text-[14px] leading-relaxed border-t border-gray-100">
          {a}
        </div>
      )}
    </div>
  );
}

export default function AIProductPhotoGenerator() {
  useEffect(() => {
    document.title = "Best AI Product Photo Generator in 2026 (Free + Ecommerce Guide) | Zyvo";

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = "Discover the best AI product photo generator for ecommerce. Remove backgrounds, create social media visuals, and scale your store content — free to start.";

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://www.tryzyvo.com/blog/ai-product-photo-generator";
  }, []);

  return (
    <div style={{ backgroundColor: "#F7F5FA" }} className="min-h-screen">

      {/* Hero banner */}
      <div className="bg-gradient-to-br from-[#0E0C15] via-[#160d30] to-[#0E0C15]">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-20">
          <nav className="flex items-center gap-2 text-[12px] text-white/40 mb-6">
            <Link to="/blog" className="hover:text-white/70 transition">Blog</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-white/70 transition">Product Photos</Link>
            <span>/</span>
            <span className="text-white/60">AI Product Photo Generator</span>
          </nav>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-400 text-[11px] font-semibold uppercase tracking-widest">Product Photos</span>
          </div>
          <h1 className="text-white text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
            Best AI Product Photo Generator in 2026:<br className="hidden md:block" />
            <span className="bg-gradient-to-r from-[#9B6FFF] to-[#C084FC] bg-clip-text text-transparent"> Free Tool for Ecommerce & Social Media</span>
          </h1>
          <p className="text-white/55 text-[15px] md:text-[16px] leading-relaxed max-w-2xl">
            Generate studio-quality product photos, remove backgrounds in one click, and create scroll-stopping social media content — all with AI. No photoshoot needed.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-6 text-[13px] text-white/35">
            <span>Updated Apr 18, 2026</span>
            <span>·</span>
            <span>9 min read</span>
            <span>·</span>
            <span>By Zyvo Editorial</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Sticky TOC — desktop */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#7A3BFF] mb-4">On this page</p>
              <nav className="flex flex-col gap-1">
                {TOC.map(item => (
                  <a key={item.id} href={`#${item.id}`}
                    className="text-[13px] text-[#4A4A55] hover:text-[#7A3BFF] py-1 pl-3 border-l-2 border-transparent hover:border-[#7A3BFF] transition-all duration-150">
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <article className="flex-1 min-w-0">

            {/* Hero image */}
            <img src={Hero} alt="AI product photo generator — studio quality product image created by Zyvo AI"
              className="w-full rounded-2xl mb-10 object-cover max-h-[420px] shadow-sm" />

            {/* Intro */}
            <p className="text-[17px] text-[#2D2D35] leading-relaxed mb-5 font-medium">
              If you sell products online, your photos are your first impression. A blurry, low-quality image costs you sales before a single word is read.
            </p>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-10">
              The problem? Traditional product photography is expensive, slow, and hard to scale. Studio rentals, photographers, props, lighting rigs — just to get a few usable shots.
              That's why thousands of ecommerce brands are switching to AI product photo generators like Zyvo, which can produce studio-grade visuals in under 10 seconds.
            </p>

            {/* Key stats box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
              {[
                { stat: "10×", label: "faster than a photoshoot" },
                { stat: "90%", label: "lower cost vs. studio" },
                { stat: "∞", label: "variations per product" },
              ].map(({ stat, label }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 text-center shadow-sm">
                  <div className="text-3xl font-extrabold text-[#7A3BFF] mb-1">{stat}</div>
                  <div className="text-[13px] text-[#4A4A55]">{label}</div>
                </div>
              ))}
            </div>

            {/* Section 1 */}
            <h2 id="what-is" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              What is an AI product photo generator?
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-5">
              An <strong className="text-[#110829]">AI product photo generator</strong> is a tool that uses machine learning to automatically create, enhance, or transform product images.
              Instead of photographing products in a studio, you upload a raw image and the AI renders it against clean backgrounds, lifestyle environments, or custom scenes — in seconds.
            </p>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-10">
              The best tools (like Zyvo) go further: they remove backgrounds, generate multiple style variants, optimise images for different platforms, and let you create unlimited product photo content without a camera.
            </p>

            {/* Section 2 */}
            <h2 id="how-it-works" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              How AI product photo generation works
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-6">
              Modern AI image generators use diffusion models — the same technology behind Midjourney, DALL-E, and Stable Diffusion — but trained specifically on commercial product photography.
              This means they understand lighting, shadow, perspective, and composition at a level that produces commercially viable results, not just "AI art."
            </p>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-10 shadow-sm">
              <p className="text-[12px] font-bold uppercase tracking-widest text-[#7A3BFF] mb-4">How Zyvo generates product photos</p>
              <div className="flex flex-col gap-3">
                {[
                  ["Upload your product image", "Any angle, any background — Zyvo accepts it"],
                  ["Choose a scene or background style", "Marble, white studio, lifestyle, outdoor — 20+ presets"],
                  ["AI renders the final image", "Full resolution output in under 10 seconds"],
                  ["Download & publish", "Optimised for Shopify, Amazon, Instagram, and ads"],
                ].map(([step, desc], i) => (
                  <div key={step} className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-[#7A3BFF]/10 text-[#7A3BFF] text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                    <div>
                      <p className="font-semibold text-[#110829] text-[14px]">{step}</p>
                      <p className="text-[13px] text-[#4A4A55]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3 — Background removal */}
            <h2 id="background-removal" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              AI background remover for ecommerce
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-5">
              Background removal is one of the most common and most tedious tasks in ecommerce product photography. Done manually in Photoshop, it takes 15–30 minutes per image.
              AI background removal does it in under 3 seconds — and Zyvo's model is specifically trained on product images, meaning it handles fine details like jewelry chains, hair, and transparent packaging accurately.
            </p>

            <img src={Before} alt="AI background remover for ecommerce — before and after product photo transformation"
              className="w-full rounded-2xl mb-6 object-cover max-h-[360px] shadow-sm" />

            <div className="bg-[#F0EBFF] rounded-2xl p-6 mb-10">
              <p className="text-[12px] font-bold uppercase tracking-widest text-[#7A3BFF] mb-4">What Zyvo's AI background removal handles</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Clean white/transparent backgrounds",
                  "Complex product edges (bottles, jewellery)",
                  "Transparent or reflective surfaces",
                  "Multiple products in one frame",
                  "Instantly swap to any new background",
                  "Batch processing multiple SKUs",
                ].map(feat => (
                  <div key={feat} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="text-[14px] text-[#2D2D35]">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-10">
              For ecommerce brands listing on Amazon, Etsy, or Shopify, clean backgrounds are a requirement. Zyvo's AI background remover lets you meet platform standards and create lifestyle variants from the same source image — without touching Photoshop.
            </p>

            {/* Section 4 — Social media */}
            <h2 id="social-media" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              Free AI image creator for social media
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-5">
              Social media content is a volume game. Brands posting daily on Instagram, TikTok, and Pinterest need a constant stream of high-quality visuals — but most can't afford a photoshoot every week.
            </p>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-6">
              Zyvo's <strong className="text-[#110829]">free AI image creator</strong> lets you generate up to 10 product and lifestyle images per month at no cost. No credit card required. Outputs are formatted for every major social platform and ready to post in seconds.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <img src={Serum} alt="AI generated product photo for social media — serum skincare" className="rounded-xl object-cover w-full h-48 shadow-sm" />
              <img src={Sneaker} alt="AI generated product photo — sneaker footwear social media content" className="rounded-xl object-cover w-full h-48 shadow-sm" />
            </div>
            <p className="text-[12px] text-[#9CA3AF] text-center mb-10 italic">Examples of AI-generated product photos made with Zyvo</p>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-10 shadow-sm">
              <p className="text-[12px] font-bold uppercase tracking-widest text-[#7A3BFF] mb-4">Zyvo free plan — what you get</p>
              <div className="flex flex-col gap-3">
                {[
                  ["10 AI image generations / month", "Resets monthly — no card needed"],
                  ["All image styles & models", "Access every background and scene preset"],
                  ["Watermark-free downloads", "Own and publish every image you create"],
                  ["Product & lifestyle modes", "Clean studio shots and real-world scenes"],
                ].map(([title, sub]) => (
                  <div key={title} className="flex items-start gap-3">
                    <CheckIcon />
                    <div>
                      <p className="text-[14px] font-semibold text-[#110829]">{title}</p>
                      <p className="text-[13px] text-[#4A4A55]">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5 — Why Zyvo */}
            <h2 id="why-zyvo" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              Why Zyvo leads the AI product photo category
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-6">
              Most general AI image generators (Midjourney, DALL-E, Leonardo) are built for creativity and art — not commercial product photography. They struggle with accurate colour representation, consistent product framing, and platform-ready outputs.
              Zyvo is purpose-built for product and brand content, which means:
            </p>

            {/* Comparison table */}
            <div className="overflow-x-auto mb-10 rounded-2xl border border-gray-200 shadow-sm">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#110829] text-white">
                    <th className="text-left px-5 py-3.5 font-semibold rounded-tl-2xl">Feature</th>
                    <th className="px-5 py-3.5 font-semibold text-center">Zyvo</th>
                    <th className="px-5 py-3.5 font-semibold text-center">Generic AI tools</th>
                    <th className="px-5 py-3.5 font-semibold text-center rounded-tr-2xl">Photoshoot</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Product-trained AI model", "✓", "✗", "N/A"],
                    ["Background removal", "✓ Auto", "Manual", "Requires editing"],
                    ["Platform-optimised outputs", "✓", "✗", "Manual resize"],
                    ["Free tier available", "✓ 10/mo", "Limited", "✗"],
                    ["Time to first image", "< 10 sec", "< 30 sec", "Days"],
                    ["Ecommerce-ready quality", "✓", "Inconsistent", "✓"],
                    ["Social media formats", "✓", "Partial", "Manual"],
                  ].map(([feat, zyvo, generic, shoot], i) => (
                    <tr key={feat} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-5 py-3 font-medium text-[#110829]">{feat}</td>
                      <td className="px-5 py-3 text-center text-emerald-600 font-semibold">{zyvo}</td>
                      <td className="px-5 py-3 text-center text-[#4A4A55]">{generic}</td>
                      <td className="px-5 py-3 text-center text-[#4A4A55]">{shoot}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 6 — Step by step */}
            <h2 id="step-by-step" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              How to generate product photos with Zyvo: step-by-step
            </h2>

            <div className="flex flex-col gap-4 mb-10">
              {[
                {
                  n: "01",
                  title: "Sign up free — no card required",
                  body: "Create a Zyvo account in 30 seconds. You start with 10 free generations that reset monthly.",
                },
                {
                  n: "02",
                  title: "Go to the AI Image Generator",
                  body: "Navigate to Workspace → Image Generator. Choose 'Product Photo' mode for ecommerce-optimised output.",
                },
                {
                  n: "03",
                  title: "Upload or describe your product",
                  body: "Upload a product image or type a text prompt. Zyvo's AI understands product context — framing, lighting, and composition are handled automatically.",
                },
                {
                  n: "04",
                  title: "Select your background or scene",
                  body: "Choose from white studio, marble, outdoor lifestyle, gradient, or any custom scene. Each is ecommerce and social media ready.",
                },
                {
                  n: "05",
                  title: "Generate, download, and publish",
                  body: "Get your image in under 10 seconds. Download in high resolution — no watermark, fully yours to use commercially.",
                },
              ].map(({ n, title, body }) => (
                <div key={n} className="flex gap-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="text-[28px] font-black text-[#E8E0FF] leading-none shrink-0 w-10 text-right">{n}</div>
                  <div>
                    <p className="font-bold text-[#110829] text-[15px] mb-1">{title}</p>
                    <p className="text-[14px] text-[#4A4A55] leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <img src={BgExample} alt="AI product photo generator output — product on clean ecommerce background"
              className="w-full rounded-2xl mb-10 object-cover max-h-[340px] shadow-sm" />

            {/* FAQ */}
            <h2 id="faq" className="text-2xl md:text-3xl font-bold text-[#110829] mb-6 scroll-mt-24">
              Frequently asked questions
            </h2>
            <div className="flex flex-col gap-3 mb-12">
              {[
                {
                  q: "Is Zyvo's AI product photo generator really free?",
                  a: "Yes. Zyvo offers 10 free AI image generations per month with no credit card required. Free plan outputs are watermark-free and commercially usable. Paid plans start at €12/month for higher volume.",
                },
                {
                  q: "How good is the AI background removal for ecommerce products?",
                  a: "Zyvo's background removal is trained specifically on product images, making it more accurate than general-purpose tools for items like jewellery, transparent bottles, and fine fabric. It handles complex edges and reflective surfaces that other tools struggle with.",
                },
                {
                  q: "Can I use Zyvo for social media content, not just product photos?",
                  a: "Absolutely. Zyvo generates lifestyle scenes, brand imagery, and social media visuals in addition to clean product shots. You can produce content optimised for Instagram, TikTok, Pinterest, and Facebook ads all in one tool.",
                },
                {
                  q: "What image formats and resolutions does Zyvo output?",
                  a: "Zyvo outputs high-resolution images suitable for ecommerce product pages (2000px+), social media posts, and paid advertising. Downloads are in JPG/PNG format.",
                },
                {
                  q: "How does Zyvo compare to Midjourney for product photos?",
                  a: "Midjourney excels at artistic and creative images but is not purpose-built for commercial product photography. It lacks background removal, ecommerce presets, and platform-optimised outputs. Zyvo is specifically trained on product content, delivering more consistent, commercial-grade results. Read our full comparison: Zyvo vs Midjourney for product photos.",
                },
                {
                  q: "Do I need design skills to use an AI product photo generator?",
                  a: "No. Zyvo is designed for non-designers. You upload a product photo or type a prompt, choose a style, and receive a finished image. The AI handles composition, lighting, and background — no Photoshop skills needed.",
                },
              ].map(faq => <FaqItem key={faq.q} {...faq} />)}
            </div>

            {/* CTA */}
            <div className="rounded-2xl overflow-hidden shadow-sm mb-12">
              <div className="bg-gradient-to-br from-[#0E0C15] via-[#1a0d38] to-[#0E0C15] px-8 py-10 text-center">
                <p className="text-[12px] font-bold uppercase tracking-widest text-[#9B6FFF] mb-3">Start for free</p>
                <h3 className="text-white text-2xl font-extrabold mb-3">Generate your first product photo in 10 seconds</h3>
                <p className="text-white/50 text-[14px] mb-7 max-w-sm mx-auto">10 free images every month. No credit card. No photoshoot. Just results.</p>
                <Link
                  to="/workspace/image-generator"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-[15px] transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#7A3BFF,#9D6BFF)", boxShadow: "0 8px 28px rgba(122,59,255,0.45)" }}
                >
                  Try Zyvo free →
                </Link>
                <p className="text-white/25 text-[12px] mt-4">Free plan · No card · Cancel anytime</p>
              </div>
            </div>

            <RelatedArticles articles={related} />
          </article>
        </div>
      </div>

      <Footer />
    </div>
  );
}
