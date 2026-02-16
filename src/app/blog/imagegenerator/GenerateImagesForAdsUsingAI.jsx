import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../../../app/blog/RelatedArticles";

const related = [
  {
    title: "Create Professional Images with AI",
    description: "Learn everything you need to know about creating professional images with AI in 2026",
    date: "15.02.2026",
    slug: "/blog/create-professional-images-with-ai",
  },
  {
    title: "AI Image Generator: Complete Beginner’s Guide (2026)",
    description: "Learn everything you need to know about AI image generators in 2026",
    date: "08.01.2026",
    slug: "/blog/ai-image-generator-beginners-guide-2026",
  },
  {
    title: "How to Generate High-Quality Images With AI in Seconds",
    description: "Learn how to generate high-quality images with AI in seconds",
    date: "02.01.2026",
    slug: "/blog/how-to-generate-high-quality-images-with-ai",
  },
];


export default function GenerateImagesForAdsUsingAI() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        {/* Header */}
        <header className="mb-24">
          <h1 className="text-[44px] font-bold text-[#110829] leading-tight mb-8">
            How to Generate Images for Ads Using AI
          </h1>
          <p className="text-[19px] text-[#4A4A55] max-w-4xl">
            Ad performance depends on one thing first: attention.
            If your creative doesn’t stop the scroll, nothing else matters.
            AI image generators now allow brands to create high-converting
            ad visuals in minutes — without photographers or design teams.
          </p>
        </header>

        {/* Intro */}
        <section className="mb-28">
          <p className="text-[#4A4A55] mb-6">
            Whether you're running TikTok ads, Instagram campaigns, or
            ecommerce product promotions, AI-generated visuals can
            dramatically reduce production costs while increasing testing speed.
          </p>
          <p className="text-[#4A4A55]">
            Using a modern{" "}
            <Link to="/workspace/image-generator" className="text-[#7A3BFF] font-medium hover:underline">
              AI image generator
            </Link>, you can produce dozens of ad variations in the time
            it takes to design one manually.
          </p>
        </section>

        {/* Section 1 */}
        <section className="mb-32 grid grid-cols-2 gap-16 items-center">
          <div className="w-full h-[600px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
                 <img
              src="/assets/product/image2.webp"
              alt="AI vs Traditional Design Comparison"
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>

          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6">
              Step 1: Design for Attention First
            </h2>
            <p className="text-[#4A4A55] mb-4">
              Ads don’t compete with other ads — they compete with
              entertainment. Your image must interrupt scrolling instantly.
            </p>
            <p className="text-[#4A4A55] mb-4">
              Use strong contrast, exaggerated lighting, bold focal points,
              and clear subject placement. AI allows you to amplify
              these elements effortlessly.
            </p>
            <p className="text-[#4A4A55]">
              Creator-focused platforms like{" "}
              <Link to="/home" className="text-[#7A3BFF] font-medium hover:underline">
                ZyvoAI
              </Link>{" "}
              are optimized for performance-driven visuals rather than
              purely artistic outputs.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-32 grid grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6">
              Step 2: Structure Your Ad Prompt Correctly
            </h2>
            <p className="text-[#4A4A55] mb-4">
              A high-converting ad image starts with a structured prompt.
              Include:
            </p>

            <ul className="text-[#4A4A55] space-y-3 mb-4">
              <li>• Clear product or subject</li>
              <li>• Context (studio, lifestyle, outdoor, etc.)</li>
              <li>• Emotional tone (luxury, energetic, calm, bold)</li>
              <li>• Lighting style (soft diffused, cinematic, high contrast)</li>
              <li>• Clean composition for text overlays</li>
            </ul>

            <p className="text-[#4A4A55]">
              Example: “Luxury skincare bottle on minimal white surface,
              soft studio lighting, shallow depth of field, clean composition,
              premium aesthetic, sharp focus.”
            </p>
          </div>

           <div className="w-full h-[600px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
                 <img
              src="/assets/product/image1.webp"
              alt="AI vs Traditional Design Comparison"
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>
        </section>

        {/* Section 3 */}
        <section className="mb-32 grid grid-cols-2 gap-16 items-center">
         <div className="w-full h-[600px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
                 <img
              src="/assets/product/image.webp"
              alt="AI vs Traditional Design Comparison"
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>

          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6">
              Step 3: Generate Multiple Variations for Testing
            </h2>
            <p className="text-[#4A4A55] mb-4">
              Winning ads rarely come from a single creative.
              High-performing brands test different angles, lighting,
              emotions, and framing.
            </p>
            <p className="text-[#4A4A55] mb-4">
              AI allows you to quickly create multiple variations
              without reshooting or redesigning from scratch.
            </p>
            <p className="text-[#4A4A55]">
              Fast iteration inside a centralized{" "}
              <Link to="/home" className="text-[#7A3BFF] font-medium hover:underline">
                AI workspace
              </Link>{" "}
              gives you a testing advantage.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="mb-32 grid grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6">
              Step 4: Optimize for Platform Format
            </h2>
            <p className="text-[#4A4A55] mb-4">
              Different platforms require different visual framing.
              Vertical (9:16) for TikTok and Reels. Square (1:1)
              for Instagram feed. Clean center framing for product ads.
            </p>
            <p className="text-[#4A4A55] mb-4">
              AI tools make resizing and re-generating format-friendly
              visuals much faster than manual design.
            </p>
            <p className="text-[#4A4A55]">
              When using a tool optimized for creators like{" "}
              <Link to="/home" className="text-[#7A3BFF] font-medium hover:underline">
                ZyvoAI
              </Link>, you can adapt visuals to each platform instantly.
            </p>
          </div>

             <div className="w-full h-[600px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
                 <img
              src="/assets/product/image3.webp"
              alt="AI vs Traditional Design Comparison"
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>
        </section>

        {/* Final Section */}
        <section className="mb-28">
          <h2 className="text-[36px] font-semibold text-[#110829] mb-6">
            Why AI Is Changing Ad Creative Production
          </h2>
          <p className="text-[#4A4A55] mb-4">
            Traditional ad creative requires photoshoots, designers,
            revisions, and time. AI compresses this entire workflow
            into minutes.
          </p>
          <p className="text-[#4A4A55]">
            The brands that win in 2026 are the ones that test faster,
            iterate quicker, and scale creative production efficiently.
          </p>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-[#ECE8F2] bg-white p-16 text-center">
          <h3 className="text-[34px] font-semibold text-[#110829] mb-6">
            Create High-Converting Ad Images Today
          </h3>
          <p className="text-[#4A4A55] mb-10 max-w-3xl mx-auto">
            Generate professional, scroll-stopping ad visuals in seconds
            and test more creatives without increasing production costs.
          </p>
          <Link
            to="/workspace/image-generator"
            className="inline-block rounded-xl bg-[#7A3BFF] px-16 py-5 text-white font-semibold hover:opacity-90 transition"
          >
            Try ZyvoAI for Ads
          </Link>
        </div>

      </div>

             <div className="mt-5">
                        <RelatedArticles articles={related} />
                      </div>
      

      <Footer />
    </div>
  );
}
