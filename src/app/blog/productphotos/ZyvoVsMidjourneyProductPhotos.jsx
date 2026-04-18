import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";
import Hero from "../../../assets/blog/productphoto/best.png";
import Example1 from "../../../assets/blog/productphoto/example1.png";
import Example4 from "../../../assets/blog/productphoto/example4.png";
import Candle from "../../../assets/grid/product/candle.jpg";
import Headphone from "../../../assets/grid/product/headphone.jpg";

const related = [
  {
    title: "Best AI Product Photo Generator in 2026",
    description: "Everything you need to know about AI product photo generators for ecommerce.",
    date: "18.04.2026",
    slug: "/blog/ai-product-photo-generator",
  },
  {
    title: "AI Product Photography for Small Businesses",
    description: "How small brands create professional product images with AI — without a studio.",
    date: "20.01.2026",
    slug: "/blog/ai-product-photography-for-small-businesses",
  },
  {
    title: "AI vs Traditional Product Photography",
    description: "A practical comparison for ecommerce brands choosing between AI and photoshoots.",
    date: "15.01.2026",
    slug: "/blog/ai-vs-traditional-product-photography",
  },
];

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "product-photos", label: "Product photo quality" },
  { id: "ease-of-use", label: "Ease of use" },
  { id: "background-removal", label: "Background removal" },
  { id: "pricing", label: "Pricing comparison" },
  { id: "social-media", label: "Social media & ecommerce" },
  { id: "verdict", label: "Verdict: which should you use?" },
  { id: "faq", label: "FAQ" },
];

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

