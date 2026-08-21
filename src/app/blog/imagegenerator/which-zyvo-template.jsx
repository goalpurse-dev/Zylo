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
    title: "The Ultimate Zyvo Template Comparison: All 9 Tools Side by Side",
    description: "Every Zyvo tool, its real output format, and what it's actually best for.",
    date: "21.08.2026",
    slug: "/blog/zyvo-template-comparison",
  },
  {
    title: "The Complete Zyvo Content Workflow: From Idea to Published Post",
    description: "Generate, connect, publish, measure — how every Zyvo tool fits into one loop.",
    date: "21.08.2026",
    slug: "/blog/zyvo-content-workflow",
  },
];

const DECISIONS = [
  { if_: "You want dramatic, character-driven storylines", then: "AI Fruit Story Maker", why: "Multi-scene cinematic drama with talking, animated fruit characters — built for soap-opera-style storytelling.", href: "/ai-fruit-story-maker" },
  { if_: "You want nostalgic, atmospheric worldbuilding", then: "2AM Worlds Generator", why: "Turn any world, game, or reference into six cinematic night scenes — no dialogue or plot required.", href: "/2am-worlds-ai-generator" },
  { if_: "You want big, satisfying spectacle", then: "Behind the Scenes", why: "A giant practical disaster hitting a handcrafted miniature city, shot like real movie-set footage.", href: "/behind-the-scenes-video-maker" },
  { if_: "You want a wholesome, feel-good format", then: "Clay Rescue", why: "A giant hand rescues tiny clay people from everyday disasters — gentle stakes, satisfying payoffs.", href: "/clay-rescue-maker" },
  { if_: "You want a curiosity-driven documentary feel", then: "Micro Camera Animal", why: "A tiny camera follows a real animal into its own hidden underground world.", href: "/micro-camera-animal-maker" },
  { if_: "You want to use your own face in content", then: "Face ASMR", why: "Turn your own uploaded photo into a satisfying, glossy ASMR texture video.", href: "/face-asmr-maker" },
  { if_: "You want travel-style visual content", then: "Cartoon Drive-By", why: "A fictional cartoon or game-inspired destination, passed from inside a moving vehicle.", href: "/cartoon-drive-by-video-maker" },
  { if_: "You're building sports content", then: "Footballer Nationality Swap", why: "Picture any footballer representing a different nation, with a talking intro clip.", href: "/footballer-nationality-swap-ai" },
  { if_: "You want general images for any use case", then: "AI Image Generator", why: "Cinematic, 3D, anime, realistic, and product styles from a single prompt — not tied to one specific format.", href: "/image-generator" },
];

export default function WhichZyvoTemplate() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Which Zyvo Template</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Getting Started
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Which Zyvo Template Should You Start With? A Quick Decision Guide
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Nine tools, one decision. Match what you want to make to the right starting point in under two minutes.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Getting Started</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/which-zyvo-template-hero.png"
              alt="An abstract glowing purple compass with multiple pointing directions leading to different colorful shapes"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/which-zyvo-template-paths.png"
              alt="An abstract glowing purple pathway splitting into several branching light trails leading to different destinations"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <p className="text-[17px] leading-relaxed">
              Zyvo's tools are organized around specific, proven formats rather than one general-purpose generator — which makes the first decision less about skill and more about which kind of content you actually want to make. Here's a quick match guide.
            </p>
          </section>

          <section>
            <div className="space-y-3">
              {DECISIONS.map((d) => (
                <Link key={d.href} to={d.href} className="group block rounded-xl border border-[#E5E0F5] bg-white p-5 hover:border-[#7A3BFF]/40 transition">
                  <p className="text-[13px] text-[#9ca3af] mb-1">If: {d.if_}</p>
                  <p className="text-[16px] font-bold text-[#110829] mb-1.5 group-hover:text-[#7A3BFF]">→ {d.then}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{d.why}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Still not sure?</h2>
            <p className="text-[17px] leading-relaxed">
              Start with the general{" "}
              <Link to="/image-generator" className="text-[#7A3BFF] hover:underline font-semibold">AI image generator</Link>{" "}
              — it's the lowest-commitment way to get a feel for how Zyvo works before picking a format-specific tool. See{" "}
              <Link to="/blog/what-is-zyvo" className="text-[#7A3BFF] hover:underline font-semibold">the full platform overview</Link>{" "}
              for every tool in one place.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Start Creating</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Create your free account and generate your first piece of content today.
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
