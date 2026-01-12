import { useEffect } from "react";
import { Link } from "react-router-dom";
import Before1 from "../../assets/blog/productphoto/before1.png";
import After1 from "../../assets/blog/productphoto/before2.png";


export default function ProductPhotosForShopify() {

  useEffect(() => {
    document.title = "Product Photos with AI for Shopify | Zyvo";

    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content =
      "Create high-converting product photos with AI for Shopify. Learn how to generate professional product images in minutes using Zyvo.";
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F5FA] text-[#110829]">
      <main className="max-w-4xl mx-auto px-6 py-20">
        {/* Breadcrumb */}
        <p className="text-sm text-gray-500 mb-6">
          <Link to="/" className="hover:underline">
            Home
          </Link>{" "}
          /{" "}
          <Link to="/blog" className="hover:underline">
            Blog
          </Link>{" "}
          / Product Photos with AI for Shopify
        </p>

        <h1 className="text-4xl font-bold mb-6 text-[#7A3BFF]">
          Product Photos with AI for Shopify
        </h1>

        <p className="text-lg mb-8">
          High-quality product photos are one of the biggest conversion drivers
          for Shopify stores. If your images don’t look professional, customers
          won’t trust your brand — no matter how good your product is.
        </p>

        {/* IMAGE PLACEHOLDER 1 */}
        <img src={Before1} className="object-contain w-full h-[280px] bg-white p-3 border-black border border-dashed rounded-xl flex items-center justify-center mb-12">
  
        </img>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          Why Product Photos Matter on Shopify
        </h2>

        <p className="mb-6">
          When visitors land on a Shopify product page, the product image is the
          first thing they notice. Clean visuals increase trust and directly
          improve conversion rates.
        </p>

        <ul className="list-disc pl-6 mb-10">
          <li>Professional images build credibility</li>
          <li>Clean photos increase add-to-cart rate</li>
          <li>Good visuals reduce bounce rate</li>
        </ul>

        {/* IMAGE PLACEHOLDER 2 */}
       <img src={After1} className="object-contain w-full h-[280px] bg-white p-3 border-black border border-dashed rounded-xl flex items-center justify-center mb-12">
  
        </img>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          The Problem with Traditional Product Photography
        </h2>

        <p className="mb-6">
          Traditional product photography is expensive and slow. For most small
          Shopify businesses, organizing photoshoots regularly isn’t scalable.
        </p>

        <ul className="list-disc pl-6 mb-10">
          <li>High cost per shoot</li>
          <li>Long turnaround time</li>
          <li>Hard to update images</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          How to Create Product Photos with AI Using Zyvo
        </h2>

        <ol className="list-decimal pl-6 mb-12">
          <li>Upload your product image</li>
          <li>Select a background or style</li>
          <li>Generate professional photos</li>
          <li>Upload directly to your Shopify store</li>
        </ol>

        {/* CTA */}
        <div className="bg-white border border-[#7A3BFF] rounded-xl p-10 text-center">
          <h3 className="text-2xl font-bold mb-4">
            Create Shopify Product Photos in Minutes
          </h3>
          <p className="mb-6 text-gray-600">
            Generate clean, conversion-focused product photos using AI — without
            photoshoots or designers.
          </p>
          <Link
            to="/"
            className="inline-block bg-[#7A3BFF] text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition"
          >
            Try Zyvo Free
          </Link>
        </div>
      </main>
    </div>
  );
}
