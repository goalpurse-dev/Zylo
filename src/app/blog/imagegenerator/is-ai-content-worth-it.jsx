import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Make Money With AI-Generated Content in 2026",
    description: "Four real monetization paths, and why consistent volume matters more than one viral hit.",
    date: "21.08.2026",
    slug: "/blog/how-to-make-money-ai-content",
  },
  {
    title: "Best Free AI Tools for Content Creators in 2026",
    description: "What to look for in a free tier before committing time to it.",
    date: "21.08.2026",
    slug: "/blog/best-free-ai-tools-creators",
  },
  {
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
];

const HONEST_POINTS = [
  { title: "Where it clearly wins", desc: "Volume and consistency. Producing daily short-form content by hand is a real time cost; AI generation removes most of it, which is what makes a repeatable posting cadence realistic for one person.", positive: true },
  { title: "Where it clearly loses", desc: "Fully custom, one-off creative work that depends on total manual control over every frame — AI generation is faster, not infinitely flexible.", positive: false },
  { title: "The real trade-off", desc: "You're trading some fine-grained creative control for speed and consistency. For high-volume formats built around a repeatable structure, that trade is usually worth it.", positive: true },
  { title: "What it doesn't replace", desc: "Judgment — deciding which ideas are worth generating, when to post, and what to make more of still takes a person paying attention to what's actually performing.", positive: false },
];

const FAQS = [
  {
    q: "Is AI-generated content actually worth the cost?",
    a: "For formats built around repeatable structure and volume — series, trends, templates — the time saved almost always outweighs the cost. For fully custom one-off work, traditional production may still make more sense.",
  },
  {
    q: "Does AI content perform worse than traditionally made content?",
    a: "Performance depends far more on format, hook, and consistency than on how the content was produced. A well-structured AI-generated series can outperform inconsistent manual content.",
  },
  {
    q: "What's the honest downside people don't mention?",
    a: "It's easy to over-rely on volume and skip the judgment part — picking strong premises and reading what's actually performing. AI removes production friction, not the need for a strategy.",
  },
];

export default function IsAiContentWorthIt() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Is AI Content Creation Worth It?</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Honest Breakdown
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Is AI Content Creation Worth It in 2026? An Honest Breakdown
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Where AI generation clearly wins, where it clearly doesn't, and the real trade-off underneath the hype.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Honest Breakdown</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/is-ai-content-worth-it-hero.png"
              alt="A glowing golden globe balanced against a soft white cloud on an elegant scale"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/is-ai-content-worth-it-coins.png"
              alt="A cluster of glowing golden coin-like spheres viewed from above"
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
              The honest answer depends entirely on what you're trying to produce. Here's the breakdown without the sales pitch.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {HONEST_POINTS.map((p) => (
                <div key={p.title} className={`rounded-xl border p-5 ${p.positive ? "border-[#D8CFF0] bg-white" : "border-[#E5E0F5] bg-[#FBFAFE]"}`}>
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{p.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The formats where it makes the most sense</h2>
            <p className="text-[17px] leading-relaxed">
              Structured, repeatable formats — a recurring series, a proven visual style, a consistent posting cadence — are exactly where AI generation removes the most friction, because the creative decisions are made once and then reused. See{" "}
              <Link to="/blog/how-to-make-money-ai-content" className="text-[#7A3BFF] hover:underline font-semibold">how that consistency actually pays off</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Try it before deciding</h2>
            <p className="text-[17px] leading-relaxed">
              The fastest way to answer this for yourself is to test a free tier on one format and judge the result directly. See{" "}
              <Link to="/blog/best-free-ai-tools-creators" className="text-[#7A3BFF] hover:underline font-semibold">what to look for in a free tier</Link>{" "}
              before committing.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try Zyvo Free</h2>
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