function ScoreBar({ score, max = 10, color = "#7A3BFF" }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(score / max) * 100}%`, background: color }} />
      </div>
      <span className="text-[13px] font-bold text-[#110829] w-8 text-right">{score}/{max}</span>
    </div>
  );
}

const CRITERIA = [
  {
    id: "product-photos",
    label: "Product photo quality",
    zyvoScore: 9,
    midjourneyScore: 6,
    zyvoBadge: "Winner",
    zyvoColor: "#7A3BFF",
    midColor: "#9CA3AF",
  },
  {
    id: "ease-of-use",
    label: "Ease of use",
    zyvoScore: 10,
    midjourneyScore: 5,
    zyvoBadge: "Winner",
    zyvoColor: "#7A3BFF",
    midColor: "#9CA3AF",
  },
  {
    id: "background-removal",
    label: "Background removal",
    zyvoScore: 10,
    midjourneyScore: 2,
    zyvoBadge: "Winner",
    zyvoColor: "#7A3BFF",
    midColor: "#9CA3AF",
  },
  {
    id: "pricing",
    label: "Free tier & pricing",
    zyvoScore: 9,
    midjourneyScore: 4,
    zyvoBadge: "Winner",
    zyvoColor: "#7A3BFF",
    midColor: "#9CA3AF",
  },
  {
    id: "social-media",
    label: "Social media & ecommerce",
    zyvoScore: 10,
    midjourneyScore: 5,
    zyvoBadge: "Winner",
    zyvoColor: "#7A3BFF",
    midColor: "#9CA3AF",
  },
  {
    id: "creative-art",
    label: "Creative / artistic output",
    zyvoScore: 7,
    midjourneyScore: 10,
    zyvoBadge: null,
    midBadge: "Winner",
    zyvoColor: "#9CA3AF",
    midColor: "#F59E0B",
  },
];

export default function ZyvoVsMidjourneyProductPhotos() {
  useEffect(() => {
    document.title = "Zyvo vs Midjourney for Product Photos: Which AI Tool Wins in 2026? | Zyvo";

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = "Zyvo vs Midjourney for product photos — a detailed 2026 comparison covering quality, pricing, background removal, ease of use, and ecommerce suitability.";

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://www.tryzyvo.com/blog/zyvo-vs-midjourney-product-photos";
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
            <span className="text-white/60">Zyvo vs Midjourney</span>
          </nav>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-400 text-[11px] font-semibold uppercase tracking-widest">Comparison</span>
          </div>
          <h1 className="text-white text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
            Zyvo vs Midjourney for Product Photos:<br className="hidden md:block" />
            <span className="bg-gradient-to-r from-[#9B6FFF] to-[#C084FC] bg-clip-text text-transparent"> Which AI Tool Wins in 2026?</span>
          </h1>
          <p className="text-white/55 text-[15px] md:text-[16px] leading-relaxed max-w-2xl">
            An honest, detailed comparison of Zyvo and Midjourney across product photo quality, background removal, pricing, ease of use, and ecommerce suitability — so you pick the right tool the first time.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-6 text-[13px] text-white/35">
            <span>Updated Apr 18, 2026</span>
            <span>·</span>
            <span>11 min read</span>
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

            <img src={Hero} alt="Zyvo vs Midjourney product photos comparison — AI generated ecommerce imagery"
              className="w-full rounded-2xl mb-10 object-cover max-h-[420px] shadow-sm" />

            {/* TL;DR */}
            <div id="overview" className="bg-[#F0EBFF] rounded-2xl p-6 mb-10 scroll-mt-24">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#7A3BFF] mb-3">TL;DR — Quick verdict</p>
              <p className="text-[15px] text-[#2D2D35] leading-relaxed mb-4">
                <strong>Zyvo wins for product photos, ecommerce, and social media.</strong> It's purpose-built for commercial content, includes background removal, has a free tier, and requires zero design skills.
                Midjourney wins for open-ended creative art and illustration — but it's not designed for product photography and lacks the tools ecommerce brands actually need.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-[#7A3BFF] mb-1">Zyvo</div>
                  <div className="text-[12px] text-[#4A4A55] leading-tight">Best for: product photos, ecommerce, social media, background removal</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-[#9CA3AF] mb-1">Midjourney</div>
                  <div className="text-[12px] text-[#4A4A55] leading-tight">Best for: creative art, illustrations, concept imagery, artistic projects</div>
                </div>
              </div>
            </div>

            {/* Scorecard */}
            <h2 className="text-2xl md:text-3xl font-bold text-[#110829] mb-6">Overall scorecard</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-12 shadow-sm">
              <div className="grid grid-cols-[1fr_120px_120px] gap-x-4 gap-y-5">
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">Category</div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#7A3BFF] text-center">Zyvo</div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] text-center">Midjourney</div>
                {CRITERIA.map(c => (
                  <>
                    <div key={c.label} className="flex items-center text-[13px] font-medium text-[#110829]">{c.label}</div>
                    <div>
                      <ScoreBar score={c.zyvoScore} color={c.zyvoColor} />
                    </div>
                    <div>
                      <ScoreBar score={c.midjourneyScore} color={c.midColor} />
                    </div>
                  </>
                ))}
              </div>
            </div>

            {/* Section — Product photo quality */}
            <h2 id="product-photos" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              Product photo quality: Zyvo vs Midjourney
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-5">
              Midjourney is widely regarded as the best AI model for artistic image quality. Its outputs are visually stunning — but they're optimised for aesthetics, not commercial accuracy.
              When you prompt Midjourney for a product photo, you often get a beautiful but unusable image: wrong perspective, inconsistent lighting, hallucinated product details, or a composition that doesn't work on a white background.
            </p>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-6">
              Zyvo's AI is trained specifically on commercial product photography. It understands framing conventions, consistent lighting ratios, how reflective surfaces behave, and what "ecommerce ready" actually means.
              The result: images you can publish to your Shopify store or Amazon listing today, not after hours of editing.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl overflow-hidden shadow-sm">
                <img src={Example1} alt="Zyvo AI product photo — clean ecommerce background, studio quality" className="w-full h-44 object-cover" />
                <div className="bg-white px-3 py-2 border border-gray-100">
                  <p className="text-[12px] font-semibold text-[#7A3BFF]">Zyvo</p>
                  <p className="text-[11px] text-[#4A4A55]">Consistent, ecommerce-ready</p>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <img src={Example4} alt="AI product imagery example — artistic vs commercial quality comparison" className="w-full h-44 object-cover" />
                <div className="bg-white px-3 py-2 border border-gray-100">
                  <p className="text-[12px] font-semibold text-[#9CA3AF]">Generic AI</p>
                  <p className="text-[11px] text-[#4A4A55]">Artistic but inconsistent</p>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-[#9CA3AF] text-center mb-10 italic">Zyvo's product-trained AI vs. a generic AI generator</p>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-12 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#7A3BFF] mb-4">Zyvo product photo advantages</p>
              {[
                ["Accurate colour rendering", "Product colours match the original — critical for reducing returns"],
                ["Consistent framing", "Every image follows ecommerce composition standards"],
                ["Correct shadows & reflections", "Realistic lighting that matches the scene — no AI hallucinations"],
                ["Platform-optimised output", "Square, portrait, and landscape formats for every channel"],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3 mb-3 last:mb-0">
                  <svg className="w-4 h-4 text-[#7A3BFF] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <span className="font-semibold text-[#110829] text-[14px]">{title}: </span>
                    <span className="text-[14px] text-[#4A4A55]">{desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Section — Ease of use */}
            <h2 id="ease-of-use" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              Ease of use
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-5">
              Midjourney requires a Discord account, knowledge of prompt engineering, and familiarity with its parameter system (aspect ratios, style weights, upscaling commands). For a non-designer, the learning curve is steep.
              Getting a good product photo out of Midjourney typically means spending hours learning prompt syntax, testing dozens of variations, and still ending up with images that need editing.
            </p>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-10">
              Zyvo is a web app designed for ecommerce sellers and content creators — not prompt engineers. You upload a product image, choose a background style, and receive a finished image in under 10 seconds.
              No Discord. No prompt syntax. No design skills required.
            </p>

            <div className="overflow-x-auto mb-12 rounded-2xl border border-gray-200 shadow-sm">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#110829] text-white">
                    <th className="text-left px-5 py-3.5 font-semibold rounded-tl-2xl">Task</th>
                    <th className="px-5 py-3.5 font-semibold text-center">Zyvo</th>
                    <th className="px-5 py-3.5 font-semibold text-center rounded-tr-2xl">Midjourney</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Account setup", "Email signup, 30 sec", "Discord account required"],
                    ["First image", "Under 10 seconds", "Requires prompt learning"],
                    ["Background removal", "1 click, automatic", "Not built-in"],
                    ["Ecommerce output", "Pre-built presets", "Manual prompt tuning"],
                    ["Batch processing", "Multiple SKUs at once", "One at a time"],
                    ["Mobile use", "Full web app", "Discord only"],
                  ].map(([task, zyvo, mid], i) => (
                    <tr key={task} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-5 py-3 font-medium text-[#110829]">{task}</td>
                      <td className="px-5 py-3 text-center text-emerald-600 font-medium">{zyvo}</td>
                      <td className="px-5 py-3 text-center text-[#4A4A55]">{mid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section — Background removal */}
            <h2 id="background-removal" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              Background removal: Zyvo vs Midjourney
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-5">
              Background removal is a core need for ecommerce product photography — Amazon requires white backgrounds, Shopify recommends them, and social media content performs better with clean or swapped backgrounds.
            </p>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-10">
              <strong className="text-[#110829]">Midjourney does not have background removal.</strong> It's a text-to-image generator; it doesn't accept product uploads and process them. Any background work requires exporting to Photoshop or a separate tool.
              <strong className="text-[#110829]"> Zyvo includes AI background removal natively</strong> — upload your product, get a transparent or custom background in one click. It's faster, more accurate on product images, and keeps your entire workflow in one place.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-12">
              <div className="rounded-xl overflow-hidden shadow-sm">
                <img src={Candle} alt="Product photo with clean background — Zyvo AI background removal result" className="w-full h-44 object-cover" />
                <div className="bg-white px-3 py-2 border border-gray-100">
                  <p className="text-[12px] font-semibold text-[#7A3BFF]">Zyvo — native background removal</p>
                  <p className="text-[11px] text-[#4A4A55]">1 click · Automatic · Ecommerce ready</p>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <img src={Headphone} alt="Product photo for ecommerce — professional product image quality" className="w-full h-44 object-cover" />
                <div className="bg-white px-3 py-2 border border-gray-100">
                  <p className="text-[12px] font-semibold text-[#9CA3AF]">Midjourney — no background removal</p>
                  <p className="text-[11px] text-[#4A4A55]">Requires separate tool + editing</p>
                </div>
              </div>
            </div>

            {/* Section — Pricing */}
            <h2 id="pricing" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              Pricing comparison
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-6">
              Cost matters — especially for small ecommerce businesses and content creators managing their own marketing budgets.
            </p>

            <div className="overflow-x-auto mb-6 rounded-2xl border border-gray-200 shadow-sm">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#110829] text-white">
                    <th className="text-left px-5 py-3.5 font-semibold rounded-tl-2xl">Plan</th>
                    <th className="px-5 py-3.5 font-semibold text-center">Zyvo</th>
                    <th className="px-5 py-3.5 font-semibold text-center rounded-tr-2xl">Midjourney</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Free tier", "✓ 10 images/month, no card", "✗ No free tier"],
                    ["Entry paid plan", "€12/month — 200 images", "$10/month — 200 images"],
                    ["Background removal", "Included in all plans", "Not available"],
                    ["Ecommerce presets", "Included", "Not available"],
                    ["Web app (no Discord)", "✓", "✗"],
                    ["Commercial licence", "✓ All plans", "✓ Paid plans only"],
                  ].map(([plan, zyvo, mid], i) => (
                    <tr key={plan} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-5 py-3 font-medium text-[#110829]">{plan}</td>
                      <td className="px-5 py-3 text-center text-emerald-600 font-medium">{zyvo}</td>
                      <td className="px-5 py-3 text-center text-[#4A4A55]">{mid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[14px] text-[#4A4A55] leading-relaxed mb-12">
              Zyvo's free plan is genuinely useful for small brands — 10 product images per month with no watermark, no credit card, and commercial usage rights included.
              Midjourney has no free tier in 2026 and requires a paid subscription from day one.
            </p>

            {/* Section — Social media & ecommerce */}
            <h2 id="social-media" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              Social media & ecommerce suitability
            </h2>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-5">
              Both tools can technically produce images for social media — but the workflows are completely different.
              Midjourney requires writing a detailed text prompt, iterating, upscaling, then reformatting for each platform. For a single Instagram post, this process can take 30–60 minutes.
            </p>
            <p className="text-[15px] text-[#4A4A55] leading-relaxed mb-10">
              Zyvo generates platform-ready images directly. Products are output in square (Instagram), portrait (TikTok/Pinterest), and landscape (Facebook ads) formats automatically.
              For brands managing multi-channel social media, Zyvo reduces content production time from hours to minutes.
            </p>

            <div className="bg-[#F0EBFF] rounded-2xl p-6 mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#7A3BFF] mb-4">Zyvo social media & ecommerce features</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Shopify & Amazon optimised output",
                  "Instagram, TikTok, Pinterest formats",
                  "Lifestyle scene generation",
                  "Facebook & Google Ads creatives",
                  "Product-on-model visuals",
                  "Seasonal & campaign variants",
                ].map(feat => (
                  <div key={feat} className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-[#7A3BFF] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[14px] text-[#2D2D35]">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verdict */}
            <h2 id="verdict" className="text-2xl md:text-3xl font-bold text-[#110829] mb-4 scroll-mt-24">
              Verdict: which should you use?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              <div className="bg-white rounded-2xl border-2 border-[#7A3BFF] p-6 shadow-sm relative">
                <div className="absolute -top-3 left-5 bg-[#7A3BFF] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Recommended
                </div>
                <p className="text-xl font-extrabold text-[#7A3BFF] mb-3">Choose Zyvo if…</p>
                <ul className="flex flex-col gap-2">
                  {[
                    "You sell products online",
                    "You create social media content",
                    "You need background removal",
                    "You're not a designer",
                    "You want a free tier to start",
                    "You want ecommerce-ready images",
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2 text-[14px] text-[#2D2D35]">
                      <svg className="w-4 h-4 text-[#7A3BFF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="text-xl font-extrabold text-[#6B7280] mb-3">Choose Midjourney if…</p>
                <ul className="flex flex-col gap-2">
                  {[
                    "You create concept art or illustrations",
                    "You enjoy prompt engineering",
                    "Artistic quality is more important than commercial accuracy",
                    "You don't need background removal",
                    "You're comfortable with Discord",
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2 text-[14px] text-[#4A4A55]">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-12 shadow-sm">
              <p className="text-[15px] text-[#2D2D35] leading-relaxed">
                <strong className="text-[#110829]">Bottom line:</strong> If you're building an ecommerce brand or creating product content for social media, Zyvo is the clear choice.
                It's purpose-built for commercial content, doesn't require design skills, includes background removal, has a genuine free tier, and produces platform-ready outputs out of the box.
                Midjourney is a powerful creative tool — but it's not a product photo generator, and trying to use it as one means working against its design rather than with it.
              </p>
            </div>

            {/* FAQ */}
            <h2 id="faq" className="text-2xl md:text-3xl font-bold text-[#110829] mb-6 scroll-mt-24">
              Frequently asked questions
            </h2>
            <div className="flex flex-col gap-3 mb-12">
              {[
                {
                  q: "Is Zyvo better than Midjourney for product photography?",
                  a: "For commercial product photography, yes. Zyvo is purpose-built for ecommerce and product content — it includes background removal, platform-optimised formats, and consistent framing. Midjourney produces more artistic images but isn't designed for commercial product photography workflows.",
                },
                {
                  q: "Can Midjourney remove backgrounds from product photos?",
                  a: "No. Midjourney is a text-to-image generator and doesn't support background removal or image uploads for editing. You would need a separate tool (like Remove.bg or Photoshop) to remove backgrounds from images generated by Midjourney.",
                },
                {
                  q: "Does Zyvo have a free plan? Does Midjourney?",
                  a: "Zyvo offers 10 free AI image generations per month with no credit card required. Midjourney removed its free tier in 2024 and requires a paid subscription starting at $10/month.",
                },
                {
                  q: "Which AI tool is better for Shopify product photos?",
                  a: "Zyvo is significantly better for Shopify product photos. It produces white-background and lifestyle images in ecommerce-standard formats, handles background removal automatically, and outputs images that meet Shopify's quality guidelines without additional editing.",
                },
                {
                  q: "Can I use Zyvo or Midjourney images for commercial use?",
                  a: "Yes to both on paid plans. Zyvo includes commercial usage rights on all plans including the free tier. Midjourney includes commercial usage rights on paid plans only.",
                },
                {
                  q: "How does Zyvo compare to Midjourney for social media content?",
                  a: "Zyvo is faster and more practical for social media content production. It outputs in platform-specific formats (Instagram square, TikTok portrait, Facebook landscape) and generates product-forward visuals that perform well in ecommerce social media. Midjourney requires more manual work to reformat and is better suited for artistic social content rather than brand product posts.",
                },
              ].map(faq => <FaqItem key={faq.q} {...faq} />)}
            </div>

            {/* CTA */}
            <div className="rounded-2xl overflow-hidden shadow-sm mb-12">
              <div className="bg-gradient-to-br from-[#0E0C15] via-[#1a0d38] to-[#0E0C15] px-8 py-10 text-center">
                <p className="text-[12px] font-bold uppercase tracking-widest text-[#9B6FFF] mb-3">Try for free</p>
                <h3 className="text-white text-2xl font-extrabold mb-3">See why Zyvo beats Midjourney for product photos</h3>
                <p className="text-white/50 text-[14px] mb-7 max-w-sm mx-auto">10 free generations every month. Background removal included. No Discord required.</p>
                <Link
                  to="/workspace/image-generator"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-[15px] transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#7A3BFF,#9D6BFF)", boxShadow: "0 8px 28px rgba(122,59,255,0.45)" }}
                >
                  Generate your first product photo →
                </Link>
                <p className="text-white/25 text-[12px] mt-4">Free plan · No card · No Discord needed</p>
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
