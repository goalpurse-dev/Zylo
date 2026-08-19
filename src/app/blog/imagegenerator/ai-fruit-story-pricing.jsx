import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is AI Fruit Story? The Complete Guide to TikTok's Viral Cartoon Drama Trend",
    description: "What it is, how it's made, why it's going viral, and how to make your own.",
    date: "18.08.2026",
    slug: "/blog/what-is-ai-fruit-story",
  },
  {
    title: "6 Real AI Fruit Story Examples You Can Recreate in Minutes",
    description: "Real preset screenshots from the generator, with the exact opening lines used in each.",
    date: "18.08.2026",
    slug: "/blog/ai-fruit-story-examples",
  },
  {
    title: "AI Fruit Story vs Traditional Animation",
    description: "An honest side-by-side on speed, cost, skill, and character consistency.",
    date: "08.08.2026",
    slug: "/blog/ai-fruit-story-vs-traditional-animation",
  },
];

const COST_BREAKDOWN = [
  {
    title: "Character portraits",
    desc: "Each fruit character in your story gets a consistent portrait generated once, then reused across every scene — this is a flat cost regardless of story length.",
  },
  {
    title: "Scene images",
    desc: "Every scene in the story generates its own image, built around your premise and characters. More scenes means more images means more credits.",
  },
  {
    title: "Scene video / animation",
    desc: "Turning a scene into animated, mouth-synced video costs additional credits per scene, on top of the image cost — this is the most expensive part of a longer story.",
  },
];

const FAQS = [
  {
    q: "Is AI Fruit Story actually free?",
    a: "Zyvo's AI Fruit Story maker has a free entry point — you can generate stories using your account's credit balance. Longer stories with more scenes and full video animation cost more credits than a short one, so \"free\" in practice means starting small and scaling up as you use more credits.",
  },
  {
    q: "How is the cost calculated?",
    a: "Cost is credit-based, not a flat subscription fee per video. Three things add up: a one-time character portrait cost per character, an image cost per scene, and a video cost per scene if you animate it. Shorter stories with fewer characters and scenes cost fewer credits.",
  },
  {
    q: "What happens if I run out of credits mid-story?",
    a: "The generator checks your credit balance before starting a generation and lets you know if you don't have enough to complete the story you've configured, so you're never charged partway through and left with an incomplete result.",
  },
  {
    q: "Does adding more characters cost more?",
    a: "Yes — each additional character needs its own consistent portrait generated once, which adds to the total cost before scene generation even starts.",
  },
  {
    q: "Can I generate a cheaper version to test a premise?",
    a: "Yes — using fewer scenes and fewer characters is the most direct way to lower the cost of a single generation while you're testing an idea before committing to a full story.",
  },
];

export default function AIFruitStoryPricing() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Pricing</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Pricing Explained
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Is AI Fruit Story Free? Pricing, Credits, and What You Actually Get
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            AI Fruit Story runs on credits, not a flat per-video price. Here's exactly what you're paying for — character portraits, scene images, and scene video — so you know what a story actually costs before you generate one.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 19, 2026 · 6 min read · Pricing Explained</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-pricing-hero.png"
            alt="A stylized 3D cartoon orange character holding a glowing gold coin with a curious expression"
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
              AI Fruit Story is credit-based. There's a free entry point using your account's credit balance, and the actual cost of any single generation depends on how many characters you use and how many scenes your story has — not a flat price per video. A short, two-character story with a few scenes costs meaningfully less than a long one with full video animation on every scene.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">What you're actually paying for</h2>
            <div className="space-y-3">
              {COST_BREAKDOWN.map((c) => (
                <div key={c.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{c.title}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How to keep costs down while testing an idea</h2>
            <p className="text-[17px] leading-relaxed">
              Start with two characters and a short scene count to test whether a premise actually works before committing more credits to a full, animated version. Since character portraits are a one-time cost per character, reusing the same cast across multiple story ideas is more efficient than starting fresh with new characters every time.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try It With Your Free Credits</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Start with a short, two-character story to see the full workflow before scaling up. For premise ideas, see{" "}
              <Link to="/blog/best-ai-fruit-story-ideas" className="text-[#7A3BFF] hover:underline font-semibold">50 fruit story prompts</Link>.
            </p>
            <Link
              to="/ai-fruit-story-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the AI Fruit Story Tool →
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
