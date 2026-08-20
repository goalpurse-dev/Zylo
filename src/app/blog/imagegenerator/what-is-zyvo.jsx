import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Get Started with Zyvo: A Complete Beginner's Guide",
    description: "From account creation to your first finished video, in five steps.",
    date: "21.08.2026",
    slug: "/blog/how-to-get-started-with-zyvo",
  },
  {
    title: "Is Zyvo Free? Pricing, Plans, and Credits Explained",
    description: "How the credit system works, and how to get the most from a free account.",
    date: "21.08.2026",
    slug: "/blog/is-zyvo-free",
  },
  {
    title: "Zyvo vs Other AI Content Tools: What Makes It Different",
    description: "The real structural differences between format-specific tools and a generic prompt box.",
    date: "21.08.2026",
    slug: "/blog/zyvo-vs-other-ai-tools",
  },
  {
    title: "What Is AI Fruit Story? The Complete Guide to TikTok's Viral Cartoon Drama Trend",
    description: "What it is, how it's made, why it's going viral, and how to make your own.",
    date: "18.08.2026",
    slug: "/blog/what-is-ai-fruit-story",
  },
];

const TOOLS = [
  { name: "AI Image Generator", desc: "Cinematic, 3D, anime, realistic, and product-ready images from one prompt.", href: "/image-generator" },
  { name: "AI Fruit Story Maker", desc: "Multi-scene cinematic fruit drama videos with talking, animated characters.", href: "/ai-fruit-story-maker" },
  { name: "2AM Worlds Generator", desc: "Turn any world, game, or reference into six cinematic 2AM night scenes.", href: "/2am-worlds-ai-generator" },
  { name: "Behind the Scenes", desc: "Movie-set footage of a giant practical disaster hitting a handcrafted miniature city.", href: "/behind-the-scenes-video-maker" },
  { name: "Clay Rescue", desc: "A giant hand rescues tiny clay people from everyday disasters.", href: "/clay-rescue-maker" },
  { name: "Micro Camera Animal", desc: "A tiny camera follows a real animal into its own underground world.", href: "/micro-camera-animal-maker" },
  { name: "Face ASMR", desc: "Turn any uploaded face into a satisfying, glossy ASMR texture video.", href: "/face-asmr-maker" },
  { name: "Cartoon Drive-By", desc: "A fictional cartoon or game-inspired destination, passed from inside a moving vehicle.", href: "/cartoon-drive-by-video-maker" },
  { name: "Footballer Nationality Swap", desc: "Picture any footballer representing a different nation, with a talking intro clip.", href: "/footballer-nationality-swap-ai" },
];

const FAQS = [
  {
    q: "What is Zyvo?",
    a: "Zyvo is an AI content creation platform for short-form video and image generation — a single workspace covering image generation, viral video templates (AI Fruit Story, 2AM Worlds, Behind the Scenes, Clay Rescue, Micro Camera Animal, Face ASMR, and more), scripting, and publishing.",
  },
  {
    q: "Is Zyvo free to use?",
    a: "Zyvo has a free entry point across its tools, with paid plans and credits for higher-volume generation, longer videos, and premium templates.",
  },
  {
    q: "Do I need any design or editing skills?",
    a: "No — every tool is built around describing what you want in plain language. No timeline editing, animation, or design software is required for the core workflow of any Zyvo tool.",
  },
  {
    q: "What platforms is Zyvo's content built for?",
    a: "Every tool outputs vertical, short-form-ready content built for TikTok, Instagram Reels, and YouTube Shorts.",
  },
];

export default function WhatIsZyvo() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>What Is Zyvo</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What Is Zyvo? The AI Content Creation Platform Explained
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            One workspace, nine tools, zero editing software. Here's exactly what Zyvo is, what you can make with it, and how the tools fit together.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 20, 2026 · 7 min read · Complete Guide</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/what-is-zyvo-hero.png"
            alt="An abstract flowing sculpture of intertwining purple, violet, and blue light ribbons"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The short answer</h2>
            <p className="text-[17px] leading-relaxed">
              Zyvo is an AI content creation platform built for short-form video and image content — a single workspace where you describe an idea in plain language and get a finished, post-ready video or image back. Instead of one general-purpose generator, Zyvo is organized around specific, proven viral formats, each with its own consistent visual style and generation logic.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Every Zyvo tool, in one place</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {TOOLS.map((t) => (
                <Link key={t.href} to={t.href} className="group rounded-xl border border-[#E5E0F5] bg-white p-5 hover:border-[#7A3BFF]/40 transition">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5 group-hover:text-[#7A3BFF]">{t.name}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{t.desc}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why format-specific tools instead of one generic generator</h2>
            <p className="text-[17px] leading-relaxed">
              A general-purpose "type anything, get any video" tool has to guess at style, pacing, and structure every time. Zyvo's format-specific tools already know the visual rules, camera language, and story structure that make each format work — you provide the idea, and the tool handles everything that would otherwise require deep prompt-engineering knowledge to get right.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How the tools fit together</h2>
            <p className="text-[17px] leading-relaxed">
              Most workflows start with an idea, generate it in the matching tool, and finish in Zyvo's publishing workspace — scheduling and posting directly to TikTok, Instagram, and YouTube without switching platforms. The AI image generator underpins several of the other tools and is also useful entirely on its own, for product photos, thumbnails, or standalone social content.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Start Creating</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a tool above that matches what you want to make, or start with the{" "}
              <Link to="/image-generator" className="text-[#7A3BFF] hover:underline font-semibold">AI image generator</Link>{" "}
              if you're not sure where to begin.
            </p>
            <Link
              to="/signup"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Start Creating Free →
            </Link>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <div key={f.q} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-2">{f.q}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        <div className="mt-20">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
