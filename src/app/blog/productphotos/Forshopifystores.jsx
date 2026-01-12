import { useEffect } from "react";
import Library from "../../../assets/blog/productphoto/library.png";
import Before1 from "../../../assets/blog/productphoto/before1.png";
import After1 from "../../../assets/blog/productphoto/before2.png";

export default function AIProductPhotosShopify() {

        useEffect(() => {
      document.title = "Product Photos with AI for Shopify | Zyvo";
    }, []);

  return (
    <section className="min-h-screen bg-[#F7F5FA]">
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Breadcrumb */}
        <p className="text-sm text-gray-500 mb-4">
          Home / Blog / AI Product Photos for Shopify Stores
        </p>

        {/* Title */}
        <h1 className="text-[#7A3BFF] font-extrabold text-3xl md:text-4xl mb-4">
          AI Product Photos for Shopify Stores
        </h1>

        {/* Intro */}
        <p className="text-[#110829] text-lg mb-8">
          High-quality product photos are one of the biggest conversion drivers for Shopify stores.
          If your images don’t look professional, customers won’t trust your brand — no matter how
          good your product is.
        </p>

        {/* Image Placeholder – Hero / Before After */}
      <img src={After1} className="object-contain p-4 w-full h-[560px] bg-white  border-black border border-dashed rounded-xl flex items-center justify-center mb-12">
      
            </img>

        {/* Section */}
        <h2 className="text-[#110829] font-bold text-2xl mb-4">
          Why Product Photos Matter on Shopify
        </h2>

        <p className="text-[#110829] mb-4">
          When visitors land on a Shopify product page, the product image is the first thing they
          notice. Clean visuals instantly communicate quality, professionalism, and trust.
        </p>

        <ul className="list-disc pl-6 text-[#110829] mb-8">
          <li>Professional images build credibility</li>
          <li>Clean photos increase add-to-cart rates</li>
          <li>Good visuals reduce bounce rate</li>
          <li>Strong images improve brand perception</li>
        </ul>

        {/* Section */}
        <h2 className="text-[#110829] font-bold text-2xl mb-4">
          The Problem With Traditional Product Photography
        </h2>

        <p className="text-[#110829] mb-6">
          Traditional product photography is expensive, slow, and difficult to scale — especially
          for small Shopify stores and side hustlers.
        </p>

        <ul className="list-disc pl-6 text-[#110829] mb-10">
          <li>High cost per photoshoot</li>
          <li>Long editing and delivery times</li>
          <li>Limited background options</li>
          <li>Inconsistent lighting across products</li>
          <li>Constant re-shoots for new campaigns</li>
        </ul>

        {/* Image Placeholder – Traditional vs AI */}
        <img src={Before1} className="object-contain  w-full h-[560px] bg-white  border-black border border-dashed rounded-xl flex items-center justify-center mb-12">
      
            </img>

        {/* Section */}
        <h2 className="text-[#110829] font-bold text-2xl mb-4">
          How AI Product Photos Work
        </h2>

        <p className="text-[#110829] mb-6">
          AI product photography uses advanced image generation and background replacement to turn
          simple product photos into studio-quality visuals.
        </p>

        <ol className="list-decimal pl-6 text-[#110829] mb-10">
          <li>Upload your product image</li>
          <li>Remove or isolate the background</li>
          <li>Generate realistic studio or lifestyle scenes</li>
          <li>Enhance lighting and shadows automatically</li>
          <li>Export images ready for Shopify</li>
        </ol>

        {/* Section */}
        <h2 className="text-[#110829] font-bold text-2xl mb-4">
          Benefits of AI Product Photos for Shopify Stores
        </h2>

        <p className="text-[#110829] mb-4">
          AI-powered product photos give Shopify merchants a massive advantage.
        </p>

        <ul className="list-disc pl-6 text-[#110829] mb-10">
          <li>Save money on photography</li>
          <li>Launch products faster</li>
          <li>Create consistent branding</li>
          <li>Increase conversion rates</li>
          <li>Reuse images for ads and social media</li>
        </ul>

        {/* Image Placeholder – Variations */}
      <img src={Library} className="object-cover w-full h-[560px] bg-white p-3 border-black border border-dashed rounded-xl flex items-center justify-center mb-12">
      
            </img>
    

        {/* Section */}
        <h2 className="text-[#110829] font-bold text-2xl mb-4">
          AI Product Photos vs Real Photos
        </h2>

        <p className="text-[#110829] mb-6">
          AI does not replace real photography — it enhances it. Many successful Shopify stores use
          AI for most visuals and reserve real photoshoots for flagship campaigns.
        </p>

        <p className="text-[#110829] mb-10">
          This hybrid approach gives brands flexibility, speed, and professional visuals without
          breaking the budget.
        </p>

        {/* CTA */}
        <div className="bg-white border border-[#7A3BFF] rounded-lg p-8 text-center mb-16">
          <h3 className="text-[#110829] font-bold text-xl mb-3">
            Upgrade Your Shopify Product Photos Today
          </h3>
          <p className="text-[#110829] mb-6">
            AI product photos help Shopify stores look professional, build trust, and convert more
            visitors into customers — without expensive photoshoots.
          </p>
          <a
            href="/workspace/productphoto"
            className="inline-block bg-[#7A3BFF] text-white px-8 py-3 rounded-md font-semibold hover:opacity-90"
          >
            Try AI Product Photos
          </a>
        </div>

      </div>

  
    </section>
  );
}
