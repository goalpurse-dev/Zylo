import { useEffect } from "react";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../../../app/blog/RelatedArticles";

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

export default function AIProductPhotosForBeautyAndSkincare() {
  useEffect(() => {
    document.title = "AI Product Photos for Beauty & Skincare Brands";
  }, []);

  return (
    <article className="w-full bg-[#F7F5FA] text-[#110829] overflow-x-hidden">

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7A3BFF]/15 via-[#492399]/10 to-[#7A3BFF]/5" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#7A3BFF]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#492399]/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16">
          <span className="inline-block mb-4 rounded-full border border-[#ECE8F2] bg-white/70 px-4 py-1 text-sm text-[#4A4A55]">
            Beauty · Skincare · AI · Ecommerce
          </span>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            AI Product Photos for{" "}
            <span className="bg-gradient-to-r from-[#7A3BFF] to-[#492399] bg-clip-text text-transparent">
              Beauty & Skincare Brands
            </span>
          </h1>

          <p className="mt-6 text-lg text-[#4A4A55] leading-relaxed">
            In beauty and skincare ecommerce, visuals are everything. Customers
            judge quality, effectiveness, and trustworthiness within seconds.
            AI product photography allows beauty brands to create clean,
            premium-looking product images at scale — without expensive studios
            or slow production cycles.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#4A4A55]">
            <span className="rounded-full bg-white/70 px-3 py-1 border border-[#ECE8F2]">
              Updated: Jan 2026
            </span>
            <span className="rounded-full bg-white/70 px-3 py-1 border border-[#ECE8F2]">
              Read time: ~10 min
            </span>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-4xl px-6 pb-24 space-y-16">

        {/* SECTION 1 */}
        <div>
          <h2 className="text-2xl font-bold">
            Why product photos matter more in beauty and skincare
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Beauty products are deeply emotional purchases. Customers aren’t
            just buying a bottle — they’re buying trust, self-care, and results.
            Clean, high-quality product photos help communicate purity,
            effectiveness, and brand credibility instantly.
          </p>

          <div className="mt-6 rounded-xl bg-white border border-[#ECE8F2] p-6">
            <p className="text-[#4A4A55]">
              <strong className="text-[#110829]">In beauty ecommerce:</strong>{" "}
              visuals are proof of quality before results exist.
            </p>
          </div>
        </div>

        {/* SECTION 2 */}
        <div>
          <h2 className="text-2xl font-bold">
            The challenges of traditional beauty product photography
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Shooting beauty and skincare products is harder than it looks.
            Reflections, glossy packaging, liquids, glass bottles, and labels
            require perfect lighting and post-production — driving costs up
            fast.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "High studio and retouching costs",
              "Difficult lighting for glass and liquids",
              "Inconsistent results across product lines",
              "Slow turnaround for new launches",
              "Expensive reshoots for rebrands or label changes",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#492399]" />
                <span className="text-[#4A4A55]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION 3 */}
        <div>
          <h2 className="text-2xl font-bold">
            How AI product photos elevate beauty brands
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            AI product photography enables beauty brands to generate polished,
            consistent visuals from a single base image. This makes it possible
            to maintain a premium aesthetic across every product and channel.
          </p>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              ["Clarity", "Clean lighting that highlights packaging and texture"],
              ["Consistency", "Uniform visuals across full skincare lines"],
              ["Speed", "Instant updates for new products or rebrands"],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-xl bg-white border border-[#ECE8F2] p-5"
              >
                <div className="h-2 w-12 rounded-full bg-[#7A3BFF] mb-3" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-[#4A4A55]">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4 */}
        <div>
          <h2 className="text-2xl font-bold">
            Minimal, clean visuals build trust in skincare
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Skincare customers associate clean visuals with clean ingredients.
            White backgrounds, soft shadows, and subtle lifestyle elements help
            position products as safe, effective, and professional.
          </p>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-[#7A3BFF]/10 to-[#492399]/10 p-6 border border-[#ECE8F2]">
            <p className="text-[#4A4A55]">
              Minimal product photos reduce doubt and increase perceived quality.
            </p>
          </div>
        </div>

        {/* SECTION 5 */}
        <div>
          <h2 className="text-2xl font-bold">
            AI product photos reduce hesitation and returns
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Clear visuals reduce uncertainty. When customers understand size,
            packaging, and texture upfront, they’re more confident in their
            purchase — lowering return rates and increasing satisfaction.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "Accurate color representation",
              "Clear label readability",
              "Consistent angles across products",
              "Realistic reflections and shadows",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#7A3BFF]" />
                <span className="text-[#4A4A55]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION 6 */}
        <div>
          <h2 className="text-2xl font-bold">
            Mobile-first beauty shopping needs perfect visuals
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Most beauty purchases happen on mobile devices. AI-generated product
            photos can be optimized for small screens, ensuring clarity and
            brand appeal even at thumbnail size.
          </p>

          <div className="mt-6 rounded-xl bg-white border border-[#ECE8F2] p-6">
            <p className="text-[#4A4A55]">
              If your product photo isn’t clear on mobile, it won’t convert.
            </p>
          </div>
        </div>

        {/* SECTION 7 */}
        <div>
          <h2 className="text-2xl font-bold">
            Best use cases for AI product photos in beauty ecommerce
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            AI works especially well for beauty brands that value consistency,
            speed, and clean aesthetics across multiple channels.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "Product page hero images",
              "Skincare line collections",
              "Paid social and ad creatives",
              "Website banners and landing pages",
              "Marketplace listings (Amazon, Shopify, etc.)",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#492399]" />
                <span className="text-[#4A4A55]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION 8 */}
        <div>
          <h2 className="text-2xl font-bold">
            AI doesn’t replace beauty branding — it strengthens it
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Strong beauty brands are built on trust and aesthetics. AI helps
            apply those decisions consistently across every product, ensuring
            brand identity stays intact as the business scales.
          </p>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-[#7A3BFF]/10 to-[#492399]/10 p-6 border border-[#ECE8F2]">
            <p className="text-[#4A4A55]">
              AI scales visual quality — not shortcuts.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-white border border-[#ECE8F2] p-8">
          <h2 className="text-2xl font-bold">
            Create premium beauty product photos with AI
          </h2>
          <p className="mt-3 text-[#4A4A55]">
            Zyvo helps beauty and skincare brands generate clean, premium,
            conversion-focused product photos using AI — without studios,
            photographers, or long production timelines.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href="/workspace/image-generator"
              className="rounded-xl bg-[#7A3BFF] px-6 py-3 text-white font-semibold hover:opacity-90 transition"
            >
              Try Product Photos
            </a>
            <a
              href="/workspace/pricing"
              className="rounded-xl border border-[#ECE8F2] px-6 py-3 font-semibold text-[#110829] hover:bg-[#F7F5FA] transition"
            >
              View Pricing
            </a>
          </div>
        </div>

      </section>
        <div className="mt-12">
                                  <RelatedArticles articles={related} />
                                </div>
                  <div className="text-white">
                  <Footer />
                  </div>
    </article>
  );
}
