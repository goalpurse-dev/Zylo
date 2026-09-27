import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month",
    description: "How the eight-scene, four-milestone-day story format actually works.",
    date: "24.08.2026",
    slug: "/blog/what-is-30-days-ai-trend",
  },
  {
    title: "50 AI Fruit Story Prompts and Viral Drama Ideas",
    description: "Fifty fruit-drama prompts across reveal, family, friendship, comeback, workplace, and wedding-drama plots.",
    date: "15.05.2026",
    slug: "/blog/best-ai-fruit-story-ideas",
  },
  {
    title: "Every Zyvo AI Video Format Compared: Which One Should You Try Next?",
    description: "Six format-specific AI video tools, side by side.",
    date: "21.08.2026",
    slug: "/blog/every-zyvo-video-format-compared",
  },
];

const COMPARISON_ROWS = [
  { label: "Who's the protagonist", days: "You — locked as the compositionally central character in every scene", fruit: "A cast of stylized fruit characters, not you" },
  { label: "What it produces", days: "8-scene narrated story across 4 milestone days, ~40 seconds, one continuous arc", fruit: "A multi-scene drama with dialogue and recurring characters" },
  { label: "Setting", days: "Any existing fictional universe you name", fruit: "An original cast in whatever setting the premise calls for" },
  { label: "Narration", days: "AI-written after watching your actual finished clips", fruit: "AI-written dialogue spoken by animated characters" },
  { label: "Best for", days: "Immersive 'what if I lived here' fan-driven content", fruit: "Soap-opera-style conflict, reveals, and comebacks" },
];

export default function ThirtyDaysVsAiFruitStory() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>30 Days vs AI Fruit Story</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Comparison
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            30 Days vs AI Fruit Story: Which Story Format Should You Try?
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Both formats tell a real story across multiple scenes — one puts you inside a world you already know, the other builds an entirely original cast.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 24, 2026 · 5 min read · Comparison</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/30-days-vs-fruit-story-hero.png"
              alt="A split image: a glowing purple portal into a fictional world on the left, a stylized 3D cartoon fruit character on the right"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/30-days-vs-fruit-story-detail.png"
              alt="A split image: an abstract glowing purple film-strip sequence on the left, a stylized 3D cartoon fruit character waving on the right"
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
              Both are Zyvo's multi-scene story formats, but they're built around opposite instincts — one is about you experiencing a world, the other is about watching a cast of characters experience conflict.
            </p>
          </section>

          <section>
            <div className="overflow-x-auto rounded-2xl border border-[#E5E0F5]">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="bg-[#F3EFFB]">
                    <th className="px-4 py-3 font-bold text-[#110829]">What matters</th>
                    <th className="px-4 py-3 font-bold text-[#7A3BFF]">30 Days</th>
                    <th className="px-4 py-3 font-bold text-[#7A3BFF]">AI Fruit Story</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((r, i) => (
                    <tr key={r.label} className={i % 2 === 0 ? "bg-white" : "bg-[#FBFAFE]"}>
                      <td className="px-4 py-3 font-semibold text-[#110829] align-top">{r.label}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{r.days}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{r.fruit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">30 Days: you, inside a world you already love</h2>
            <p className="text-[17px] leading-relaxed">
              Name any universe — a game, a show, a childhood favorite — and Zyvo places you at the center of an eight-scene story there across four milestone days, narrated from your actual finished footage. See{" "}
              <Link to="/blog/what-is-30-days-ai-trend" className="text-[#7A3BFF] hover:underline font-semibold">how the format works</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">AI Fruit Story: an original cast, real drama</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              A fully original cast of stylized fruit characters acts out written conflict — reveals, breakups, comebacks — with dialogue across a series. No universe to name, no version of yourself on screen.
            </p>
            <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold text-[15px]">
              Explore AI Fruit Story →
            </Link>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try Either — or Both</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/30-days-video-maker"
                className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition text-center"
              >
                Explore 30 Days →
              </Link>
              <Link
                to="/ai-fruit-story-maker"
                className="inline-block border border-[#7A3BFF] text-[#7A3BFF] font-bold text-[15px] px-8 py-4 rounded-[14px] hover:bg-[#F3EFFB] transition text-center"
              >
                Explore AI Fruit Story →
              </Link>
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
