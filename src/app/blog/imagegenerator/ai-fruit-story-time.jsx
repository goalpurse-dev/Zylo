import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Is AI Fruit Story Free? Pricing, Credits, and What You Actually Get",
    description: "Character portraits, scene images, and scene video — what a story actually costs.",
    date: "19.08.2026",
    slug: "/blog/ai-fruit-story-pricing",
  },
  {
    title: "What Is AI Fruit Story? The Complete Guide to TikTok's Viral Cartoon Drama Trend",
    description: "What it is, how it's made, why it's going viral, and how to make your own.",
    date: "18.08.2026",
    slug: "/blog/what-is-ai-fruit-story",
  },
  {
    title: "AI Fruit Story vs Traditional Animation",
    description: "An honest side-by-side on speed, cost, skill, and character consistency.",
    date: "08.08.2026",
    slug: "/blog/ai-fruit-story-vs-traditional-animation",
  },
];

const STEPS = [
  { n: "1", title: "Write or pick a premise", time: "1-2 minutes", desc: "Write your own storyline or start from a preset — this is the only manual step in the whole process." },
  { n: "2", title: "Character generation", time: "Under a minute per character", desc: "Each character gets a consistent portrait generated once, then reused across every scene." },
  { n: "3", title: "Scene generation", time: "Scales with scene count", desc: "Each scene is generated with its own setting and framing — more scenes means more generation time." },
  { n: "4", title: "Dialogue and animation", time: "Scales with scene count", desc: "If you animate scenes with mouth-synced dialogue, this is the step that takes the longest per scene." },
];

export default function AIFruitStoryTime() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>How Long Does AI Fruit Story Take</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Getting Started
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How Long Does It Take to Make an AI Fruit Story Video?
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The honest breakdown of what actually takes time — writing the premise, generating characters, building scenes, and animating dialogue — so you know what to expect before you start.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 19, 2026 · 5 min read · Getting Started</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-time-hero.png"
            alt="A stylized 3D cartoon banana character looking impatiently at a glowing pocket watch"
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
              A short, two-character, few-scene story is the fastest path from idea to finished video — most of the time you spend is generation time, which runs in the background while you do something else. The only step that genuinely requires your attention is writing (or picking) the premise, which takes a minute or two.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Where the time actually goes</h2>
            <div className="space-y-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-xl border border-[#E5E0F5] bg-white p-5 flex gap-4">
                  <span className="text-[20px] font-black text-[#D8CFF0] leading-none shrink-0">{s.n}</span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <p className="text-[15px] font-bold text-[#110829]">{s.title}</p>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#7A3BFF]">{s.time}</span>
                    </div>
                    <p className="text-[13px] text-[#6b7280] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">What actually makes it faster or slower</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              Two things scale generation time directly: scene count and whether scenes are animated. A silent, image-only story generates faster than the same story with every scene fully animated and voiced.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                <p className="text-[13px] font-bold text-[#110829] mb-2">Faster</p>
                <p className="text-[13px] text-[#6b7280] leading-relaxed">Fewer scenes, fewer characters, images without animation, a preset premise instead of a custom one.</p>
              </div>
              <div className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                <p className="text-[13px] font-bold text-[#110829] mb-2">Slower</p>
                <p className="text-[13px] text-[#6b7280] leading-relaxed">More scenes, more characters, full mouth-synced dialogue and animation on every scene, a longer story length.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">This compares to traditional animation how?</h2>
            <p className="text-[17px] leading-relaxed">
              This entire process — premise to finished video — happens in the time it would take to just start setting up a traditional animation project. See the full breakdown in{" "}
              <Link to="/blog/ai-fruit-story-vs-traditional-animation" className="text-[#7A3BFF] hover:underline font-semibold">AI Fruit Story vs Traditional Animation</Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try a Short Story First</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Start with two characters and a short scene count to see the full timeline for yourself. For cost details, see{" "}
              <Link to="/blog/ai-fruit-story-pricing" className="text-[#7A3BFF] hover:underline font-semibold">the pricing breakdown</Link>.
            </p>
            <Link
              to="/ai-fruit-story-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the AI Fruit Story Tool →
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
