import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is Zyvo Publish? Scheduling and Posting Explained",
    description: "One dashboard for Instagram, TikTok, and YouTube — plan up to 28 days ahead.",
    date: "21.08.2026",
    slug: "/blog/what-is-zyvo-publish",
  },
  {
    title: "What Is Zyvo Stats? Understanding Your YouTube Analytics",
    description: "A focused analytics dashboard that tracks the metrics that actually explain performance.",
    date: "21.08.2026",
    slug: "/blog/what-is-zyvo-stats",
  },
  {
    title: "How to Cross-Promote Between Zyvo Formats: Turn One Audience Into Many",
    description: "How a fan of one format becomes a viewer of another.",
    date: "21.08.2026",
    slug: "/blog/cross-promote-zyvo-formats",
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
    q: "What is Zyvo Connections?",
    a: "Zyvo Connections is the account-management layer behind Publish and Stats — it's where you connect, organize, and disconnect your Instagram, TikTok, and YouTube accounts.",
  },
  {
    q: "Which platforms can I connect?",
    a: "Instagram, TikTok, and YouTube. You can connect a professional Instagram Creator or Business account for direct publishing through Zyvo's supported workflow.",
  },
  {
    q: "Can I connect more than one account per platform?",
    a: "Yes — you can add more than one account for a platform and select the intended destination inside your publishing workflow.",
  },
  {
    q: "Can I disconnect an account?",
    a: "Yes, at any time. Disconnecting an account removes it from the accounts available to Publish and Stats.",
  },
];

export default function WhatIsZyvoConnections() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>What Is Zyvo Connections</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What Is Zyvo Connections? Managing Your Social Accounts
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The connection layer behind Publish and Stats — bring Instagram, TikTok, and YouTube into one workspace and manage every account from a single place.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Complete Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-connections-hero.png"
              alt="An abstract glowing purple network of three connected nodes made of light"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-connections-links.png"
              alt="An abstract glowing purple chain link made of two interlocking glossy rings"
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
              Zyvo Connections keeps the channels used by Publish and Stats organized in one place — connect your Instagram, TikTok, and YouTube accounts once, and every other Zyvo tool that touches publishing or analytics knows which accounts are ready to use.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why a separate connections layer</h2>
            <p className="text-[17px] leading-relaxed">
              Rather than reconnecting an account every time you want to publish or check analytics, Connections handles authentication once and shares that connection across the rest of the workspace. You can add more than one account per platform and choose the right destination each time you publish.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">What connects to what</h2>
            <p className="text-[17px] leading-relaxed">
              A connected account becomes available in{" "}
              <Link to="/blog/what-is-zyvo-publish" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo Publish</Link>{" "}
              for scheduling and posting, and a connected YouTube channel specifically becomes available in{" "}
              <Link to="/blog/what-is-zyvo-stats" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo Stats</Link>{" "}
              for analytics. See{" "}
              <Link to="/blog/zyvo-content-workflow" className="text-[#7A3BFF] hover:underline font-semibold">the complete content workflow</Link>{" "}
              for how all three fit together with content generation.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Connect Your Accounts</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Set up your accounts once, then publish and track from anywhere in Zyvo.
            </p>
            <Link
              to="/connections"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Zyvo Connections →
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
