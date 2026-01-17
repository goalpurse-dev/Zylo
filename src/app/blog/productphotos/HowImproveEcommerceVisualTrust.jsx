import React from "react";
import Example1 from "../../../assets/blog/productphoto/example1.png";
import Example2 from "../../../assets/blog/productphoto/example2.png";
import Example3 from "../../../assets/blog/productphoto/example3.png";

import { Link } from "react-router-dom";

import RelatedArticles from "../../../app/blog/RelatedArticles";

const related = [
  {
    title: "Shopify Product Photo Best Practices",
    description: "Learn how AI product photos improve Shopify conversions",
    date: "10.01.2026",
    slug: "/blog/shopify-product-photo-best-practices",
  },
  {
    title: "AI Product Photography for Ecommerce",
    description: "How brands replace studios with AI",
    date: "08.01.2026",
    slug: "/blog/ai-product-photography-ecommerce",
  },
  {
    title: "Best AI Product Backgrounds to use",
    description: "Backgrounds that increase trust & sales",
    date: "05.01.2026",
    slug: "/blog/best-ai-product-backgrounds-to-use",
  },
];




export default function BlogImproveEcommerceVisualTrust() {
  const TITLE = "How to Improve Ecommerce Visual Trust";
  const TARGET_KEYWORD = "ecommerce visual trust";
  const META_DESCRIPTION =
    "Learn how to build ecommerce visual trust with better product photos, consistent backgrounds, real-life proof, and simple design upgrades that increase conversions.";

  const tips = [
    {
      title: "Use clean, consistent product photos",
      body: "Consistency is trust. Keep angles, lighting, and framing similar across your listings so your store feels professional (not random).",
    },
    {
      title: "Make backgrounds feel realistic",
      body: "Shadows, reflections, and lighting direction should match the scene. If a background looks fake, buyers feel uncertainty—even if the product is real.",
    },
    {
      title: "Show “in-use” context (lifestyle)",
      body: "A pure white studio photo is great, but adding 1–2 lifestyle shots increases confidence because people can imagine the product in their life.",
    },
    {
      title: "Add proof: reviews, UGC, and close-ups",
      body: "Trust skyrockets when buyers see real details. Show texture, stitching, buttons, ports—anything that proves quality.",
    },
    {
      title: "Reduce confusion with simple design",
      body: "Trust drops when pages look cluttered. Use clear spacing, simple typography, and strong hierarchy: product → benefits → proof → CTA.",
    },
    {
      title: "Make your visuals match your brand",
      body: "Use a consistent color palette and vibe across images. A cohesive identity feels premium and memorable.",
    },
  ];

  return (
    <article className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-black/10">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-sm text-black/60">Ecommerce • Visuals</p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#110829]">
            {TITLE}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-black/70">
            {META_DESCRIPTION}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#checklist"
              className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
            >
              Quick checklist
            </a>
            <a
              href="#examples"
              className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
            >
              Examples
            </a>
            <Link
             to="/home"
              className="rounded-full bg-[#7A3BFF] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Upgrade your visuals
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Intro card */}
        <section className="rounded-2xl border border-black/10 bg-[#F7F5FA] p-5">
          <p className="text-sm font-semibold text-[#110829]">
            One simple rule:
          </p>
          <p className="mt-2 text-base leading-relaxed text-black/70">
            If your visuals look uncertain, buyers feel uncertain.{" "}
            <span className="font-medium text-[#110829]">
              Trust is built before they even read your copy.
            </span>
          </p>
        </section>

        {/* Image placeholder 1 */}
        <section id="examples" className="mt-10">
          <h2 className="text-2xl font-semibold text-[#110829]">
            Visual Trust Comes From These 3 Signals
          </h2>
          <p className="mt-3 text-base leading-relaxed text-black/70">
            Most buyers decide in seconds. They scan for quality, consistency,
            and proof. If any of those feel missing, the sale gets harder.
          </p>

          <div className="mt-6 h-[500px]  w-full rounded-2xl border border-dashed border-black/20 flex items-center justify-center">
        <img src={Example1} alt="Example 1" className="max-h-full max-w-full" />
          </div>
        </section>

        {/* Tips list */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            6 Ways to Improve Ecommerce Visual Trust
          </h2>

          <div className="mt-6 space-y-4">
            {tips.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl border border-black/10 p-5"
              >
                <p className="text-base font-semibold text-[#110829]">
                  {t.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-black/70">
                  {t.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Image placeholder 2 */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            Make Backgrounds Feel Believable
          </h2>
          <p className="mt-3 text-base leading-relaxed text-black/70">
            The fastest way to lose trust is when a background looks “AI-fake.”
            The fix is simple: match the lighting, keep props minimal, and use
            soft shadows.
          </p>

          <div className="mt-6 h-[500px] w-full rounded-2xl border border-dashed border-black/20 flex items-center justify-center">
        <img src={Example3} alt="Example 2" className="max-h-full max-w-full" />
          </div>
        </section>

        {/* Checklist */}
        <section id="checklist" className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            Quick Checklist for {TARGET_KEYWORD}
          </h2>

          <ul className="mt-6 space-y-3">
            {[
              "Photos are sharp, bright, and consistent across products.",
              "Backgrounds look realistic (lighting + shadows match).",
              "You show at least one lifestyle or in-use image per product.",
              "You include close-ups that prove quality and texture.",
              "Your page layout is clean: benefits → proof → CTA.",
              "Your visuals follow one brand vibe (colors + style).",
            ].map((item) => (
              <li
                key={item}
                className="flex gap-3 rounded-xl border border-black/10 p-4"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#F7F5FA] text-[#110829]">
                  ✓
                </span>
                <p className="text-sm leading-relaxed text-black/70">{item}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Image placeholder 3 */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            Add Proof Where It Matters Most
          </h2>
          <p className="mt-3 text-base leading-relaxed text-black/70">
            The best visual trust booster is proof: reviews, UGC, and real
            close-ups. If you can show “real people + real detail,” conversions
            follow.
          </p>

          <div className="mt-6 h-[500px] w-full rounded-2xl border border-dashed border-black/20 flex items-center justify-center">
        <img src={Example2} alt="Example 3" className="max-h-full max-w-full" />
          </div>
        </section>

        {/* CTA */}
        <section
          id="cta"
          className="mt-14 rounded-3xl bg-[#110829] p-8 text-white"
        >
          <h3 className="text-2xl font-semibold">
            Want your product visuals to look instantly more trustworthy?
          </h3>
          <p className="mt-3 text-white/80 leading-relaxed">
            Upload a product photo and generate clean, realistic backgrounds and
            studio-quality visuals in minutes—without expensive shoots.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-2xl bg-[#7A3BFF] px-6 py-3 text-base font-semibold hover:opacity-90"
            >
              Try Zyvo visual upgrades →
            </Link>
            <Link
              to="/workspace/pricing"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 text-base font-semibold hover:bg-white/10"
            >
              View pricing
            </Link>
          </div>

          <p className="mt-4 text-xs text-white/60">
            Tip: add this CTA to every blog post to turn traffic into signups.
          </p>
        </section>
      </main>

      <footer className="border-t border-black/10">
        <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-black/60">
          © {new Date().getFullYear()} Zyvo • Build trust with better visuals.
        </div>

            <div className="mb-10">
        <RelatedArticles articles={related} />

        </div>
      </footer>
    </article>
  );
}
