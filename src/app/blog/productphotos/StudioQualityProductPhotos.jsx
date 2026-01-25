import { useEffect } from "react";
import RelatedArticles from "../../../app/blog/RelatedArticles";
import Footer from "../../../components/workspace/footer.jsx";


const related = [
  {
    title: "How AI Product Photos Increase Conversion Rates",
    description: "Learn how AI product photos improve conversion rates",
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

export default function StudioQualityProductPhotos() {
  useEffect(() => {
    document.title = "Studio-Quality Product Photos Without a Studio";
  }, []);

  return (
    <article className="w-full bg-[#F7F5FA] text-[#110829] overflow-x-hidden">

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7A3BFF]/15 via-[#00A3FF]/10 to-[#FF4FD8]/10" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#7A3BFF]/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#00A3FF]/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16">
          <span className="inline-block mb-4 rounded-full border border-[#110829]/10 bg-white/70 px-4 py-1 text-sm text-[#4A4A55]">
            Product Photography · E-commerce · No Studio
          </span>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Studio-Quality Product Photos{" "}
            <span className="bg-gradient-to-r from-[#7A3BFF] via-[#00A3FF] to-[#FF4FD8] bg-clip-text text-transparent">
              Without a Studio
            </span>
          </h1>

          <p className="mt-6 text-lg text-[#4A4A55] leading-relaxed">
            You don’t need an expensive studio or pro camera to create product
            photos that convert. With the right lighting, setup, and workflow,
            you can get clean, premium results from home.
          </p>

          <div className="mt-6 flex gap-3 text-sm text-[#4A4A55]">
            <span className="rounded-full bg-white/70 px-3 py-1 border">
              Updated: Jan 25, 2026
            </span>
            <span className="rounded-full bg-white/70 px-3 py-1 border">
              Read time: ~8 min
            </span>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-4xl px-6 pb-24 space-y-16">

        {/* SECTION */}
        <div>
          <h2 className="text-2xl font-bold">
            What makes a photo look studio-quality?
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Studio photos are not about expensive gear. They’re about{" "}
            <strong>soft lighting</strong>, <strong>clean edges</strong>, and{" "}
            <strong>consistency</strong>. When those three are right, your photos
            immediately feel premium.
          </p>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              ["Soft light", "#7A3BFF"],
              ["Clean backgrounds", "#00A3FF"],
              ["Consistent angles", "#FF4FD8"],
            ].map(([title, color]) => (
              <div
                key={title}
                className="rounded-xl bg-white border border-[#110829]/10 p-5"
              >
                <div
                  className="h-2 w-12 rounded-full mb-3"
                  style={{ backgroundColor: color }}
                />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-[#4A4A55]">
                  This is what separates amateur photos from professional ones.
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION */}
        <div>
          <h2 className="text-2xl font-bold">
            The simplest home product photo setup
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            You can create a reliable setup with everyday items. The goal is to
            control light and reflections — not to overcomplicate things.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "Table near a window",
              "White wall, paper, or fabric as background",
              "Foam board or cardboard to reflect light",
              "Tripod or stable surface",
              "Microfiber cloth to clean products",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#7A3BFF]" />
                <span className="text-[#4A4A55]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION */}
        <div>
          <h2 className="text-2xl font-bold">
            Lighting that makes products look expensive
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Lighting is the biggest quality lever. Soft, directional light
            creates natural shadows and highlights that feel professional.
          </p>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-[#00A3FF]/10 to-[#7A3BFF]/10 p-6 border">
            <p className="text-[#4A4A55]">
              <strong>Best free option:</strong> Window light from the side +
              white reflector on the opposite side. Avoid direct sunlight.
            </p>
          </div>
        </div>

        {/* SECTION */}
        <div>
          <h2 className="text-2xl font-bold">
            Editing workflow (clean & fast)
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Over-editing kills trust. Aim for clean, consistent, and realistic
            edits across your entire product catalog.
          </p>

          <ol className="mt-6 space-y-3">
            {[
              "Crop and straighten consistently",
              "Adjust exposure slightly",
              "Correct white balance",
              "Remove dust and imperfections",
              "Match contrast across all images",
              "Export in consistent size",
            ].map((step, i) => (
              <li key={step} className="flex gap-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#110829] text-white text-sm">
                  {i + 1}
                </span>
                <span className="text-[#4A4A55]">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* SECTION */}
        <div>
          <h2 className="text-2xl font-bold">
            Using AI to replace studio backgrounds
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Once your base photo is clean and sharp, AI can generate professional
            backgrounds that look like real studio or lifestyle shoots — without
            reshooting products.
          </p>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border p-5">
              <h3 className="font-semibold">Use AI for</h3>
              <ul className="mt-3 text-sm text-[#4A4A55] space-y-2">
                <li>• Lifestyle scenes</li>
                <li>• Seasonal campaigns</li>
                <li>• Ad variations</li>
                <li>• Brand consistency</li>
              </ul>
            </div>

            <div className="rounded-xl bg-white border p-5">
              <h3 className="font-semibold">Avoid AI when</h3>
              <ul className="mt-3 text-sm text-[#4A4A55] space-y-2">
                <li>• The product is blurry</li>
                <li>• Lighting is inconsistent</li>
                <li>• Reflections are messy</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-br from-white to-[#F7F5FA] border p-8">
          <h2 className="text-2xl font-bold">
            Want studio-quality product photos in minutes?
          </h2>
          <p className="mt-3 text-[#4A4A55]">
            Start with clean base photos and let Zyvo handle backgrounds,
            consistency, and scale — without a studio.
          </p>

          <div className="mt-6 flex gap-4">
            <a
              href="/workspace/productphoto"
              className="rounded-xl bg-[#7A3BFF] px-6 py-3 text-white font-semibold hover:opacity-90 transition"
            >
              Try Product Photos
            </a>
            <a
              href="/workspace/pricing"
              className="rounded-xl border px-6 py-3 font-semibold hover:bg-[#F7F5FA] transition"
            >
              View Pricing
            </a>
          </div>
        </div>

      </section>
         <div className="mb-10"><RelatedArticles articles={related} /></div>
         <div className="text-white">  <Footer /></div>
    </article>
    
  );
}
