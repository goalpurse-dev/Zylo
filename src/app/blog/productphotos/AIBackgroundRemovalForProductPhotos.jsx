import React from "react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../../../app/blog/RelatedArticles";
import BeforeAfter3 from "../../../assets/blog/productphoto/beforeafter3.png";
import Same2 from "../../../assets/blog/productphoto/same2.png";
import Best from "../../../assets/blog/productphoto/best.png";


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


const TITLE = "AI Background Removal for Product Photos";
const META_DESCRIPTION =
  "Learn how AI background removal improves product photos, increases trust, and helps ecommerce brands create clean visuals without expensive editing.";

export default function AIBackgroundRemovalForProductPhotos() {
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
              Backgrounds can make or break a product photo. AI background
              removal helps brands create clean, professional visuals in minutes.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/home"
                className="px-4 py-2 rounded-full bg-[#7A3BFF] text-white font-medium hover:opacity-90"
              >
                Try AI background removal
              </Link>
              <Link
                to="/workspace/library"
                className="px-4 py-2 rounded-full border border-black/15 text-sm hover:bg-black/5"
              >
                See examples
              </Link>
              <Link
                to="/blog"
                className="px-4 py-2 rounded-full border border-black/15 text-sm hover:bg-black/5"
              >
                Learn how it works
              </Link>
            </div>
          </header>

          {/* Intro */}
          <section className="mb-12">
            <p className="text-black/80 leading-relaxed">
              Customers judge your product before they read a single word.
              Messy, distracting backgrounds reduce trust and make products feel
              unprofessional.
              <br />
              <br />
              AI background removal solves this by isolating your product and
              placing it in clean, consistent environments that convert better.
            </p>
          </section>

          {/* Image Placeholder 1 */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-3">
              Why background removal matters
            </h2>
            <p className="text-black/75 mb-6">
              Removing distractions helps customers focus on the product itself,
              not what’s behind it.
            </p>

            <div className="rounded-2xl border border-dashed border-black/20 bg-white flex items-center justify-center">
           <img src={BeforeAfter3} alt="Before and after AI background removal for product photos" className="max-h-full max-w-full rounded-2xl"/>
            </div>

            <div className="mt-6 flex gap-3">
              <Link to="/home" className="text-[#7A3BFF] font-medium">
                Clean up product photos →
              </Link>
              <Link to="/signup" className="text-[#7A3BFF] font-medium">
                Increase visual clarity →
              </Link>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-3">
              Traditional background removal is slow
            </h2>
            <p className="text-black/75 leading-relaxed mb-4">
              Manual background removal requires editing skills, expensive
              software, and a lot of time.
            </p>
            <p className="text-black/75 leading-relaxed">
              AI automates this process — delivering clean cutouts and natural
              edges in seconds.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/home"
                className="px-4 py-2 rounded-full border border-black/15 text-sm hover:bg-black/5"
              >
                Replace manual editing
              </Link>
              <Link
                to="/home"
                className="px-4 py-2 rounded-full border border-black/15 text-sm hover:bg-black/5"
              >
                Save time & money
              </Link>
            </div>
          </section>

          {/* Image Placeholder 2 */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-3">
              AI creates consistent visuals at scale
            </h2>
            <p className="text-black/75 mb-6">
              With AI, every product can share the same visual style — perfect
              for ecommerce stores and ads.
            </p>

            <div className="rounded-2xl border border-dashed border-black/20 bg-white flex items-center justify-center">
             <img src={Same2} alt=" Same product with different backgrounds after AI background removal" className="max-h-[600px] max-w-full rounded-2xl"/>
            </div>

            <div className="mt-6 flex gap-3">
              <Link to="/home" className="text-[#7A3BFF] font-medium">
                Build consistency →
              </Link>
              <Link to="/signup" className="text-[#7A3BFF] font-medium">
                Scale visuals faster →
              </Link>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-14">
            <h2 className="text-2xl font-semibold mb-3">
              Background removal improves conversions
            </h2>
            <p className="text-black/75 leading-relaxed">
              Clean backgrounds improve focus, perceived quality, and trust —
              all of which increase conversion rates.
            </p>
          </section>

          {/* Image Placeholder 3 */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-3">
              Ready for ads, marketplaces, and social media
            </h2>
            <p className="text-black/75 mb-6">
              Background-removed images can be reused everywhere — from product
              pages to ads and Pinterest pins.
            </p>

            <div className=" rounded-2xl border border-dashed border-black/20 bg-white flex items-center justify-center">
             <img src={Best} alt="Best use cases for AI background removal in product photos" className="max-h-[600px] max-w-full rounded-2xl"/>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/home" className="text-[#7A3BFF] font-medium">
                Use images everywhere →
              </Link>
              <Link to="/home" className="text-[#7A3BFF] font-medium">
                Optimize product listings →
              </Link>
              <Link to="/home" className="text-[#7A3BFF] font-medium">
                Improve ad performance →
              </Link>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-white border border-black/10 rounded-3xl p-10 text-center">
            <h3 className="text-3xl font-bold mb-4">
              Remove backgrounds without editing skills
            </h3>
            <p className="text-black/75 mb-6">
              Zyvo lets you remove backgrounds and generate clean, professional
              product photos in minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/home"
                className="px-8 py-3 rounded-full bg-[#7A3BFF] text-white font-semibold hover:opacity-90"
              >
                Try Zyvo
              </Link>
              <Link
                to="/workspace/library"
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
