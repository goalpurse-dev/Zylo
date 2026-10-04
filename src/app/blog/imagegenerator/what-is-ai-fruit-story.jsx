import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";
import { FRUIT_FACTS as F, FRUIT_WHAT_IS_FAQ } from "../../../data/fruitStoryPages.js";
import { optImg } from "../../../lib/optImage.js";

const related = [
  {
    title: "AI Fruit Story Prompts: 50 Copy-Paste Video Ideas",
    description: "Fifty fruit-drama prompts to copy or open straight in the generator.",
    date: "15.05.2026",
    slug: "/blog/best-ai-fruit-story-ideas",
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
  {
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
  {
    title: "The Complete Zyvo Content Workflow: From Idea to Published Post",
    description: "Generate, connect, publish, measure — how every Zyvo tool fits into one loop.",
    date: "21.08.2026",
    slug: "/blog/zyvo-content-workflow",
  },
];

const STEPS = [
  { n: "1", title: "You start the story", desc: "Pick a ready idea, describe your own in a sentence or two, or paste a finished script." },
  { n: "2", title: "You choose the cast and settings", desc: `Up to ${F.maxCastSingle} characters from a library of ${F.characters}, a length from ${F.minLengthSec} seconds to ${F.maxLengthMin} minutes, and the video quality.` },
  { n: "3", title: "The script and scene pictures are made", desc: "Each scene is one character saying one line, and every scene gets its own picture. You check them and edit or regenerate any you don't like." },
  { n: "4", title: "The scenes are animated", desc: "Each picture becomes a short clip of the character saying their line. Nothing is animated before you have approved the pictures." },
  { n: "5", title: "One finished video", desc: "The clips are joined into one video, with captions if you want them, plus a cover image and post text." },
];

export default function WhatIsAIFruitStory() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog/category/fruit-stories" className="hover:text-[#7A3BFF]">Fruit Stories</Link>
          <span className="mx-2">/</span>
          <span>What Is AI Fruit Story</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What Is AI Fruit Story? The Complete Guide to TikTok's Viral Cartoon Drama Trend
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            If you've seen a cast of expressive cartoon fruit characters acting out a cheating reveal or a secret-twin mystery on your For You Page, this is the format — and the complete breakdown of how it works, why it's spreading, and how to make your own.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Updated October 5, 2026 · 8 min read · Complete Guide</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            {...optImg("/blog-assets/what-is-ai-fruit-story-hero.png", "(min-width: 1024px) 896px, 100vw", 960)}
            alt="Three distinct stylized 3D cartoon fruit characters standing together on a dramatic stage under warm spotlight lighting"
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
              AI Fruit Story is a short-form video format where stylized 3D cartoon fruit characters — a mango, a peach, an apple, a pineapple — act out a fictional soap-opera-style storyline: a betrayal, a secret, a reveal, a comeback. Every scene and every line is generated from a text description, not filmed or hand-animated. The finished output is a vertical video built for TikTok, Reels, and Shorts.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How it actually works</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              In Zyvo&apos;s <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">AI fruit story generator</Link>, a video goes through five steps:
            </p>
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">From one video to a series</h2>
            <p className="text-[17px] leading-relaxed">
              The accounts that grow with this format rarely post one-offs. They post a story people follow. Series mode plans {F.minEpisodes} to {F.maxEpisodes} episodes with the same cast before you make the first one: every episode gets a title, a summary and the cliffhanger it ends on. A series bible fixes each character&apos;s role, prop and catchphrase and the places the story returns to, so episode 8 still looks and sounds like episode 1. See{" "}
              <Link to="/ai-fruit-story-maker#series" className="text-[#7A3BFF] hover:underline font-semibold">how series work</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why it's going viral</h2>
            <p className="text-[17px] leading-relaxed">
              Fruit characters strip a familiar story format — the cheating reveal, the family betrayal, the underdog comeback — down to its purest emotional shape. There's no real person to feel awkward about, no cast to coordinate, and the exaggerated cartoon expressions communicate the plot faster than dialogue alone could. Combined with a workflow that takes a sentence instead of a shoot day, that's a format built to be posted daily, not occasionally.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How to make your own</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Start from one of the ready ideas in the tool, open one of the{" "}
              <Link to="/blog/best-ai-fruit-story-ideas" className="text-[#7A3BFF] hover:underline font-semibold">AI fruit story prompts</Link>, or write your own with the{" "}
              <Link to="/blog/ai-fruit-story-prompt-formula" className="text-[#7A3BFF] hover:underline font-semibold">6-part prompt formula</Link>. Making videos needs a paid plan; the{" "}
              <Link to="/blog/ai-fruit-story-pricing" className="text-[#7A3BFF] hover:underline font-semibold">pricing guide</Link> explains what the credits are spent on.
            </p>
            <Link
              to="/ai-fruit-story-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              See the AI Fruit Story Generator →
            </Link>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Frequently asked questions</h2>
            <div className="space-y-3">
              {FRUIT_WHAT_IS_FAQ.map((f) => (
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
