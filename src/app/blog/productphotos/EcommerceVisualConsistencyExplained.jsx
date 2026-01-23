import { useEffect } from "react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../../../app/blog/RelatedArticles";
import Good from "../../../assets/blog/productphoto/good.png";
import RealCase from "../../../assets/blog/productphoto/realcase.png";
import Example1 from "../../../assets/blog/productphoto/example1.png";


const related = [
  {
    title: "How AI Product Photos Increase Conversion Rates",
    description: "Learn how AI product photos improve conversion rates",
    date: "10.01.2026",
    slug: "/blog/shopify-product-photo-best-practices",
  },
  {
    title: "How AI Product Photos Increase Conversion Rates",
    description: "Learn how AI product photos improve conversion rates",
    date: "08.01.2026",
    slug: "/blog/AI-product-photos-increase-conversion-rates",
  },
  {
    title: "How to Improve Ecommerce Visual Trust",
    description: "Boost sales with better product images",
    date: "05.01.2026",
    slug: "/blog/how-to-improve-ecommerce-visual-trust",
  },
];


export default function EcommerceVisualConsistencyExplained() {
  useEffect(() => {
    const title = "Ecommerce Visual Consistency Explained (With Examples) | Zyvo";
    const description =
      "Ecommerce visual consistency explained: what it is, why it increases trust and conversion rates, and how to keep product photos consistent across Shopify and marketing channels.";

    document.title = title;

    // Meta description
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href =
      "https://www.tryzyvo.com/blog/ecommerce-visual-consistency-explained";
  }, []);

  return (
    <div style={{ backgroundColor: "#F7F5FA" }} className="min-h-screen">
      <article className="max-w-4xl mx-auto px-6 py-20 text-gray-800">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6">
          <Link to="/home" className="hover:underline">
            Home
          </Link>{" "}
          &nbsp;›&nbsp;
          <Link to="/home" className="hover:underline">
            Blog
          </Link>{" "}
          &nbsp;›&nbsp;
          <span className="text-gray-700">Ecommerce Visual Consistency Explained</span>
        </nav>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
          Ecommerce Visual Consistency Explained
        </h1>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <span>Last updated</span>
          <span>•</span>
          <span>Dec 2025</span>
        </div>

        {/* Intro */}
        <p className="text-lg mb-6">
          Visual consistency is one of the most underrated conversion levers in ecommerce.
          When your product images look cohesive across your store, ads, and social channels,
          customers feel more confident — and that confidence leads to more add-to-carts and
          purchases.
        </p>

        <p className="mb-10">
          In this guide, we’ll break down what ecommerce visual consistency actually means,
          why it builds trust, and how to create a repeatable system for consistent product
          photos without slowing down production.
        </p>

        {/* Image placeholder 1 */}
          <img className=" max-h-[600px] bg-gray-300 rounded-xl mb-12 flex items-center justify-center text-gray-600" src={RealCase} alt="Good Product Image Example">
      
              </img>
      

        {/* Summary box */}
        <div className="bg-blue-50 rounded-2xl p-8 mb-14">
          <span className="inline-block mb-3 px-3 py-1 text-sm font-medium bg-white rounded-md border">
            Summary
          </span>
          <h2 className="text-2xl font-semibold mb-4">
            What visual consistency does for ecommerce
          </h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Improves first impressions and perceived product quality</li>
            <li>Builds brand trust and reduces buyer uncertainty</li>
            <li>Makes your storefront feel premium and “intentional”</li>
            <li>Boosts conversion rates by reducing visual friction</li>
          </ol>
        </div>

        {/* Section 1 */}
        <h2 className="text-3xl font-semibold mb-4">What is visual consistency?</h2>
        <p className="mb-6">
          Ecommerce visual consistency means your product photos share the same “rules” across
          your catalog. That includes lighting, framing, background style, shadows, color tone,
          and even spacing in your product grid.
        </p>
        <p className="mb-10">
          When these elements change randomly, your store feels chaotic. When they stay consistent,
          your store feels trustworthy — like a real brand. This is why many stores invest in
          consistent <Link to="/home" className="text-purple-600 underline">product photo templates</Link>{" "}
          and scalable workflows.
        </p>

        {/* Section 2 */}
        <h2 className="text-3xl font-semibold mb-4">
          Why inconsistent visuals increase bounce rate
        </h2>
        <p className="mb-6">
          Visitors make decisions fast. If your images look like they came from different cameras,
          different lighting setups, or different brands altogether, it reduces trust. That often
          causes users to exit before they explore your products.
        </p>
        <p className="mb-10">
          Consistency helps users scan faster, compare products easier, and understand your brand
          instantly — which is why consistent visuals often lower bounce rate and increase session time.
        </p>

        {/* Image placeholder 2 */}

              <div className="grid grid-cols-2"> 
                <img className=" max-h-[600px] bg-gray-300 rounded-xl mb-12 flex items-center justify-center text-gray-600" src={Good} alt="Good Product Image Example">
                  </img>
                    <img className=" max-h-[600px] bg-gray-300 rounded-xl mb-12 flex items-center justify-center text-gray-600" src={Example1} alt="Good Product Image Example">
                  </img>
                </div>

        {/* Section 3 */}
        <h2 className="text-3xl font-semibold mb-4">
          The 6 elements you should keep consistent
        </h2>
        <ul className="list-disc list-inside mb-12 space-y-2">
          <li><strong>Background style:</strong> white/clean, studio, or lifestyle — pick a system</li>
          <li><strong>Lighting:</strong> soft, even, and repeatable</li>
          <li><strong>Framing:</strong> same zoom level and product positioning</li>
          <li><strong>Shadows:</strong> consistent direction and softness</li>
          <li><strong>Color tone:</strong> avoid random warm/cool shifts</li>
          <li><strong>Aspect ratio:</strong> keep one format for your product grid</li>
        </ul>

        {/* Section 4 */}
        <h2 className="text-3xl font-semibold mb-4">
          How to build a repeatable consistency workflow
        </h2>
        <p className="mb-6">
          The fastest way to scale consistent visuals is to define a “visual system” once and reuse it.
          That typically means:
        </p>
        <ol className="list-decimal list-inside mb-12 space-y-2">
          <li>Choose one catalog style (clean studio or lifestyle)</li>
          <li>Create a hero template (framing + background rules)</li>
          <li>Generate 3–6 supporting images per product (angles + details)</li>
          <li>Use the same background library for campaigns and seasonal drops</li>
        </ol>

        <p className="mb-12">
          Tools that help with this include{" "}
          <Link to="/home" className="text-purple-600 underline">
            AI background generation
          </Link>
          ,{" "}
          <Link to="/home" className="text-purple-600 underline">
            product photo editing
          </Link>
          , and reusable creative templates that keep every product looking like it belongs to the same brand.
        </p>

        {/* CTA */}
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100">
          <h3 className="text-2xl font-bold mb-4">
            Want consistent product photos across your entire store?
          </h3>
          <p className="text-gray-700 mb-6">
            Create clean, cohesive product images that match your brand — and scale them faster without
            booking photoshoots.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/home"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-white font-semibold bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] hover:opacity-90 transition"
            >
              Try Zyvo Product Photos
            </Link>
            <Link
              to="/workspace/library"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white border border-gray-200 text-gray-800 hover:opacity-90 transition"
            >
              Explore Background Styles
            </Link>
          </div>
        </div>
      </article>

        <div className="mt-12">
                <RelatedArticles articles={related} />
              </div>

      <Footer />
    </div>
  );
}
