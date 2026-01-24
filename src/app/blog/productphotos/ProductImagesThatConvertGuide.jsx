import { useEffect } from "react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../../../app/blog/RelatedArticles";
import Good from "../../../assets/blog/productphoto/example3.png";
import RealCase from "../../../assets/blog/productphoto/realcase.png";
import Example1 from "../../../assets/blog/productphoto/example2.png";


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

export default function ProductImagesThatConvertCompleteGuide() {
  useEffect(() => {
    const title =
      "Product Images That Convert: A Complete Guide | Zyvo";
    const description =
      "Learn how to create product images that convert. This complete guide covers image types, psychology, layout, and best practices to increase clicks, trust, and sales.";

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
      "https://www.tryzyvo.com/blog/product-images-that-convert-complete-guide";
  }, []);

  return (
    <div style={{ backgroundColor: "#F7F5FA" }} className="min-h-screen">
      <article className="max-w-4xl mx-auto px-6 py-20 text-gray-800">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6">
          <Link to="/home" className="hover:underline">Home</Link> &nbsp;›&nbsp;
          <Link to="/home" className="hover:underline">Blog</Link> &nbsp;›&nbsp;
          <span className="text-gray-700">
            Product Images That Convert
          </span>
        </nav>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
          Product Images That Convert: A Complete Guide
        </h1>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <span>Last updated</span>
          <span>•</span>
          <span>Dec 2025</span>
        </div>

        {/* Intro */}
        <p className="text-lg mb-6">
          Product images are the single most important element on any ecommerce
          page. Before customers read your copy, compare prices, or check reviews,
          they decide whether to trust your product based on how it looks.
        </p>

        <p className="mb-10">
          This complete guide breaks down exactly what makes product images
          convert — from image types and visual psychology to layout, consistency,
          and scalable workflows used by high-performing brands.
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
            What makes product images convert
          </h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Clear hero images that explain the product instantly</li>
            <li>Multiple angles and close-ups to reduce uncertainty</li>
            <li>Lifestyle scenes that show real-world use</li>
            <li>Consistent visuals that build trust</li>
          </ol>
        </div>

        {/* Section */}
        <h2 className="text-3xl font-semibold mb-4">
          Why product images matter more than copy
        </h2>
        <p className="mb-6">
          Humans process visuals faster than text. On ecommerce sites, shoppers
          scan images first and only read descriptions if visuals meet their
          expectations.
        </p>
        <p className="mb-10">
          High-converting stores invest heavily in visual clarity. Their images
          answer questions before customers even think to ask them.
        </p>

        {/* Section */}
        <h2 className="text-3xl font-semibold mb-4">
          The essential image types every product needs
        </h2>
        <ul className="list-disc list-inside mb-12 space-y-2">
          <li><strong>Hero image:</strong> clean, centered, crystal clear</li>
          <li><strong>Angle shots:</strong> front, side, and back</li>
          <li><strong>Detail shots:</strong> texture, materials, features</li>
          <li><strong>Scale reference:</strong> show real-world size</li>
          <li><strong>Lifestyle images:</strong> product in use</li>
        </ul>

          {/* Image placeholder 2 */}
                  <div className="grid grid-cols-2"> 
                                    <img className=" max-h-[600px] bg-gray-300 rounded-xl mb-12 flex items-center justify-center text-gray-600" src={Good} alt="Good Product Image Example">
                                      </img>
                                        <img className=" max-h-[600px] bg-gray-300 rounded-xl mb-12 flex items-center justify-center text-gray-600" src={Example1} alt="Good Product Image Example">
                                      </img>
                                    </div>

        {/* Section */}
        <h2 className="text-3xl font-semibold mb-4">
          How visual consistency increases conversion rates
        </h2>
        <p className="mb-6">
          Consistency reduces friction. When all product images follow the same
          lighting, framing, and style rules, shoppers feel more confident
          browsing and comparing products.
        </p>
        <p className="mb-10">
          This is why brands with consistent visuals often see lower bounce rates
          and higher add-to-cart percentages.
        </p>

        {/* Section */}
        <h2 className="text-3xl font-semibold mb-4">
          Common product image mistakes that kill conversions
        </h2>
        <ul className="list-disc list-inside mb-12 space-y-2">
          <li>Blurry or low-resolution images</li>
          <li>Inconsistent lighting and backgrounds</li>
          <li>Generic supplier or stock photos</li>
          <li>Too few images to build confidence</li>
          <li>Images that don’t match the product description</li>
        </ul>

        {/* Section */}
        <h2 className="text-3xl font-semibold mb-4">
          Scaling product images without photoshoots
        </h2>
        <p className="mb-6">
          Modern ecommerce brands scale visuals by building repeatable systems.
          Instead of shooting every variation, they reuse templates, backgrounds,
          and styles across products.
        </p>
        <p className="mb-12">
          This approach makes it easier to test creatives, launch faster, and
          maintain visual quality across Shopify, ads, and social channels using{" "}
          <Link to="/home" className="text-purple-600 underline">
            AI-powered product photography
          </Link>.
        </p>

        {/* CTA */}
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100">
          <h3 className="text-2xl font-bold mb-4">
            Want product images that actually convert?
          </h3>
          <p className="text-gray-700 mb-6">
            Create clean, consistent product visuals that increase trust,
            engagement, and sales — without expensive photoshoots.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/home"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-white font-semibold bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] hover:opacity-90 transition"
            >
              Try Zyvo Product Photos
            </Link>
            <Link
              to="/home"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white border border-gray-200 text-gray-800 hover:opacity-90 transition"
            >
              Explore Image Examples
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
