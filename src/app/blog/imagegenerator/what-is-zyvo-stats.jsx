import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "YouTube Analytics for Creators: A Practical 2026 Guide",
    description: "Understand views, watch time, subscribers, average view duration, and top videos.",
    date: "20.07.2026",
    slug: "/blog/youtube-analytics-for-creators",
  },
  {
    title: "Short-Form Video Metrics That Actually Matter in 2026",
    description: "Evaluate reach, attention, engagement, and audience conversion without relying on views alone.",
    date: "20.07.2026",
    slug: "/blog/short-form-video-metrics-that-matter",
  },
  {
    title: "What Is Zyvo Connections? Managing Your Social Accounts",
    description: "How the connection layer behind Publish and Stats actually works.",
    date: "21.08.2026",
    slug: "/blog/what-is-zyvo-connections",
  },
];

const METRICS = [
  { title: "Views and daily trends", desc: "Total views for your selected period, plus the daily trend to see when momentum starts, slows, or returns." },
  { title: "Subscriber growth", desc: "Net subscriber movement alongside views, to identify videos that attract returning viewers rather than just clicks." },
  { title: "Watch time and average view duration", desc: "How long viewers actually stay, which separates genuinely engaging videos from ones that only look good in view count." },
  { title: "Top and recent videos", desc: "Move from channel-level totals into individual video performance before planning your next idea." },
];

const FAQS = [
  {
    q: "What does Zyvo Stats track?",
    a: "Zyvo Stats currently tracks connected YouTube channel data including views, watch time, subscriber growth, average view duration, daily trends, realtime activity estimates, and top or recent videos.",
  },
  {
    q: "Which date ranges are available?",
    a: "You can review performance across 7, 28, 90, or 365-day windows. Comparing ranges helps separate a short-lived spike from a trend that's still compounding.",
  },
  {
    q: "Does Zyvo Stats support Instagram and TikTok analytics?",
    a: "Full analytics in the current Stats workspace is available for YouTube. Instagram and TikTok are on the roadmap, but their analytics dashboards aren't live features yet.",
  },
  {
    q: "Do I need to connect a YouTube channel?",
    a: "Yes — Zyvo needs a connected YouTube channel to retrieve its analytics. You can manage or disconnect the account from the Connections workspace.",
  },
];

export default function WhatIsZyvoStats() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>What Is Zyvo Stats</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What Is Zyvo Stats? Understanding Your YouTube Analytics
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A focused analytics dashboard that tracks the metrics that actually explain why a video performed the way it did.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Complete Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-stats-hero.png"
              alt="An abstract glowing purple ascending line graph made of light with soft particle trails"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-stats-growth.png"
              alt="An abstract cluster of glowing purple bars of varying heights in a growth pattern"
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
              Zyvo Stats is a focused YouTube analytics dashboard built into the Zyvo workspace. It tracks views, watch time, subscriber growth, average view duration, and individual video performance — currently for connected YouTube channels, with Instagram and TikTok analytics on the roadmap.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">What it actually tracks</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {METRICS.map((m) => (
                <div key={m.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{m.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Turning numbers into decisions</h2>
            <p className="text-[17px] leading-relaxed">
              The real value of Stats is in the videos behind the totals — move from channel-level views and watch time into top and recent video performance before planning what to make next. For a deeper breakdown of which metrics actually matter, see{" "}
              <Link to="/blog/short-form-video-metrics-that-matter" className="text-[#7A3BFF] hover:underline font-semibold">short-form video metrics that matter</Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Check Your Numbers</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Connect your YouTube channel and see your dashboard.
            </p>
            <Link
              to="/stats"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Zyvo Stats →
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
