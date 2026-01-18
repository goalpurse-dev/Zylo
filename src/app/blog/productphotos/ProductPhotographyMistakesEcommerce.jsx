import React from "react";
import Footer from "../../../components/workspace/footer.jsx";
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

const TITLE = "Product Photography Mistakes Ecommerce Brands Make";
const META_DESCRIPTION =
  "Discover the most common product photography mistakes ecommerce brands make and learn how to fix them to increase trust and conversions.";

export default function ProductPhotographyMistakesEcommerce() {
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
              Even great products fail when visuals don’t build trust. Here are
              the most common product photography mistakes ecommerce brands make
              — and how to fix them.
            </p>
          </header>

          {/* Intro */}
          <section className="mb-10">
            <p className="text-black/80 leading-relaxed">
              Customers can’t touch your product. They can’t feel the quality.
              They rely entirely on how your product looks.
              <br />
              <br />
              Poor visuals create hesitation. Strong visuals build trust — and
              trust drives conversions.
            </p>
          </section>

          {/* Mistake 1 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-3">
              1. Low-quality or blurry images
            </h2>
            <p className="text-black/75 leading-relaxed">
              Blurry or compressed images instantly signal low quality. If users
              can’t clearly see details, they assume the product itself is
              flawed.
            </p>
          </section>

          {/* Mistake 2 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-3">
              2. Inconsistent backgrounds
            </h2>
            <p className="text-black/75 leading-relaxed">
              Mixing different backgrounds, lighting styles, and angles across
              products makes your store feel unprofessional. Consistency builds
              credibility.
            </p>
          </section>

          {/* Mistake 3 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-3">
              3. No lifestyle or context images
            </h2>
            <p className="text-black/75 leading-relaxed">
              Customers want to imagine your product in their life. Without
              context, they’re forced to guess — and guessing kills conversions.
            </p>
          </section>

          {/* Mistake 4 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-3">
              4. Poor lighting
            </h2>
            <p className="text-black/75 leading-relaxed">
              Bad lighting can make even premium products look cheap. Soft,
              balanced lighting instantly increases perceived value.
            </p>
          </section>

          {/* Mistake 5 */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-3">
              5. Relying only on traditional photography
            </h2>
            <p className="text-black/75 leading-relaxed">
              Photoshoots are expensive, slow, and hard to scale. Many brands
              struggle to keep visuals fresh for ads, launches, and seasonal
              campaigns.
            </p>
          </section>

          {/* Solution Box */}
          <section className="bg-white border border-black/10 rounded-2xl p-8 mb-16">
            <h2 className="text-3xl font-bold mb-4">
              How ecommerce brands fix this
            </h2>
            <p className="text-black/80 leading-relaxed mb-4">
              Modern ecommerce brands use AI-powered product photography to
              maintain quality, consistency, and speed — without expensive
              shoots.
            </p>
            <ul className="list-disc list-inside text-black/75 space-y-2">
              <li>Consistent studio-quality visuals</li>
              <li>Clean, realistic backgrounds</li>
              <li>Fast image creation for ads & stores</li>
              <li>Lower costs, higher conversions</li>
            </ul>
          </section>

          {/* CTA */}
          <section className="text-center">
            <h3 className="text-2xl font-semibold mb-4">
              Want better product photos without a photoshoot?
            </h3>
            <p className="text-black/75 mb-6">
              Zyvo helps ecommerce brands generate clean, high-converting product
              visuals in minutes.
            </p>
            <a
              href="/home"
              className="inline-block bg-[#7A3BFF] hover:opacity-90 transition px-8 py-3 rounded-full font-semibold text-white"
            >
              Try Zyvo
            </a>
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
