import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import i18 from "../../../assets/inspiration/18.png";
import i19 from "../../../assets/inspiration/19.png";
import i20 from "../../../assets/inspiration/20.png";
import i21 from "../../../assets/inspiration/21.png";
import RelatedArticles from "../../../app/blog/RelatedArticles";

const related = [
  {
    title: ">How Creators Are Blowing Up Using AI Image Generators",
    description: "Learn to make images that current creators are using to blow up",
    date: "01.02.2026",
    slug: "/blog/creators-blowingup-with-ai",
  },
  {
    title: "These AI Images Are Going Viral on TikTok",
    description: "Learn how to go viral on Tiktok with AI images",
    date: "08.01.2026",
    slug: "/blog/viral-ai-images-tiktok",
  },
  {
    title: "I Tested 10 Viral AI Image Prompts — Here Are the Results",
    description: "Here are the results of 10 Viral AI Image Prompts",
    date: "02.01.2026",
    slug: "/blog/i-test-viral-prompts",
  },
];

export default function ScrollStoppingImagesNoDesign() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-20">

        {/* Header */}
        <header className="mb-16">
          <h1 className="text-[40px] font-bold text-[#110829] leading-tight mb-6">
            How to Create Scroll-Stopping Images With AI (No Design Skills)
          </h1>
          <p className="text-[18px] text-[#4A4A55] max-w-3xl">
            You don’t need Photoshop, a camera, or years of design experience.
            Today, creators are using AI to generate images that instantly stop
            the scroll on TikTok, Pinterest, and Instagram.
          </p>
        </header>

        {/* Intro */}
        <section className="mb-20">
          <p className="text-[#4A4A55] mb-4">
            Scroll-stopping images share a few key traits: strong mood,
            clear focus, and visual contrast. AI makes this accessible to
            anyone — even if you’ve never designed anything before.
          </p>
          <p className="text-[#4A4A55]">
            With the right prompts and a tool like an{" "}
            <Link to="/workspace/image-generator" className="text-[#7A3BFF] font-medium hover:underline">
              AI image generator
            </Link>, you can create high-impact visuals in minutes.
          </p>
        </section>

        {/* Section 1 */}
        <section className="mb-24 grid grid-cols-2 gap-12 items-center">
          {/* Image Placeholder */}
          <img src={i18} className="object-cover w-full h-[300px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
            
          </img>

          {/* Text */}
          <div>
            <h2 className="text-[28px] font-semibold text-[#110829] mb-4">
              Focus on Mood, Not Detail
            </h2>
            <p className="text-[#4A4A55] mb-4">
              Beginners often try to describe everything. Viral images do the
              opposite — they focus on mood. Lighting, atmosphere, and emotion
              matter more than tiny details.
            </p>
            <p className="text-[#4A4A55]">
              Prompts that include words like cinematic, soft lighting,
              dramatic shadows, or calm atmosphere consistently perform better
              when generated through{" "}
              <Link to="/home" className="text-[#7A3BFF] font-medium hover:underline">
                AI creative tools
              </Link>.
            </p>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px w-full bg-[#ECE8F2] mb-24" />

        {/* Section 2 */}
        <section className="mb-24 grid grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <h2 className="text-[28px] font-semibold text-[#110829] mb-4">
              Use Simple Prompts With Clear Intent
            </h2>
            <p className="text-[#4A4A55] mb-4">
              You don’t need complex prompt engineering. The best results come
              from simple, intentional prompts that describe a single idea
              clearly.
            </p>
            <p className="text-[#4A4A55]">
              Many creators reuse the same prompt structure and generate
              dozens of variations using{" "}
              <Link to="/workspace/image-generator" className="text-[#7A3BFF] font-medium hover:underline">
                AI image platforms
              </Link>.
            </p>
          </div>

          {/* Image Placeholder */}
          <img src={i20} className="object-cover w-full h-[300px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
            
          </img >   
        </section>

        {/* Tips */}
        <section className="mb-24">
          <h2 className="text-[30px] font-semibold text-[#110829] mb-6">
            Quick Tips for Scroll-Stopping Results
          </h2>
          <ul className="space-y-4 text-[#4A4A55]">
            <li>• Use strong lighting words (cinematic, soft, dramatic)</li>
            <li>• Include one clear subject</li>
            <li>• Avoid clutter and over-description</li>
            <li>• Stick to one visual style consistently</li>
            <li>• Generate multiple variations and pick the best</li>
          </ul>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-[#ECE8F2] bg-white p-12 text-center">
          <h3 className="text-[28px] font-semibold text-[#110829] mb-4">
            Start Creating Scroll-Stopping Images Today
          </h3>
          <p className="text-[#4A4A55] mb-8 max-w-2xl mx-auto">
            No design skills required. Just pick a style, write a simple prompt,
            and let AI handle the rest.
          </p>
          <Link
            to="/workspace/image-generator"
            className="inline-block rounded-xl bg-[#7A3BFF] px-12 py-4 text-white font-semibold hover:opacity-90 transition"
          >
            Try the AI Image Generator
          </Link>
        </div>

      </div>
   <div className="mt-12">
                                       <RelatedArticles articles={related} />
                                     </div>

      <Footer />
    </div>
  );
}
