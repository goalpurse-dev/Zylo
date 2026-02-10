import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import Human1 from "../../../assets/blog/image-generator/human1.png";
import Human2 from "../../../assets/blog/image-generator/human2.png";
import Human3 from "../../../assets/blog/image-generator/human3.png";
import Human4 from "../../../assets/blog/image-generator/human4.png";
import Dubai from "../../../assets/blog/image-generator/dubai.png";
import Nyc from "../../../assets/blog/image-generator/nyc.png";
import Village from "../../../assets/blog/image-generator/village.png";

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


export default function WhyYourPostsDontGoViral() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        {/* Header */}
        <header className="mb-24">
          <h1 className="text-[44px] font-bold text-[#110829] leading-tight mb-8">
            Why Your Posts Don’t Go Viral (And How AI Images Fix That)
          </h1>
          <p className="text-[19px] text-[#4A4A55] max-w-4xl">
            You’re posting consistently. You’re trying different ideas.
            Yet your posts barely get seen. The problem isn’t effort —
            it’s how social media decides what deserves attention.
          </p>
        </header>

        {/* Intro */}
        <section className="mb-28">
          <p className="text-[#4A4A55] mb-6">
            Going viral isn’t random. Platforms like TikTok, Instagram,
            and Pinterest reward content that instantly captures attention
            and keeps users engaged.
          </p>
          <p className="text-[#4A4A55]">
            AI images are fixing this exact problem by giving creators
            scroll-stopping visuals without cameras, editing, or design
            skills — especially when generated through a modern{" "}
            <Link to="/home" className="text-[#7A3BFF] font-medium hover:underline">
              AI image generator
            </Link>.
          </p>
        </section>

        {/* Problem 1 */}
        <section className="mb-32 grid grid-cols-2 gap-16 items-center">
          {/* Image Placeholder */}
          <div className="w-full h-[340px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
           <img src={Human2} alt="Human 1" className="w-full h-full object-cover rounded-2xl" />
          </div>

          {/* Text */}
          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6">
              Problem #1: Your Content Doesn’t Stop the Scroll
            </h2>
            <p className="text-[#4A4A55] mb-4">
              Most posts fail in the first second. If your content doesn’t
              visually interrupt scrolling, it never gets a chance to perform.
            </p>
            <p className="text-[#4A4A55] mb-4">
              Real photos often blend in because they look familiar.
              AI images, on the other hand, exaggerate lighting, mood,
              and composition just enough to stand out.
            </p>
            <p className="text-[#4A4A55]">
              This is why creators using{" "}
              <Link to="/workspace/image-generator" className="text-[#7A3BFF] font-medium hover:underline">
                AI creative tools
              </Link> see higher retention instantly.
            </p>
          </div>
        </section>

        {/* Problem 2 */}
        <section className="mb-32 grid grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6">
              Problem #2: Inconsistent Visual Identity
            </h2>
            <p className="text-[#4A4A55] mb-4">
              Algorithms favor accounts with recognizable style.
              If every post looks different, platforms struggle to
              categorize and promote your content.
            </p>
            <p className="text-[#4A4A55] mb-4">
              AI images allow creators to lock in one aesthetic and
              reproduce it endlessly — something real photography
              rarely achieves.
            </p>
            <p className="text-[#4A4A55]">
              Consistency becomes effortless when generating content
              inside one{" "}
              <Link to="/workspace/image-generator" className="text-[#7A3BFF] font-medium hover:underline">
                AI image workspace
              </Link>.
            </p>
          </div>

          {/* Image Placeholder */}
          <div className="w-full h-[340px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
            <img src={Human4} alt="Human 2" className="w-full h-full object-cover rounded-2xl" />
          </div>
        </section>

        {/* Problem 3 */}
        <section className="mb-32 grid grid-cols-2 gap-16 items-center">
          {/* Image Placeholder */}
          <div className="w-full h-[340px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
            <img src={Dubai} alt="Human 3" className="w-full h-full object-cover rounded-2xl" />   
          </div>

          {/* Text */}
          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6">
              Problem #3: No Curiosity Trigger
            </h2>
            <p className="text-[#4A4A55] mb-4">
              Viral posts make people pause and think: “Wait — what is this?”
              That moment of curiosity is what drives comments and shares.
            </p>
            <p className="text-[#4A4A55] mb-4">
              AI images naturally trigger this reaction because they often
              sit between realism and fantasy.
            </p>
            <p className="text-[#4A4A55]">
              Creators lean into this effect by generating cinematic visuals
              through{" "}
              <Link to="/workspace" className="text-[#7A3BFF] font-medium hover:underline">
                AI-powered platforms
              </Link>.
            </p>
          </div>
        </section>

        {/* Solution */}
        <section className="mb-32 grid grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6">
              How AI Images Fix All of This
            </h2>
            <p className="text-[#4A4A55] mb-4">
              AI images are built for modern social media.
              They’re optimized for speed, mood, and repetition —
              the exact signals platforms reward.
            </p>
            <p className="text-[#4A4A55] mb-4">
              Instead of spending hours creating one post, creators
              generate multiple variations, test what works, and
              double down on winners.
            </p>
            <p className="text-[#4A4A55]">
              This workflow only works at scale using{" "}
              <Link to="/workspace/image-generator" className="text-[#7A3BFF] font-medium hover:underline">
                AI image tools
              </Link> designed for creators.
            </p>
          </div>

          {/* Image Placeholder */}
          <div className="w-full h-[340px] rounded-2xl border border-[#ECE8F2] bg-white flex items-center justify-center">
            <img src={Nyc} alt="Human 4" className="w-full h-full object-cover rounded-2xl" />
          </div>
        </section>

        {/* Final Section */}
        <section className="mb-28">
          <h2 className="text-[36px] font-semibold text-[#110829] mb-6">
            Viral Reach Is a System — Not Luck
          </h2>
          <p className="text-[#4A4A55] mb-4">
            Once you understand how platforms think, going viral becomes
            predictable. AI images remove friction and let you focus
            on ideas, not execution.
          </p>
          <p className="text-[#4A4A55]">
            The creators winning right now aren’t more talented —
            they’re faster and more consistent.
          </p>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-[#ECE8F2] bg-white p-16 text-center">
          <h3 className="text-[34px] font-semibold text-[#110829] mb-6">
            Fix Your Reach With AI Images
          </h3>
          <p className="text-[#4A4A55] mb-10 max-w-3xl mx-auto">
            Stop guessing. Start creating visuals designed to perform
            on modern social platforms.
          </p>
          <Link
            to="/workspace/image-generator"
            className="inline-block rounded-xl bg-[#7A3BFF] px-16 py-5 text-white font-semibold hover:opacity-90 transition"
          >
            Start Creating With AI
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
