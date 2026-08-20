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
];

const STEPS = [
  { n: "1", title: "Create your account", desc: "Sign up with your email — no payment required to start generating with your free credit balance." },
  { n: "2", title: "Pick a tool that matches your idea", desc: "Zyvo is organized around specific formats — AI Fruit Story, 2AM Worlds, Clay Rescue, Micro Camera Animal, Face ASMR, the general image generator, and more. Pick the one that fits what you want to make." },
  { n: "3", title: "Describe your idea in plain language", desc: "No prompt-engineering knowledge required — describe the premise, world, or scene, and the tool handles the format-specific structure." },
  { n: "4", title: "Review and generate", desc: "Preview your setup, then generate. Progress shows in your workspace while the content is created." },
  { n: "5", title: "Download or publish directly", desc: "Export your finished video or image, or send it straight into Zyvo's publishing workflow to schedule and post." },
];

const FAQS = [
  {
    q: "Do I need any design or video editing experience?",
    a: "No. Every Zyvo tool is built around describing what you want in plain language — no timeline editing, animation, or design software is required for the core workflow.",
  },
  {
    q: "Which tool should I try first?",
    a: "If you're not sure, start with the general AI image generator to get a feel for prompting, or pick whichever format-specific tool matches content you already enjoy watching.",
  },
  {
    q: "Can I try Zyvo without paying?",
    a: "Yes — every tool has a free entry point using your account's credit balance. See the pricing guide for how credits work.",
  },
  {
    q: "How do I publish what I generate?",
    a: "Zyvo's workspace includes a publishing tool for scheduling and posting directly to TikTok, Instagram, and YouTube without switching platforms.",
  },
];

export default function HowToGetStartedWithZyvo() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>How to Get Started with Zyvo</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Getting Started
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How to Get Started with Zyvo: A Complete Beginner's Guide
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            From account creation to your first finished video, in five steps — no editing software, no design experience, no prompt-engineering knowledge required.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Getting Started</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/how-to-get-started-zyvo-hero.png"
              alt="An abstract glowing purple doorway opening into a bright swirling galaxy of colorful creative shapes"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/how-to-get-started-zyvo-steps.png"
              alt="Three glowing abstract stepping stones made of purple light ascending upward into bright light"
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
              Getting from a blank account to your first finished video takes five steps, and most of them take under a minute. Here's the complete path.
            </p>
          </section>

          <section>
            <div className="space-y-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-xl border border-[#E5E0F5] bg-white p-5 flex gap-4">
                  <span className="text-[20px] font-black text-[#D8CFF0] leading-none shrink-0">{s.n}</span>
                  <div>
                    <p className="text-[15px] font-bold text-[#110829] mb-1">{s.title}</p>
                    <p className="text-[14px] text-[#6b7280] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Not sure which tool to start with?</h2>
            <p className="text-[17px] leading-relaxed">
              See{" "}
              <Link to="/blog/what-is-zyvo" className="text-[#7A3BFF] hover:underline font-semibold">the complete platform overview</Link>{" "}
              for every tool in one place, or jump straight into the general{" "}
              <Link to="/image-generator" className="text-[#7A3BFF] hover:underline font-semibold">AI image generator</Link>{" "}
              if you just want to try generating something right away.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Create Your Account</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Sign up free and generate your first piece of content today.
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
