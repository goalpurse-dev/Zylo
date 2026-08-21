import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
  {
    title: "The Ultimate Zyvo Template Comparison: All 9 Tools Side by Side",
    description: "Every Zyvo template compared in one reference table.",
    date: "21.08.2026",
    slug: "/blog/zyvo-template-comparison",
  },
  {
    title: "How to Repurpose One AI Video Into 10 Pieces of Content",
    description: "Four ways to split one multi-scene generation into a full week of posts.",
    date: "21.08.2026",
    slug: "/blog/repurpose-one-video-ten-pieces",
  },
  {
    title: "Which Zyvo Template Should You Start With? A Quick Decision Guide",
    description: "Match what you want to make to the right Zyvo tool in under two minutes.",
    date: "21.08.2026",
    slug: "/blog/which-zyvo-template",
  },
];

const STAGES = [
  {
    n: "1",
    title: "Generate",
    desc: "Pick a tool that matches your idea and generate your content — a fruit-drama scene, a 2AM world, a rescue clip, or any other format.",
    links: [
      { label: "AI Fruit Story", href: "/ai-fruit-story-maker" },
      { label: "2AM Worlds", href: "/2am-worlds-ai-generator" },
      { label: "Behind the Scenes", href: "/behind-the-scenes-video-maker" },
      { label: "Clay Rescue", href: "/clay-rescue-maker" },
      { label: "Micro Camera Animal", href: "/micro-camera-animal-maker" },
      { label: "Face ASMR", href: "/face-asmr-maker" },
      { label: "Cartoon Drive-By", href: "/cartoon-drive-by-video-maker" },
      { label: "Footballer Nationality Swap", href: "/footballer-nationality-swap-ai" },
      { label: "AI Image Generator", href: "/image-generator" },
    ],
  },
  {
    n: "2",
    title: "Connect",
    desc: "Link your Instagram, TikTok, and YouTube accounts once — every account you connect becomes available across the rest of the workspace.",
    links: [{ label: "Zyvo Connections", href: "/connections" }],
  },
  {
    n: "3",
    title: "Publish",
    desc: "Schedule your generated content to one or all three platforms from a single dashboard, up to 28 days in advance.",
    links: [{ label: "Zyvo Publish", href: "/publish" }],
  },
  {
    n: "4",
    title: "Measure",
    desc: "Check your connected YouTube channel's performance — views, watch time, subscriber growth — to decide what to generate next.",
    links: [{ label: "Zyvo Stats", href: "/stats" }],
  },
];

export default function ZyvoContentWorkflow() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Zyvo Content Workflow</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            The Complete Zyvo Content Workflow: From Idea to Published Post
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Generate, connect, publish, measure — how every Zyvo tool fits into one repeatable loop, from a blank idea to a tracked, published post.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 7 min read · Complete Guide</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/zyvo-content-workflow-hero.png"
            alt="An abstract glowing purple pipeline of light flowing through several transformation stages into a large bright finished orb"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <p className="text-[17px] leading-relaxed">
              Zyvo isn't one tool — it's a loop. Generate content in a format-specific tool, connect your accounts once, publish on a schedule, then measure what worked before generating the next piece. Here's how the four stages fit together.
            </p>
          </section>

          <section>
            <div className="space-y-4">
              {STAGES.map((s) => (
                <div key={s.n} className="rounded-2xl border border-[#E5E0F5] bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[22px] font-black text-[#D8CFF0] leading-none">{s.n}</span>
                    <h3 className="text-[18px] font-bold text-[#110829] m-0">{s.title}</h3>
                  </div>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed mb-4">{s.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {s.links.map((l) => (
                      <Link
                        key={l.href}
                        to={l.href}
                        className="rounded-full border border-[#E5E0F5] bg-[#F7F5FA] px-3.5 py-1.5 text-[12px] font-semibold text-[#7A3BFF] hover:border-[#7A3BFF]/40 hover:bg-purple-50 transition"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Why the loop matters more than any single step</h2>
            <p className="text-[17px] leading-relaxed">
              Generating great content without a publishing rhythm limits its reach. Publishing consistently without checking what's working means repeating mistakes. The workflow only pays off as a full loop — generate, connect, publish, measure, then generate again with what you learned.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Start the Loop</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Not sure which tool to generate with first? See{" "}
              <Link to="/blog/which-zyvo-template" className="text-[#7A3BFF] hover:underline font-semibold">the quick decision guide</Link>{" "}
              or{" "}
              <Link to="/blog/zyvo-template-comparison" className="text-[#7A3BFF] hover:underline font-semibold">compare every tool side by side</Link>.
            </p>
            <Link
              to="/signup"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Start Creating Free →
            </Link>
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
