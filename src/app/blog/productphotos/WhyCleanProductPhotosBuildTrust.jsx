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


export default function WhyCleanProductPhotosBuildTrust() {
  useEffect(() => {
    document.title = "Why Clean Product Photos Build Trust";
  }, []);

  return (
    <article className="w-full bg-[#F7F5FA] text-[#110829] overflow-x-hidden">

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7A3BFF]/15 via-[#00A3FF]/10 to-[#00E5A8]/10" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#7A3BFF]/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#00A3FF]/25 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16">
          <span className="inline-block mb-4 rounded-full border border-[#110829]/10 bg-white/70 px-4 py-1 text-sm text-[#4A4A55]">
            E-commerce · Branding · Conversion
          </span>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Why{" "}
            <span className="bg-gradient-to-r from-[#7A3BFF] to-[#00A3FF] bg-clip-text text-transparent">
              Clean Product Photos
            </span>{" "}
            Build Trust
          </h1>

          <p className="mt-6 text-lg text-[#4A4A55] leading-relaxed">
            Trust is the most valuable currency in e-commerce. Before customers
            read reviews, descriptions, or prices, they judge your brand by how
            your product looks. Clean product photos are often the deciding
            factor between a sale and a bounce.
          </p>

          <div className="mt-6 flex gap-3 text-sm text-[#4A4A55]">
            <span className="rounded-full bg-white/70 px-3 py-1 border">
              Updated: Jan 2026
            </span>
            <span className="rounded-full bg-white/70 px-3 py-1 border">
              Read time: ~9 min
            </span>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-4xl px-6 pb-24 space-y-16">

        {/* SECTION 1 */}
        <div>
          <h2 className="text-2xl font-bold">
            Trust starts before logic
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Humans make decisions emotionally first, then justify them with
            logic. In online shopping, product photos trigger that first
            emotional response. If an image feels messy, inconsistent, or
            low-quality, the brain associates the product with risk.
          </p>

          <div className="mt-6 rounded-xl bg-white border border-[#110829]/10 p-6">
            <p className="text-[#4A4A55]">
              <strong>Clean visuals signal safety.</strong>  
              Safety builds trust. Trust enables conversion.
            </p>
          </div>
        </div>

        {/* SECTION 2 */}
        <div>
          <h2 className="text-2xl font-bold">
            What “clean” really means in product photography
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Clean product photos are not sterile or boring. They are intentional,
            controlled, and consistent. Clean images reduce cognitive load and
            allow customers to focus on the product itself.
          </p>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              ["Neutral backgrounds", "No visual noise or distractions"],
              ["Consistent lighting", "Predictable and professional feel"],
              ["Sharp focus", "Clear understanding of the product"],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-xl bg-white border border-[#110829]/10 p-5"
              >
                <div className="h-2 w-10 rounded-full bg-[#7A3BFF] mb-3" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-[#4A4A55]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3 */}
        <div>
          <h2 className="text-2xl font-bold">
            Messy photos trigger doubt
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            When photos are cluttered or inconsistent, customers subconsciously
            ask questions they shouldn’t have to ask.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "Is this brand legitimate?",
              "Will the product look different in real life?",
              "Is this seller cutting corners?",
              "What else are they hiding?",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#FF4D4D]" />
                <span className="text-[#4A4A55]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION 4 */}
        <div>
          <h2 className="text-2xl font-bold">
            Clean photos reduce cognitive friction
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Cognitive friction is anything that makes a customer hesitate. Clean
            product photos remove unnecessary mental effort by presenting the
            product clearly and consistently.
          </p>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-[#7A3BFF]/10 to-[#00A3FF]/10 p-6 border">
            <p className="text-[#4A4A55]">
              The easier it is to understand a product visually, the more likely
              a customer is to trust the brand behind it.
            </p>
          </div>
        </div>

        {/* SECTION 5 */}
        <div>
          <h2 className="text-2xl font-bold">
            Consistency across photos = brand credibility
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Trust isn’t built by one good photo — it’s built by consistency.
            When all product images share the same lighting, angles, and style,
            your brand feels intentional and professional.
          </p>

          <ol className="mt-6 space-y-3">
            {[
              "Same background style across products",
              "Same framing and spacing",
              "Same color balance",
              "Same shadow intensity",
              "Same export dimensions",
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

        {/* SECTION 6 */}
        <div>
          <h2 className="text-2xl font-bold">
            Clean photos increase conversion rates
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Studies consistently show that high-quality, clean product photos
            increase perceived value and reduce return rates. Customers are more
            confident when what they see matches what they expect.
          </p>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border p-5">
              <h3 className="font-semibold">With clean photos</h3>
              <ul className="mt-3 text-sm text-[#4A4A55] space-y-2">
                <li>• Higher trust</li>
                <li>• Faster decisions</li>
                <li>• Fewer objections</li>
                <li>• Lower bounce rate</li>
              </ul>
            </div>

            <div className="rounded-xl bg-white border p-5">
              <h3 className="font-semibold">With messy photos</h3>
              <ul className="mt-3 text-sm text-[#4A4A55] space-y-2">
                <li>• Doubt and hesitation</li>
                <li>• Price sensitivity</li>
                <li>• Lower conversions</li>
                <li>• Higher returns</li>
              </ul>
            </div>
          </div>
        </div>

        {/* SECTION 7 */}
        <div>
          <h2 className="text-2xl font-bold">
            How AI helps maintain visual trust at scale
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            AI allows brands to maintain clean, consistent visuals across large
            catalogs without expensive reshoots. When used correctly, AI
            enhances trust instead of breaking it.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "Consistent backgrounds across products",
              "Easy seasonal updates without new shoots",
              "Fast A/B testing for ads",
              "Uniform brand look across channels",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#00A3FF]" />
                <span className="text-[#4A4A55]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-br from-white to-[#F7F5FA] border p-8">
          <h2 className="text-2xl font-bold">
            Build trust with clean product photos
          </h2>
          <p className="mt-3 text-[#4A4A55]">
            Clean visuals aren’t about perfection — they’re about clarity,
            consistency, and credibility. Zyvo helps you create product photos
            that customers trust instantly.
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
