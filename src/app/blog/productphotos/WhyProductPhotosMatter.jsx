import React from "react";
import { Link } from "react-router-dom";
import BeforeAfter3 from "../../../assets/blog/productphoto/beforeafter3.png";
import Good2 from "../../../assets/blog/productphoto/good.2.png";
import BgExample from "../../../assets/blog/productphoto/bgexample.png";
import BeforeAfter2 from "../../../assets/blog/productphoto/beforeafter2.png";
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



export default function BlogPost() {
  const TITLE = "How AI Product Photos Increase Conversion Rates";
  const TARGET_KEYWORD = "AI product photos";
  const META_DESCRIPTION =
    "Learn how AI product photos boost trust, improve click-throughs, and increase conversion rates with studio-quality visuals—without expensive shoots.";

  return (
    <article className="min-h-screen bg-white">
      {/* SEO (optional display) */}
      <header className="border-b border-black/10">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-sm text-black/60">Blog</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#110829]">
            {TITLE}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-black/70">
            {META_DESCRIPTION}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#why"
              className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
            >
              Why images matter
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
              Try it for free
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Hero image placeholder */}
        <section className="rounded-2xl border border-black/10 bg-[#F7F5FA] p-5">
          <div className="aspect-[16/9] w-full rounded-xl border border-dashed border-black/20 bg-white/60 flex items-center justify-center">
           <img src={BeforeAfter3} alt="Before and after AI product photo example" className="max-h-full max-w-full" />
         
          </div>
          <p className="mt-3 text-sm text-black/60">
            Tip: Use a slider or a bold before/after visual here.
          </p>
        </section>

        {/* Intro */}
        <section className="mt-10">
          <p className="text-lg leading-relaxed text-[#110829]">
            Most brands think ads are the main growth lever — but in reality,
            your{" "}
            <span className="font-semibold">
              product image is your ad’s landing page
            </span>
            . If the photo looks cheap, the buyer hesitates. If it looks premium,
            buyers trust you faster.
          </p>

          <div className="mt-6 rounded-2xl border border-black/10 p-5">
            <p className="text-sm font-medium text-black/70">
              Quick takeaway:
            </p>
            <p className="mt-2 text-[#110829]">
              Ads can get the click.{" "}
              <span className="font-semibold">
                {TARGET_KEYWORD}
              </span>{" "}
              can get the conversion.
            </p>
          </div>
        </section>

        {/* Why section */}
        <section id="why" className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            Why Product Images Matter More Than Ads
          </h2>
          <p className="mt-4 text-base leading-relaxed text-black/70">
            Ads are a doorway. Your product images are the room people step
            into. When the visuals feel high-end, shoppers assume the product is
            high-end — and they feel safe buying.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Trust",
                desc: "Studio-like visuals signal credibility instantly.",
              },
              {
                title: "Clarity",
                desc: "Customers understand the product faster.",
              },
              {
                title: "Conversion",
                desc: "Less doubt = fewer drop-offs at checkout.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-black/10 p-4"
              >
                <p className="text-sm font-semibold text-[#110829]">
                  {c.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-black/70">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Examples with placeholders */}
        <section id="examples" className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            What “High-Converting” Looks Like
          </h2>
          <p className="mt-4 text-base leading-relaxed text-black/70">
            A high-converting product photo is clean, realistic, well-lit, and
            consistent with your brand.{" "}
            <span className="font-medium text-[#110829]">
              AI product photos
            </span>{" "}
            can create that look in minutes.
          </p>

          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-black/10 p-5">
              <div className="h-[600px] rounded-xl border border-dashed border-black/20 bg-[#F7F5FA] flex items-center justify-center">
              
                 <img src={Good2} alt="High converting AI product photo example" className="max-h-full max-w-full" />
               
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                  See more examples
                </button>
                <a
                  href="#checklist"
                  className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
                >
                  Jump to checklist →
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-5">
              <div className="aspect-[16/9] rounded-xl border border-dashed border-black/20 bg-[#F7F5FA] flex items-center justify-center">
                <img src={BgExample} alt="Lifestyle background example" className="max-h-full max-w-full" />    
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link className="rounded-full bg-[#7A3BFF] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  to="/workspace/productphotos"
                >
                    
                  Generate a lifestyle shot
                </Link>
                <Link
                 to="/signup"
                  className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
                >
                  Get the template →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 p-5">
              <div className="aspect-[16/9] rounded-xl border border-dashed border-black/20 bg-[#F7F5FA] flex items-center justify-center">
                <img src={BeforeAfter2} alt="Before and after AI product photo example" className="max-h-full max-w-full" />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/workspace/productphoto" 
                  
                  className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Turn my photo into studio quality
                </Link>
                <a
                  href="#"
                  className="rounded-full border border-black/15 px-4 py-2 text-sm text-[#110829] hover:bg-black/5"
                >
                  Read: best backgrounds →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Checklist */}
        <section id="checklist" className="mt-12">
          <h2 className="text-2xl font-semibold text-[#110829]">
            Conversion Checklist (Steal This)
          </h2>
          <p className="mt-4 text-base leading-relaxed text-black/70">
            Use this quick checklist to spot what’s holding your product photos
            back — and what to improve first.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "Is the product sharp and clearly visible?",
              "Is the background clean or intentional (not distracting)?",
              "Is lighting even with soft, realistic shadows?",
              "Does the photo match your brand vibe (premium, playful, minimal)?",
              "Would you personally trust this photo enough to buy?",
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

        {/* CTA */}
        <section
          id="cta"
          className="mt-14 rounded-3xl bg-[#F7F5FA] border-black border p-8 text-white"
        >
          <h3 className="text-2xl font-semibold text-[#110829]">
            Ready to upgrade your product photos?
          </h3>
          <p className="mt-3 text-[#110829] leading-relaxed">
            Upload one product photo and get studio-quality results with clean
            backgrounds in minutes — perfect for ecommerce, ads, and landing
            pages.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
             to="/workspace/productphoto"
              className="inline-flex items-center justify-center rounded-2xl bg-[#7A3BFF] px-6 py-3 text-base font-semibold hover:opacity-90"
            >
              Generate my product photos →
            </Link>
            <Link
             to="/workspace/pricing"
              className=" bg-white text-[#110829]   inline-flex items-center justify-center rounded-2xl border border-black px-6 py-3 text-base font-semibold hover:bg-white/10"
            >
              View pricing
            </Link>
          </div>

          <p className="mt-4 text-xs text-white/60">
            Tip: Place an email capture or “Try free” button directly under this
            section.
          </p>
        </section>
      </main>

      <footer className="border-t border-black/10">
        <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-black/60">
          © {new Date().getFullYear()} Zyvo • Built for brands that want better
          product photos.
        </div>
        <div className="mb-10">
        <RelatedArticles articles={related} />
        
        </div>

            
      </footer >
    </article>
  );
}
