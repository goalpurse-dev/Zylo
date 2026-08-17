import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Spot the Next Viral AI Trend Before It Blows Up",
    description: "The signals that show up right before a format explodes, and how to act on them early.",
    date: "16.08.2026",
    slug: "/blog/how-to-spot-viral-ai-trend",
  },
  {
    title: "Why \"Imperfect\" AI Videos Are Beating Polished Content Right Now",
    description: "The authenticity trick behind the biggest AI video formats of 2026.",
    date: "16.08.2026",
    slug: "/blog/imperfect-ai-videos-winning",
  },
];

const TRENDS = [
  { n: "01", title: "Behind the Scenes", desc: "A giant practical disaster hits a handcrafted miniature city, with a full-size effects crew for scale — looks like leaked movie-set footage.", href: "/behind-the-scenes-video-maker" },
  { n: "02", title: "2AM Worlds", desc: "Quiet, cinematic worlds imagined after midnight — nostalgic, liminal, and endlessly rewatchable.", href: "/2am-worlds-ai-generator" },
  { n: "03", title: "Cartoon Drive-By", desc: "A fictional cartoon or game destination passing by the window of a moving car, train, bus, or plane.", href: "/cartoon-drive-by-video-maker" },
  { n: "04", title: "Footballer Nationality Swap", desc: "Any footballer, reimagined representing a different nation — new jersey, new name, a talking media-day intro.", href: "/footballer-nationality-swap-ai" },
  { n: "05", title: "AI Fruit Story", desc: "Multi-scene fruit drama videos with talking characters and a real story arc — reveal, betrayal, comeback.", href: "/ai-fruit-story-maker" },
  { n: "06", title: "Face ASMR", desc: "Close-up, sound-led face transformation videos built for the scroll-stopping ASMR audience.", href: "/face-asmr-maker" },
  { n: "07", title: "Clay Rescue", desc: "A tiny clay disaster, a giant hand reaching in to fix it — satisfying, high-retention rescue format.", href: "/clay-rescue-maker" },
  { n: "08", title: "Micro Camera Animal", desc: "A tiny bodycam strapped to an animal, exploring the world from a scale no real camera could reach.", href: "/micro-camera-animal-maker" },
];

export default function WhatsHotRightNowAiTrends() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>What's Hot Right Now</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Trend Report
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What's Hot Right Now: 8 AI Video Trends Creators Are Riding in 2026
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Eight formats currently driving the most reach on TikTok, Reels, and Shorts — what each one actually is, why it's working, and where to generate your first one.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 16, 2026 · 7 min read · Trend Report</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/whats-hot-right-now-ai-trends-hero.png"
            alt="Several smartphone screens glowing in a dark room, one held up close showing a bright scrolling feed"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-6 text-[#374151]">
          <p className="text-[17px] leading-relaxed">
            None of these are one-hit-wonder gimmicks — each one is a repeatable format with its own generator, its own visual rules, and a clear reason it's spreading right now. Here's the current lineup.
          </p>
        </div>

        <div className="mt-10 space-y-4 max-w-4xl">
          {TRENDS.map((t) => (
            <Link
              key={t.n}
              to={t.href}
              className="group flex items-start gap-5 rounded-2xl border border-[#ECE8F2] bg-white p-6 transition hover:border-[#7A3BFF]/40 hover:shadow-md"
            >
              <span className="text-[26px] font-black text-purple-200 leading-none shrink-0">{t.n}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[19px] font-bold text-[#110829] mb-1.5 flex items-center gap-2">
                  {t.title}
                  <ArrowRight className="h-4 w-4 text-[#7A3BFF] opacity-0 -translate-x-1 transition group-hover:opacity-100 group-hover:translate-x-0" aria-hidden="true" />
                </h2>
                <p className="text-[14px] text-[#6b7280] leading-relaxed">{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="prose-custom max-w-3xl space-y-6 text-[#374151] mt-14">
          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Not Sure Where to Start?</h2>
            <p className="text-[17px] leading-relaxed">
              If you want to understand what makes these specific formats work — not just what they are —{" "}
              <Link to="/blog/imperfect-ai-videos-winning" className="text-[#7A3BFF] hover:underline font-semibold">
                read why "imperfect" videos are outperforming polished content right now
              </Link>
              , or learn{" "}
              <Link to="/blog/how-to-spot-viral-ai-trend" className="text-[#7A3BFF] hover:underline font-semibold">
                how to catch the next one early
              </Link>
              .
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Pick One and Start</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Every format above has its own dedicated generator in Zyvo — pick the one that fits your niche and generate your first video today.
            </p>
            <Link
              to="/workspace/home"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Explore All Zyvo Tools →
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
