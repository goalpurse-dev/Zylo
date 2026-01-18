import React from "react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../../../app/blog/RelatedArticles";
import Good2 from "../../../assets/blog/productphoto/good.2.png";
import BeforeAfter3 from "../../../assets/blog/productphoto/beforeafter3.png";
import Same from "../../../assets/blog/productphoto/same.png";




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
    title: "Product Photography Mistakes Ecommerce Brands Make",
    description: "Mistakes that kill conversions & how to fix them",
    date: "05.01.2026",
    slug: "/blog/product-photography-mistakes-ecommerce-brands-make",
  },
];

const TITLE = "How Visual Branding Impacts Online Sales";
const META_DESCRIPTION =
  "Learn how strong visual branding increases trust, conversions, and online sales — and how ecommerce brands can improve it with better visuals.";

export default function HowVisualBrandingImpactsOnlineSales() {
  return (
    <>
      <main className="min-h-screen bg-[#F7F5FA]">
        <article className="max-w-4xl mx-auto px-6 py-16 text-[#110829]">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {TITLE}
            </h1>
            <p className="text-lg text-black/70">
              Visual branding isn’t just design — it directly affects how much
              people trust you, remember you, and buy from you.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="px-4 py-2 rounded-full bg-[#7A3BFF] text-white font-medium hover:opacity-90"
              >
                Improve your visuals
              </Link>
              <Link
                to="/workspace/library"
                className="px-4 py-2 rounded-full border border-black/15 text-sm hover:bg-black/5"
              >
                See examples
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 rounded-full border border-black/15 text-sm hover:bg-black/5"
              >
                Learn branding basics
              </Link>
            </div>
          </header>

          {/* Intro */}
          <section className="mb-12">
            <p className="text-black/80 leading-relaxed">
              People decide whether to trust your brand in seconds. Before they
              read your copy or compare prices, they judge how your brand looks.
              <br />
              <br />
              Strong visual branding creates confidence. Weak visuals create
              hesitation — and hesitation kills sales.
            </p>
          </section>

          {/* Image Placeholder 1 */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-3">
              First impressions drive buying decisions
            </h2>
            <p className="text-black/75 mb-6">
              Clean visuals, consistent colors, and professional imagery tell
              customers your brand is reliable and worth their money.
            </p>

            <div className="h-[600px] rounded-2xl border border-dashed border-black/20 bg-white flex items-center justify-center">
             <img src={Good2} alt="Good Example" className="max-h-full max-w-full rounded-2xl" />
            </div>

            <div className="mt-6 flex gap-3">
              <Link to="/signup" className="text-[#7A3BFF] font-medium">
                Fix your first impression →
              </Link>
              <Link to="/workspace/library" className="text-[#492399] font-medium">
                See branding examples →
              </Link>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-3">
              Visual consistency builds trust
            </h2>
            <p className="text-black/75 leading-relaxed mb-4">
              When product images, backgrounds, and layouts feel disconnected,
              customers subconsciously feel something is off.
            </p>
            <p className="text-black/75 leading-relaxed">
              Consistent visuals make your brand feel established — even if
              you’re just starting.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/home"
                className="px-4 py-2 rounded-full border border-black/15 text-sm hover:bg-black/5"
              >
                Create consistent visuals
              </Link>
              <Link
                to="/home"
                className="px-4 py-2 rounded-full border border-black/15 text-sm hover:bg-black/5"
              >
                Build brand trust
              </Link>
            </div>
          </section>

          {/* Image Placeholder 2 */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-3">
              Product visuals influence perceived value
            </h2>
            <p className="text-black/75 mb-6">
              The same product can feel cheap or premium depending on lighting,
              background, and composition.
            </p>

            <div className=" rounded-2xl border border-dashed border-black/20 bg-white flex items-center justify-center">
            <img src={BeforeAfter3} alt="Before and After Example" className="max-h-full max-w-full rounded-2xl" />
            </div>

            <div className="mt-6 flex gap-3">
              <Link to="/signup" className="text-[#7A3BFF] font-medium">
                Increase perceived value →
              </Link>
              <Link to="/workspace/productphoto  " className="text-[#7A3BFF] font-medium">
                Upgrade product photos →
              </Link>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-3">
              Visual branding reduces buying friction
            </h2>
            <p className="text-black/75 leading-relaxed">
              When your visuals are clear, professional, and on-brand,
              customers spend less time questioning and more time buying.
            </p>
          </section>

          {/* Image Placeholder 3 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-3">
              Strong brands look recognizable everywhere
            </h2>
            <p className="text-black/75 mb-6">
              From product pages to ads and social media, recognizable visuals
              compound brand value over time.
            </p>

            <div className="rounded-2xl border border-dashed border-black/20 bg-white flex items-center justify-center">
              <img src={Same} alt="Same Example" className="max-h-full max-w-full rounded-2xl" />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/home" className="text-[#7A3BFF] font-medium">
                Make your brand recognizable →
              </Link>
              <Link to="/workspace/library" className="text-[#7A3BFF] font-medium">
                See visual branding tools →
              </Link>
              <Link to="/workspace/productphoto" className="text-[#7A3BFF] font-medium">
                Start building your brand →
              </Link>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-white border border-black/10 rounded-3xl p-10 text-center">
            <h3 className="text-3xl font-bold mb-4">
              Want visuals that actually increase sales?
            </h3>
            <p className="text-black/75 mb-6">
              Zyvo helps brands create consistent, high-quality product visuals
              that build trust and convert better.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/home"
                className="px-8 py-3 rounded-full bg-[#7A3BFF] text-white font-semibold hover:opacity-90"
              >
                Try Zyvo
              </Link>
              <Link
                to="/home"
                className="px-8 py-3 rounded-full border border-black/15 font-semibold hover:bg-black/5"
              >
                View examples
              </Link>
            </div>

          </section>
            <div className="mt-20"> 
                  <RelatedArticles articles={related} />
            </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
