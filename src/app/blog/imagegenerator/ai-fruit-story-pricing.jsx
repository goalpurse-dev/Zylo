import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";
import { FRUIT_PRICING_FAQ, FRUIT_QUALITY } from "../../../data/fruitStoryPages.js";
import { optImg } from "../../../lib/optImage.js";

// The copy must match the tool: a paid plan is required, pictures have a flat
// price, video is priced per second by quality (pricing/fruitV2Estimates.js).
// No credit numbers here: they are live prices, shown in the tool and on /pricing.

const related = [
  {
    title: "What Is AI Fruit Story? The Viral Fruit Drama Trend",
    description: "What it is, why it went viral, and how one idea becomes a talking video or a series.",
    date: "18.08.2026",
    slug: "/blog/what-is-ai-fruit-story",
  },
  {
    title: "AI Fruit Story Prompts: 50 Copy-Paste Video Ideas",
    description: "Fifty fruit-drama prompts to copy or open straight in the generator.",
    date: "15.05.2026",
    slug: "/blog/best-ai-fruit-story-ideas",
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
    title: "Scene pictures",
    desc: "Every scene gets one picture, and each picture has a fixed price in credits. A video has about one scene for every 5 seconds, so a 30-second video has about 6 pictures. The pictures are paid when the story is made.",
  },
  {
    title: "Video",
    desc: "Animating is priced per second at the quality you pick. V2 costs the least per second; V3 and V4 cost more. Video is paid only when you press animate, after you have checked the pictures.",
  },
  {
    title: "Edits and regenerations",
    desc: "Editing or regenerating a scene picture costs one more picture. Regenerating a clip costs that clip again.",
  },
  {
    title: "What uses no credits",
    desc: "Characters come from the library, so there is nothing to pay for creating them. Writing a series plan (a title, summary and cliffhanger for every episode) uses no credits. The post text that comes with a finished video is included.",
  },
];

export default function AIFruitStoryPricing() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog/category/fruit-stories" className="hover:text-[#7A3BFF]">Fruit Stories</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Pricing</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Pricing Explained
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Is AI Fruit Story Free? Pricing and Credits Explained
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            No. AI Fruit Story needs a paid Zyvo plan and uses credits. Here is what the credits are spent on, which plan gives which video quality, and how to keep a video cheap while you test an idea.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Updated October 5, 2026 · 5 min read · Pricing Explained</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            {...optImg("/blog-assets/ai-fruit-story-pricing-hero.png", "(min-width: 1024px) 896px, 100vw", 960)}
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
              AI Fruit Story is not free. Making a video needs a paid Zyvo plan (Starter, Pro or Generative) and uses the credits that come with that plan. There is no flat price per video: the cost depends on the length and the video quality you choose, and the tool shows it in credits before you start. Without a plan you can open the tool and watch an example video, but you can&apos;t make one.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">What the credits are spent on</h2>
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Which plan gives which quality</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {FRUIT_QUALITY.map((q) => (
                <div key={q.id} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[20px] font-black text-[#110829]">{q.id}</p>
                  <p className="text-[12px] font-bold text-[#7A3BFF] mb-1.5">{q.plan} plan{q.id === "V4" ? "" : " and up"}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{q.note}</p>
                </div>
              ))}
            </div>
            <p className="text-[16px] leading-relaxed mt-5">
              The <Link to="/pricing" className="text-[#7A3BFF] hover:underline font-semibold">pricing page</Link> shows the current plan prices and how many AI Fruit Story videos each plan makes in a month.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How to keep the cost down while testing an idea</h2>
            <p className="text-[17px] leading-relaxed">
              Test a new idea short and on V2. Look closely at the scene pictures before you animate: fixing a picture costs one picture, while animating again costs video. For a series, read the whole episode plan before you make episode 1, because the plan itself uses no credits.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">See the cost before you start</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              The settings step shows the full price for the length and quality you pick, and how many credits you would have left. For story ideas, see the{" "}
              <Link to="/blog/best-ai-fruit-story-ideas" className="text-[#7A3BFF] hover:underline font-semibold">AI fruit story prompts</Link>.
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
              {FRUIT_PRICING_FAQ.map((f) => (
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
