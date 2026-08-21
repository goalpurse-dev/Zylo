import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Instagram Reels Algorithm Explained: How Reach Actually Works in 2026",
    description: "What actually drives reach on Reels, and where it differs from TikTok.",
    date: "21.08.2026",
    slug: "/blog/instagram-reels-algorithm-explained",
  },
  {
    title: "Short-Form Video Metrics That Actually Matter in 2026",
    description: "Which numbers are worth watching, and which ones are vanity metrics.",
    date: "21.08.2026",
    slug: "/blog/short-form-video-metrics-that-matter",
  },
  {
    title: "What Is Zyvo Publish? Scheduling and Posting Explained",
    description: "One dashboard for Instagram, TikTok, and YouTube — plan up to 28 days ahead.",
    date: "21.08.2026",
    slug: "/blog/what-is-zyvo-publish",
  },
];

const FACTORS = [
  { title: "Completion rate", desc: "Whether viewers watch to the end matters more than almost anything else — a short video watched in full outperforms a long one abandoned halfway through." },
  { title: "Rewatch behavior", desc: "A video someone watches twice signals stronger interest than one watched once, even by a larger audience." },
  { title: "Early engagement speed", desc: "How quickly a video gets watch time, likes, and comments after posting affects how far it's shown beyond your existing audience." },
  { title: "Native format fit", desc: "Vertical, full-frame video built for the platform tends to perform more predictably than content that reads as recycled from somewhere else." },
];

const MYTHS = [
  { myth: "Posting more always helps", reality: "Consistency helps, but only if each post still holds attention — a higher volume of weak content doesn't outperform a lower volume of strong content." },
  { myth: "Hashtags are the main lever", reality: "Hashtags provide minor categorization signal. The hook and completion rate influence reach far more." },
  { myth: "There's a secret best posting time", reality: "When your specific audience is active matters more than any universal 'best time' — it varies by audience, not by a fixed clock." },
];

export default function TiktokAlgorithmExplained() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>TikTok Algorithm Explained</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Growth
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            TikTok Algorithm Explained: What Actually Gets Your Videos Seen in 2026
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            No platform publishes its exact ranking formula. Here's what's consistently observable about what pushes a video further — and two common myths that don't hold up.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Growth</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-stats-growth.png"
              alt="Abstract glowing purple bar chart columns of varying heights representing growth"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-stats-hero.png"
              alt="An abstract glowing purple particle trail rising diagonally like an upward trajectory"
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
              TikTok doesn't publish its exact ranking formula, and it changes over time. What's stayed consistent across changes is which signals reliably correlate with wider reach.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">What consistently correlates with reach</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {FACTORS.map((f) => (
                <div key={f.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{f.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Three myths worth retiring</h2>
            <div className="space-y-3">
              {MYTHS.map((m) => (
                <div key={m.myth} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[14px] font-bold text-[#110829] mb-1">Myth: {m.myth}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">Reality: {m.reality}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">What this means practically</h2>
            <p className="text-[17px] leading-relaxed">
              Since consistency and completion rate matter more than any single trick, a workflow that makes it easy to post often without dropping quality is the most reliable lever you actually control. See{" "}
              <Link to="/blog/what-is-zyvo-publish" className="text-[#7A3BFF] hover:underline font-semibold">how scheduled posting works</Link>{" "}
              in Zyvo.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Build a Consistent Posting Habit</h2>
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
