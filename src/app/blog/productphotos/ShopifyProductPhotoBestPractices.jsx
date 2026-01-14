import { useEffect } from "react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import BeforeAfter2 from "../../../assets/blog/productphoto/beforeafter2.png";
import Wrong from "../../../assets/blog/productphoto/wrong.png";



export default function ShopifyProductPhotoBestPractices() {
  useEffect(() => {
    const title =
      "Shopify Product Photo Best Practices (2026 Guide) | Zyvo";
    const description =
      "Shopify product photo best practices to increase conversions, build trust, and improve ecommerce performance with high-quality visuals.";

    document.title = title;

    // Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href =
      "https://www.tryzyvo.com/blog/shopify-product-photo-best-practices";

    // Open Graph
    const setOG = (property, content) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    setOG("og:title", title);
    setOG("og:description", description);
    setOG(
      "og:url",
      "https://www.tryzyvo.com/blog/shopify-product-photo-best-practices"
    );
    setOG("og:type", "article");
    setOG("og:site_name", "Zyvo");
  }, []);

  return (
    <section className="min-h-screen bg-[#F7F5FA]">
      <div className="max-w-3xl mx-auto px-6 pt-12">
        <p className="text-sm text-gray-500 mb-2">
          Home / Blog / Shopify Product Photo Best Practices
        </p>

        <h1 className="text-[#110829] font-extrabold text-[28px] md:text-[32px]">
          Shopify Product Photo Best Practices (2026 Guide)
        </h1>

        <p className="mt-4 text-[#110829]/80 leading-relaxed">
          Shopify product photo best practices are essential for ecommerce
          brands that want to build trust, stand out from competitors, and
          increase conversion rates.
        </p>
      </div>

      {/* HERO IMAGE */}
      <div className="max-w-3xl mx-auto px-6 mt-10">
        <div className=" rounded-lg h-[500px] flex items-center justify-center text-[#7A3BFF] text-sm">
            <img src={BeforeAfter2} alt="Before and After 2" className="w-full h-full object-contain" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 mt-12 text-[#110829]">
        <h2 className="text-[22px] font-bold mb-4">
          Why Shopify Product Photo Best Practices Matter
        </h2>

        <p className="mb-4 leading-relaxed">
          Product images are the first thing customers notice. Clean,
          professional visuals instantly communicate quality and credibility.
        </p>

        <ul className="list-disc pl-6 space-y-2 mb-8">
          <li>Build instant trust</li>
          <li>Increase add-to-cart rates</li>
          <li>Improve engagement</li>
          <li>Reduce bounce rates</li>
          <li>Create strong brand identity</li>
        </ul>

        <h2 className="text-[22px] font-bold mb-4">
          Common Problems Without Optimized Product Photos
        </h2>

        <ul className="list-disc pl-6 space-y-2 mb-8">
          <li>Poor first impressions</li>
          <li>Low conversions</li>
          <li>Higher ad costs</li>
          <li>Inconsistent branding</li>
        </ul>

        <div className=" rounded-lg h-[350px] flex items-center justify-center text-[#7A3BFF] text-sm mb-10">
            <img src={Wrong} alt="Wrong Example" className="w-full h-full object-contain" />
        </div>

        <h2 className="text-[22px] font-bold mb-4">
          Best Practices for Shopify Product Photos
        </h2>

        <ul className="list-disc pl-6 space-y-2 mb-8">
          <li>Use clean, distraction-free backgrounds</li>
          <li>Ensure consistent lighting</li>
          <li>Optimize images for mobile</li>
          <li>Keep branding consistent</li>
          <li>Continuously test performance</li>
        </ul>

        <h2 className="text-[22px] font-bold mb-4">Final Thoughts</h2>

        <p className="mb-10 leading-relaxed">
          Shopify product photo best practices are no longer optional. They
          directly influence trust, conversions, and long-term ecommerce
          growth.
        </p>

        {/* CTA */}
        <div className="bg-white border border-[#7A3BFF]/30 rounded-lg p-6 text-center mb-20">
          <h3 className="font-bold text-[20px] mb-3">
            Want better product photos without expensive shoots?
          </h3>

          <p className="text-[#110829]/80 mb-5">
            Create high-converting Shopify images using AI in minutes.
          </p>

          <Link
            to="/workspace/productphoto"
            className="inline-block bg-[#7A3BFF] text-white px-6 py-3 rounded-md font-semibold hover:opacity-90 transition"
          >
            Try Zyvo Product Photos →
          </Link>
        </div>
      </div>

      <Footer />
    </section>
  );
}
