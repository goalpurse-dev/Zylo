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
    description: "From account creation to your first finished video, step by step.",
    date: "21.08.2026",
    slug: "/blog/how-to-get-started-with-zyvo",
  },
  {
    title: "Is AI Fruit Story Free? Pricing, Credits, and What You Actually Get",
    description: "Character portraits, scene images, and scene video — what a story actually costs.",
    date: "19.08.2026",
    slug: "/blog/ai-fruit-story-pricing",
  },
];

const COST_FACTORS = [
  { title: "Which tool you're using", desc: "Different formats have different generation costs — a single image costs less than a multi-scene animated video." },
  { title: "How many scenes or images", desc: "More scenes or images in one generation means more credits used for that generation." },
  { title: "Whether you animate", desc: "Turning a still image into an animated, sound-enabled video costs more than the image alone." },
  { title: "Resolution and quality settings", desc: "Higher-resolution or higher-quality output options use more credits per generation than standard settings." },
];

const FAQS = [
  {
    q: "Is Zyvo actually free?",
    a: "Zyvo has a free entry point across its tools, using your account's credit balance. Free usage is generally best suited to trying tools and generating shorter, simpler content — paid plans and additional credits unlock higher volume and longer, more complex generations.",
  },
  {
    q: "How does the credit system work?",
    a: "Every generation costs credits based on the tool, the number of scenes or images, and whether the output is animated. Your account has a credit balance that's checked before each generation starts.",
  },
  {
    q: "What happens if I don't have enough credits?",
    a: "The generator lets you know before starting if your balance isn't enough to complete the generation you've configured — you won't be charged partway through and left with an incomplete result.",
  },
  {
    q: "Do unused credits expire?",
    a: "Check your account and plan details in Zyvo's workspace for the most current information on credit balances and any plan-specific terms.",
  },
];

export default function IsZyvoFree() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Is Zyvo Free</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Pricing Explained
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Is Zyvo Free? Pricing, Plans, and Credits Explained
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Zyvo runs on a credit system across every tool, not a single flat subscription. Here's exactly what determines cost, and how to get the most out of a free account.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Pricing Explained</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/is-zyvo-free-hero.png"
              alt="An abstract glowing purple credit coin made of light with a glossy metallic surface"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/is-zyvo-free-credits.png"
              alt="A cluster of small glowing purple light orbs floating together like credits"
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The short answer</h2>
            <p className="text-[17px] leading-relaxed">
              Yes — Zyvo has a free entry point across every tool, using your account's credit balance. There's no single flat price per video; cost is credit-based and scales with how much you generate, so "free" in practice means starting with shorter, simpler generations and scaling up as needed.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">What actually determines cost</h2>
            <div className="space-y-3">
              {COST_FACTORS.map((c) => (
                <div key={c.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{c.title}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Getting the most from a free account</h2>
            <p className="text-[17px] leading-relaxed">
              Start with shorter generations — fewer scenes, images instead of full animation — to test a tool and an idea before committing more credits to a longer, fully animated version. This is the same approach that works across every individual Zyvo tool, whether you're testing an AI Fruit Story premise or a Clay Rescue scenario.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try Zyvo Free</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Create an account and try any tool with your free credit balance. New to Zyvo? Start with{" "}
              <Link to="/blog/how-to-get-started-with-zyvo" className="text-[#7A3BFF] hover:underline font-semibold">the complete beginner's guide</Link>.
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
