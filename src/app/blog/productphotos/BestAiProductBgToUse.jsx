import React from "react";
import { Link } from "react-router-dom";
import BeforeAfter3 from "../../../assets/blog/productphoto/beforeafter3.png";
import Good2 from "../../../assets/blog/productphoto/good.2.png";
import BgExample from "../../../assets/blog/productphoto/bgexample.png";
import BeforeAfter2 from "../../../assets/blog/productphoto/beforeafter2.png";
import Studio1 from "../../../assets/bg/studio/1.png"
import Bg2 from "../../../assets/blog/productphoto/bg2.png";
import Outdoor from "../../../assets/bg/outdoor/1.png"
import Lifestyle from "../../../assets/bg/workspace/1.png"




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
    title: "How to Create Clean Product Backgrounds",
    description: "Backgrounds that increase trust & sales",
    date: "05.01.2026",
    slug: "/blog/clean-product-backgrounds",
  },
];
export default function BlogBestAIProductBackgrounds() {
  const TITLE = "Best AI Product Backgrounds to Use";
  const TARGET_KEYWORD = "AI product backgrounds";
  const META_DESCRIPTION =
    "Discover the best AI product backgrounds to boost conversions—from clean studio looks to lifestyle scenes—with examples, tips, and a ready-to-use checklist.";

  const bgIdeas = [
    {
      name: "Clean Studio (White)",
      why: "Best for ecommerce + marketplaces. Looks premium and trustworthy.",
      bestFor: "Shopify, Amazon, Etsy listings",
    },
    {
      name: "Soft Gradient",
      why: "Adds depth without distraction. Great for modern brands.",
      bestFor: "Landing pages, hero sections",
    },
    {
      name: "Lifestyle Scene",
      why: "Shows context and vibe. Makes products feel “real.”",
      bestFor: "Ads, social posts, product drops",
    },
    {
      name: "Texture Backdrop",
      why: "Concrete, linen, marble… gives a high-end editorial feel.",
      bestFor: "Skincare, fragrance, jewelry",
    },
    {
      name: "Seasonal Theme",
      why: "Instant relevance (summer, Christmas, etc.) = higher engagement.",
      bestFor: "Campaigns + promos",
    },
    {
      name: "Brand Color Set",
      why: "Builds identity and consistency across your store.",
      bestFor: "Brands scaling content fast",
    },
  ];

  return (
    <article className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-black/10">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-sm text-black/60">Guides</p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#110829]">
            {TITLE}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-black/70">
            {META_DESCRIPTION}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#backgrounds"
              className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
            >
              Background ideas
            </a>
            <a
              href="#examples"
              className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
            >
              Examples
            </a>
            <a
              href="#checklist"
              className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
            >
              Checklist
            </a>
            <a
              href="#cta"
              className="rounded-full bg-[#7A3BFF] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Generate backgrounds
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Hero placeholder */}
        <section className="rounded-2xl border border-black/10 bg-[#F7F5FA] p-5">
          <div className="h-[500px] w-full rounded-xl bg-white/60 flex items-center justify-center">
            <img src={Bg2} alt="AI product background examples" className="max-h-full max-w-full" />
          </div>
          <p className="mt-3 text-sm text-black/60">
            Pro tip: show “same product, 4 different backgrounds” to build trust.
          </p>
        </section>

        {/* Intro */}
        <section className="mt-10">
          <p className="text-lg leading-relaxed text-[#110829]">
            Your background can change how expensive your product feels—without
            changing the product. The best{" "}
            <span className="font-semibold">{TARGET_KEYWORD}</span> are simple,
            realistic, and consistent with your brand.
          </p>

          <div className="mt-6 rounded-2xl border border-black/10 p-5">
            <p className="text-sm font-medium text-black/70">Rule of thumb:</p>
            <p className="mt-2 text-[#110829]">
              If the background competes with the product, it’s too loud.
            </p>
          </div>
        </section>

        {/* Background ideas */}
        <section id="backgrounds" className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            The Best AI Background Types
          </h2>
          <p className="mt-4 text-base leading-relaxed text-black/70">
            Use these based on where your image will live (product page, ads,
            Pinterest, email, etc.). You can rotate them and still keep your
            brand consistent.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {bgIdeas.map((bg) => (
              <div
                key={bg.name}
                className="rounded-2xl border border-black/10 p-5"
              >
                <p className="text-sm font-semibold text-[#110829]">{bg.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-black/70">
                  {bg.why}
                </p>
                <p className="mt-3 text-xs text-black/60">
                  <span className="font-medium">Best for:</span> {bg.bestFor}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/workspace/library"
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              See example layouts →
            </Link>
            <Link
              to="/signup"
              className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
            >
              Generate with Zyvo →
            </Link>
          </div>
        </section>

        {/* Examples */}
        <section id="examples" className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            Example Background Sets (Use These)
          </h2>
          <p className="mt-4 text-base leading-relaxed text-black/70">
            These are background “sets” you can repeat across different products
            to make your store look cohesive.
          </p>

          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-black/10 p-5">
              <p className="text-sm font-semibold text-[#110829]">
                Set A: Minimal Premium
              </p>
              <p className="mt-2 text-sm text-black/70">
                White studio + soft shadow + subtle gradient.
              </p>
              <div className="mt-4 h-[500px] rounded-xl  flex items-center justify-center">
              <img src={Studio1} alt="Studio background example" className="max-h-full max-w-full" />
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-5">
              <p className="text-sm font-semibold text-[#110829]">
                Set B: Lifestyle + Context
              </p>
              <p className="mt-2 text-sm text-black/70">
                Realistic scene that matches the product use-case.
              </p>
              <div className="mt-4 h-[500px] rounded-xl  flex items-center justify-center">
              <img src={Outdoor} alt="Lifestyle background example" className="max-h-full max-w-full" />
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-5">
              <p className="text-sm font-semibold text-[#110829]">
                Set C: Brand Color World
              </p>
              <p className="mt-2 text-sm text-black/70">
                Your brand color as the base + tasteful props.
              </p>
              <div className="mt-4 h-[500px] rounded-xl  flex items-center justify-center">
              <img src={Lifestyle} alt="Lifestyle background example" className="max-h-full max-w-full" />
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-5">
              <p className="text-sm font-semibold text-[#110829]">
                Set D: Seasonal Drop
              </p>
              <p className="mt-2 text-sm text-black/70">
                Holiday / summer / autumn theme for campaigns.
              </p>
              <div className="mt-4 h-[500px] rounded-xl   flex items-center justify-center">
             <img src={BgExample} alt="Lifestyle background example" className="max-h-full max-w-full" />
              </div>
            </div>
          </div>
        </section>

        {/* Checklist */}
        <section id="checklist" className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            Quick Checklist: Pick the Right Background
          </h2>

          <ul className="mt-6 space-y-3">
            {[
              "Does the background match where you’re posting (store vs ads vs Pinterest)?",
              "Is it realistic (lighting + shadows) so it doesn’t feel AI-fake?",
              "Is the product still the clearest thing in the image?",
              "Does it match your brand vibe (minimal, luxury, playful, tech)?",
              "Can you repeat it across 10+ products for consistency?",
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

          <div className="mt-8 rounded-2xl border border-black/10 bg-[#F7F5FA] p-5">
            <p className="text-sm font-semibold text-[#110829]">
              Bonus: 3 backgrounds that almost always work
            </p>
            <p className="mt-2 text-sm text-black/70">
              Clean white • Soft gradient • Realistic lifestyle scene
            </p>
          </div>
        </section>

        {/* CTA */}
        <section
          id="cta"
          className="mt-14 rounded-3xl bg-[#110829] p-8 text-white"
        >
          <h3 className="text-2xl font-semibold">
            Generate AI product backgrounds in minutes
          </h3>
          <p className="mt-3 text-white/80 leading-relaxed">
            Upload your product photo and instantly test multiple background
            styles—studio, lifestyle, brand color, and seasonal—without a
            photoshoot.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
             to="/workspace/library"
              className="inline-flex items-center justify-center rounded-2xl bg-[#7A3BFF] px-6 py-3 text-base font-semibold hover:opacity-90"
            >
              Try backgrounds now →
            </Link>
            <Link
             to="/workspace/pricing"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 text-base font-semibold hover:bg-white/10"
            >
              View pricing
            </Link>
          </div>
          <p className="mt-4 text-xs text-white/60">
            Add an email capture under this CTA for even higher conversions.
          </p>
        </section>
      </main>

      <footer className="border-t border-black/10">
        <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-black/60">
          © {new Date().getFullYear()} Zyvo • {TARGET_KEYWORD} that convert.
        </div>
        <div className="mb-10">
        <RelatedArticles articles={related} /> 
        </div>
      </footer>
    </article>
  );
}
