import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Schedule & Auto-Publish AI Videos in 2026 (One-Click Guide)",
    description: "Plan up to 28 days ahead and publish AI videos to Instagram, TikTok, and YouTube.",
    date: "02.07.2026",
    slug: "/blog/schedule-auto-publish-ai-videos",
  },
  {
    title: "What Is Zyvo Connections? Managing Your Social Accounts",
    description: "How the connection layer behind Publish and Stats actually works.",
    date: "21.08.2026",
    slug: "/blog/what-is-zyvo-connections",
  },
  {
    title: "The Complete Zyvo Content Workflow: From Idea to Published Post",
    description: "How every Zyvo tool connects — generation, publishing, and analytics — in one workflow.",
    date: "21.08.2026",
    slug: "/blog/zyvo-content-workflow",
  },
];

const FAQS = [
  {
    q: "What is Zyvo Publish?",
    a: "Zyvo Publish is a scheduling and posting tool built into the Zyvo workspace — it lets you prepare, schedule, and publish content to Instagram, TikTok, and YouTube from one dashboard instead of uploading separately in each app.",
  },
  {
    q: "Which platforms does Zyvo Publish support?",
    a: "Instagram, TikTok, and YouTube. You can choose one platform or send the same video to all three in a single publishing workflow.",
  },
  {
    q: "How far in advance can I schedule posts?",
    a: "You can plan and schedule posts up to 28 days in advance. The posting queue shows what's coming next, so you can fill gaps before they become missed posting days.",
  },
  {
    q: "Can I publish to multiple accounts at once?",
    a: "Yes — select your connected accounts when you create a post, add the platform details, and publish from one screen. Zyvo handles the separate platform jobs in the background.",
  },
  {
    q: "How do I track a post's status?",
    a: "Zyvo shows the status of each platform job as it moves from queued to preparing, processing, publishing, and published, with past publications kept together with their captions, dates, and links.",
  },
];

export default function WhatIsZyvoPublish() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>What Is Zyvo Publish</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What Is Zyvo Publish? Scheduling and Posting Explained
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            One dashboard for Instagram, TikTok, and YouTube — plan up to 28 days ahead and publish without switching apps.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Complete Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-publish-hero.png"
              alt="An abstract glowing purple grid made of light with glowing dots marking select intersections"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-publish-schedule.png"
              alt="An abstract glowing purple queue of small floating rectangular light panels arranged in sequence"
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
              Zyvo Publish is the scheduling and posting layer of the Zyvo workspace. Instead of exporting a video and uploading it separately to Instagram, TikTok, and YouTube, Publish lets you prepare a post once and send it to any or all three from a single dashboard — with scheduling up to 28 days ahead.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How a post moves through Publish</h2>
            <p className="text-[17px] leading-relaxed">
              Every post moves through a clear status pipeline — queued, preparing, processing, publishing, then published — so you always know exactly where a scheduled post stands. Past publications stay together with their captions, dates, and links, giving you a running record of everything you've posted.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Where content comes from</h2>
            <p className="text-[17px] leading-relaxed">
              Publish is the natural last step after generating content in any Zyvo tool — AI Fruit Story, 2AM Worlds, Behind the Scenes, or any other template. See{" "}
              <Link to="/blog/zyvo-content-workflow" className="text-[#7A3BFF] hover:underline font-semibold">the complete content workflow</Link>{" "}
              for how generation, publishing, and analytics fit together end to end.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Start Scheduling</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Connect your accounts and schedule your first post.
            </p>
            <Link
              to="/publish"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Zyvo Publish →
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
