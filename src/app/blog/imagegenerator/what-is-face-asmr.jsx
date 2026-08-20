import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Why Face ASMR Videos Go Viral on TikTok in 2026",
    description: "The psychology behind ASMR virality and the face recognition scroll-stop.",
    date: "24.05.2026",
    slug: "/blog/viral-face-asmr-videos",
  },
  {
    title: "Best ASMR Video Ideas for TikTok in 2026 (That Actually Go Viral)",
    description: "The 10 ASMR video concepts generating the most views, with execution tips for each.",
    date: "25.05.2026",
    slug: "/blog/asmr-video-ideas-tiktok-2026",
  },
  {
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
];

const FAQS = [
  {
    q: "What is Face ASMR?",
    a: "Face ASMR is an AI video format that transforms an uploaded face photo into a surreal, glossy texture material — like semi-transparent slime — and turns it into a satisfying, ASMR-style short video.",
  },
  {
    q: "Whose photo can I use?",
    a: "You upload your own photo, and Zyvo transforms it into the texture material. It's designed for using your own likeness, not someone else's.",
  },
  {
    q: "What makes it 'ASMR'?",
    a: "The satisfying-texture visual style — glossy, gooey, smooth surfaces reacting to implied touch — is the same visual language that drives traditional ASMR slime and texture content, applied to a face-shaped subject instead of a generic object.",
  },
  {
    q: "Do I need any editing experience?",
    a: "No — you upload a photo and Zyvo handles the texture transformation. No editing or design software is required for the core workflow.",
  },
];

export default function WhatIsFaceAsmr() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>What Is Face ASMR</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What Is Face ASMR? The AI Trend Turning Any Face Into a Satisfying Texture
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            One of the fastest-growing satisfying-content formats on TikTok takes a face and turns it into glossy, gooey, ASMR-ready texture. Here's exactly what it is and how to make your own.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 20, 2026 · 5 min read · Complete Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-face-asmr-hero.png"
              alt="An abstract glossy translucent slime sculpture shaped like a smooth featureless head silhouette"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/face-asmr-texture-closeup.png"
              alt="An extreme close-up of glossy translucent slime texture with soft light reflections"
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The short answer</h2>
            <p className="text-[17px] leading-relaxed">
              Face ASMR takes a face — yours, from an uploaded photo — and reimagines it as a glossy, semi-transparent texture material, styled the same way traditional ASMR slime and texture content is shot: soft light, smooth reflections, a satisfying surface. The result is a short, visually satisfying video built around a face shape that stays recognizable even in fully surreal material.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why it works</h2>
            <p className="text-[17px] leading-relaxed">
              Traditional ASMR texture content already has a huge, dedicated audience drawn to satisfying visuals — slime, soap cutting, kinetic sand. Face ASMR borrows that entire visual language and adds a second hook: recognition. Viewers aren't just watching a satisfying texture, they're watching a specific, familiar face rendered as one, which is a much stronger scroll-stop than a generic object.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How to get a strong result</h2>
            <p className="text-[17px] leading-relaxed">
              Start with a clear, well-lit, front-facing photo — the cleaner the source image, the more recognizable the final texture transformation stays. Good lighting in the original photo carries through into how the glossy material catches light in the final result.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try It Yourself</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Upload a photo and generate your first Face ASMR video in{" "}
              <Link to="/face-asmr-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's Face ASMR tool</Link>. For posting strategy, see{" "}
              <Link to="/blog/viral-face-asmr-videos" className="text-[#7A3BFF] hover:underline font-semibold">why Face ASMR videos go viral</Link>.
            </p>
            <Link
              to="/face-asmr-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Face ASMR →
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
