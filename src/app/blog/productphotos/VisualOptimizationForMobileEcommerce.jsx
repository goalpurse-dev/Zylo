import { useEffect } from "react";
import RelatedArticles from "../../../app/blog/RelatedArticles";
import Footer from "../../../components/workspace/footer.jsx";


const related = [
  {
    title: "Why Clean Product Photos Build Trust",
    description: "Learn how AI product photos improve conversion rates",
    date: "10.01.2026",
    slug: "/blog/why-clean-product-photos-build-trust",
  },
  {
    title: "Studio-Quality Product Photos Without a Studio",
    description: "How brands replace studios with AI",
    date: "08.01.2026",
    slug: "/blog/studio-quality-product-photos",
  },
  {
    title: "How Visual Quality Impacts SEO",
    description: "Learn how visual quality impacts SEO and take advantage of it",
    date: "05.01.2026",
    slug: "/blog/how-visual-quality-impacts-seo",
  },
];


export default function VisualOptimizationForMobileEcommerce() {
  useEffect(() => {
    document.title = "Visual Optimization for Mobile Ecommerce";
  }, []);

  return (
    <article className="w-full bg-[#F7F5FA] text-[#110829] overflow-x-hidden">

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7A3BFF]/14 via-[#492399]/10 to-[#7A3BFF]/8" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#7A3BFF]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#492399]/18 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16">
          <span className="inline-block mb-4 rounded-full border border-[#ECE8F2] bg-white/70 px-4 py-1 text-sm text-[#4A4A55]">
            Mobile · E-commerce · UX · Conversion
          </span>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Visual Optimization for{" "}
            <span className="bg-gradient-to-r from-[#7A3BFF] to-[#492399] bg-clip-text text-transparent">
              Mobile Ecommerce
            </span>
          </h1>

          <p className="mt-6 text-lg text-[#4A4A55] leading-relaxed">
            Most ecommerce traffic is mobile. That means your visuals must
            communicate value in seconds, on a small screen, while competing
            against distractions, glare, and fast scrolling. This guide covers
            the visual upgrades that most directly improve trust and conversion.
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
            Why mobile visuals matter more than desktop
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Mobile shoppers decide faster, scroll harder, and tolerate less
            friction. When your product photo, spacing, and typography are
            optimized for small screens, your brand feels premium and reliable.
            When they’re not, customers hesitate — and hesitation kills
            conversion.
          </p>

          <div className="mt-6 rounded-xl bg-white border border-[#ECE8F2] p-6">
            <p className="text-[#4A4A55]">
              <strong className="text-[#110829]">Mobile rule:</strong> If your
              product value isn’t obvious in <strong className="text-[#110829]">2–3 seconds</strong>,
              you’re losing sales.
            </p>
          </div>
        </div>

        {/* SECTION 2 */}
        <div>
          <h2 className="text-2xl font-bold">
            The “thumb zone” layout: keep the important stuff reachable
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            On mobile, users interact primarily with their thumb. If your buy
            actions, variant selectors, and image swipe controls are too high or
            too small, you create accidental friction. Good mobile visual
            optimization puts key actions in the natural interaction zone.
          </p>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              ["Primary CTA", "Make it large, clear, and visually dominant."],
              ["Spacing", "Give elements breathing room for fast scanning."],
              ["Tap targets", "Use bigger buttons than desktop."],
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

        {/* SECTION 3 */}
        <div>
          <h2 className="text-2xl font-bold">
            Product photos: what “optimized for mobile” really means
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Mobile shoppers don’t inspect details the same way desktop shoppers
            do. They scan. That’s why your main image must show the product
            clearly, with strong silhouette and clean contrast — even at small
            sizes.
          </p>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-[#7A3BFF]/10 to-[#492399]/10 p-6 border border-[#ECE8F2]">
            <p className="text-[#4A4A55]">
              <strong className="text-[#110829]">Best practice:</strong> Use a
              clean background and consistent lighting so the product “pops”
              instantly without needing zoom.
            </p>
          </div>

          <ul className="mt-6 space-y-3">
            {[
              "Use 1 hero angle that explains the product immediately",
              "Avoid busy backgrounds and harsh shadows",
              "Keep the product large in the frame (reduce empty space)",
              "Use consistent crop and padding across your catalog",
              "Export high enough resolution for retina screens",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#492399]" />
                <span className="text-[#4A4A55]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION 4 */}
        <div>
          <h2 className="text-2xl font-bold">
            Typography that converts on small screens
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Most mobile product pages fail because text is either too small, too
            dense, or too low-contrast. Your type system should guide the eye:
            headline → key benefit → price → proof → CTA.
          </p>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-[#ECE8F2] p-5">
              <h3 className="font-semibold">Do this</h3>
              <ul className="mt-3 text-sm text-[#4A4A55] space-y-2">
                <li>• Big, readable headlines</li>
                <li>• Short benefit bullets</li>
                <li>• Strong contrast (#110829 / #4A4A55)</li>
                <li>• Clear spacing between sections</li>
              </ul>
            </div>

            <div className="rounded-xl bg-white border border-[#ECE8F2] p-5">
              <h3 className="font-semibold">Avoid this</h3>
              <ul className="mt-3 text-sm text-[#4A4A55] space-y-2">
                <li>• Paragraph walls</li>
                <li>• Tiny grey text on grey background</li>
                <li>• Too many font sizes</li>
                <li>• Links that look like body text</li>
              </ul>
            </div>
          </div>
        </div>

        {/* SECTION 5 */}
        <div>
          <h2 className="text-2xl font-bold">
            Color psychology: use purple as a conversion tool, not decoration
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Your purple palette should create hierarchy. Use{" "}
            <strong className="text-[#110829]">#7A3BFF</strong> for primary actions
            and highlights, and{" "}
            <strong className="text-[#110829]">#492399</strong> for depth, hover
            states, and secondary emphasis. Keep the rest calm so purple stays
            powerful.
          </p>

          <div className="mt-6 rounded-xl bg-white border border-[#ECE8F2] p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 rounded-xl border border-[#ECE8F2] p-4 bg-[#F7F5FA]">
                <p className="text-sm text-[#4A4A55]">Primary purple</p>
                <div className="mt-2 h-10 rounded-lg bg-[#7A3BFF]" />
                <p className="mt-2 text-sm text-[#4A4A55]">CTA, key highlights</p>
              </div>

              <div className="flex-1 rounded-xl border border-[#ECE8F2] p-4 bg-[#F7F5FA]">
                <p className="text-sm text-[#4A4A55]">Secondary purple</p>
                <div className="mt-2 h-10 rounded-lg bg-[#492399]" />
                <p className="mt-2 text-sm text-[#4A4A55]">Hover, depth, accents</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 6 */}
        <div>
          <h2 className="text-2xl font-bold">
            Proof blocks: the fastest trust builder on mobile
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            Mobile shoppers need proof because they can’t physically inspect the
            product. Use compact trust signals that are readable without zoom:
            ratings, guarantee badges, shipping time, and short testimonials.
          </p>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              ["Ratings", "Show star rating near price and title."],
              ["Guarantee", "Returns and warranty reduce risk."],
              ["Delivery", "Clear arrival estimate increases confidence."],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-xl bg-white border border-[#ECE8F2] p-5"
              >
                <div className="h-2 w-12 rounded-full bg-[#492399] mb-3" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-[#4A4A55]">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 7 */}
        <div>
          <h2 className="text-2xl font-bold">
            AI visuals for mobile: consistency beats “crazy”
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            On mobile, overly complex AI backgrounds can hurt conversion because
            details blur and look fake when small. The best mobile-friendly AI
            visuals are clean, realistic, and consistent across your catalog.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "Keep backgrounds simple with clear depth",
              "Use soft shadows to ground the product",
              "Match color temperature across images",
              "Avoid tiny props and busy textures",
              "Generate multiple variants but keep style consistent",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#7A3BFF]" />
                <span className="text-[#4A4A55]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION 8 */}
        <div>
          <h2 className="text-2xl font-bold">
            Mobile visual checklist (quick wins)
          </h2>
          <p className="mt-4 text-[#4A4A55] leading-relaxed">
            If you want the fastest improvement, run this checklist on your top
            selling product page. These changes are low effort but high impact.
          </p>

          <div className="mt-6 rounded-xl bg-white border border-[#ECE8F2] p-6">
            <div className="space-y-3">
              {[
                "Main photo is clear at first glance",
                "Title and price are visible without scrolling",
                "CTA is large and near the thumb zone",
                "Benefit bullets are short and readable",
                "Proof blocks appear early (rating, guarantee, shipping)",
                "Colors create hierarchy (purple = action)",
                "No horizontal overflow / layout shift",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-1.5 h-4 w-4 rounded-md bg-[#7A3BFF]/15 border border-[#7A3BFF]/30" />
                  <p className="text-[#4A4A55]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-white border border-[#ECE8F2] p-8">
          <h2 className="text-2xl font-bold">
            Create mobile-ready product visuals in minutes
          </h2>
          <p className="mt-3 text-[#4A4A55]">
            Zyvo helps you generate clean, consistent product visuals that look
            premium on mobile — without expensive shoots or design tools.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href="/workspace/productphoto"
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

          <div className="mt-6 h-[1px] w-full bg-[#ECE8F2]" />

          <p className="mt-4 text-sm text-[#4A4A55]">
            Tip: Start with your best-selling product. Optimize that page first,
            then apply the same visual system across your entire catalog.
          </p>
        </div>

      </section>
             <div className="mb-10"><RelatedArticles articles={related} /></div>
                     <div className="text-white">  <Footer /></div>
    </article>
  );
}
