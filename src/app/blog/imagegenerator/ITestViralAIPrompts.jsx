import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";

import i1 from "../../../assets/inspiration/2.png";
import i2 from "../../../assets/inspiration/5.png";
import i3 from "../../../assets/inspiration/3.png";
import i4 from "../../../assets/inspiration/4.png";
import i5 from "../../../assets/inspiration/16.png";
import i6 from "../../../assets/inspiration/11.png";
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
    title: "How to Improve Ecommerce Visual Trust",
    description: "Boost sales with better product images",
    date: "05.01.2026",
    slug: "/blog/how-to-improve-ecommerce-visual-trust",
  },
];
export default function ITestViralAIPrompts() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-20">

        {/* Header */}
        <div className="mb-16">
          <h1 className="text-[40px] font-bold text-[#110829] leading-tight mb-6">
            I Tested 6 Viral AI Image Prompts — Here Are the Results
          </h1>
          <p className="text-[18px] text-[#4A4A55] max-w-3xl">
            AI images are dominating TikTok, Pinterest, and Instagram.
            But which prompts actually work? I tested viral-style prompts
            creators are using right now — and these are the results.
          </p>
        </div>

        {/* Intro */}
        <div className="mb-20">
          <p className="text-[#4A4A55] mb-4">
            Each image below was generated using a modern{" "}
            <Link to="/home" className="text-[#7A3BFF] font-medium hover:underline">
              AI image generator
            </Link>{" "}
            and follows patterns commonly seen in viral posts.
          </p>
          <p className="text-[#4A4A55]">
            The goal was simple: test realism, mood, and scroll-stopping power.
          </p>
        </div>

        {/* Image Grid */}
        <div className="grid md:grid-cols-2 gap-12 mb-20">
          {[
            {
              title: "Minimal Modern Scene",
              image: i1,
              prompt:
                "minimal modern scene, human silhouette standing in vast open space, soft natural light, clean geometry, subtle movement in clothing, calm atmosphere, neutral tones",
            },
            {
              title: "Minimal Modern Scene (Alt)",
              image: i2,
              prompt:
                "minimal modern scene, lone human silhouette, open environment, soft daylight, smooth shapes, quiet mood, modern minimal aesthetic",
            },
            {
              title: "Viral Urban Scene",
              image: i3,
              prompt:
                "minimal modern scene, watch soft natural light, clean geometry, subtle movement in clothing, calm atmosphere, neutral tones",
            },
            {
              title: "Viral Urban Scene (Alt)",
              image: i4,
              prompt:
                "urban night scene, creator walking confidently, neon reflections, fast motion blur, handheld camera feel, bold color contrast, cinematic lighting",
            },
            {
              title: "Indiana Jones–Style Movie Scene",
              image: i5,
              prompt:
                "movie Indiana Jones style scene, cinematic lighting, dramatic composition, ultra-realistic, clean composition, adventurous atmosphere",
            },
            {
              title: "Adventure Movie Scene (Alt)",
              image: i6,
              prompt:
                "cinematic adventure movie scene, dramatic shadows, realistic textures, epic composition, film still look, high detail",
            },
          ].map((item, i) => (
            <div key={i}>
              <div className="w-full h-[260px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden mb-4">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>

              <h3 className="text-[18px] font-semibold text-[#110829] mb-2">
                {item.title}
              </h3>

              <p className="text-[14px] text-[#4A4A55] leading-relaxed">
                <span className="font-medium text-[#110829]">Prompt:</span>{" "}
                {item.prompt}
              </p>
            </div>
          ))}
        </div>

        {/* Analysis */}
        <div className="mb-20">
          <h2 className="text-[30px] font-semibold text-[#110829] mb-6">
            What Actually Performed Best
          </h2>
          <p className="text-[#4A4A55] mb-4">
            The strongest results came from prompts with clear mood,
            cinematic lighting, and human presence.
          </p>
          <p className="text-[#4A4A55]">
            Minimal scenes performed well for aesthetic feeds, while
            urban night scenes dominated short-form video platforms.
            Most creators reuse these styles using{" "}
            <Link to="/home" className="text-[#7A3BFF] font-medium hover:underline">
              AI creative tools
            </Link>.
          </p>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-[#ECE8F2] bg-white p-12 text-center">
          <h3 className="text-[28px] font-semibold text-[#110829] mb-4">
            Want to Test These Prompts Yourself?
          </h3>
          <p className="text-[#4A4A55] mb-8 max-w-2xl mx-auto">
            Try these viral prompts, tweak the style, and generate
            scroll-stopping visuals in minutes.
          </p>
          <Link
            to="/workspace/image-generator"
            className="inline-block rounded-xl bg-[#7A3BFF] px-12 py-4 text-white font-semibold hover:opacity-90 transition"
          >
            Open the AI Image Generator
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
