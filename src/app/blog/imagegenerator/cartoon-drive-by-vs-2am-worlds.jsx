import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is a Cartoon Drive-By Video? (And How to Make One)",
    description: "Why the format works, what makes the parallax motion feel real, and how to generate one.",
    date: "11.08.2026",
    slug: "/blog/cartoon-drive-by-explained",
  },
  {
    title: "What Is the 2AM Worlds AI Trend?",
    description: "Where the 2AM Worlds trend came from and how Zyvo's AI generator recreates it.",
    date: "27.07.2026",
    slug: "/blog/what-is-the-2am-worlds-ai-trend",
  },
  {
    title: "Which Zyvo Template Should You Start With? A Quick Decision Guide",
    description: "Match what you want to make to the right Zyvo tool in under two minutes.",
    date: "21.08.2026",
    slug: "/blog/which-zyvo-template",
  },
];

const COMPARISON_ROWS = [
  { label: "Output format", cartoon: "One continuous 10-second vertical video with camera motion", worlds: "Six still cinematic images forming one scene set" },
  { label: "Core mechanic", cartoon: "Parallax motion — passing a destination from inside a moving vehicle", worlds: "Reframing a familiar world or reference through a quiet, late-night lens" },
  { label: "Best for", cartoon: "Travel-style, motion-driven short-form video content", worlds: "Nostalgic, atmospheric slideshow-style content" },
  { label: "Customization", cartoon: "Vehicle viewpoint (car, train, bus, plane) plus destination and mood", worlds: "Any world, game, character, or reference you can name" },
];

const FAQS = [
  {
    q: "Can I use both formats for the same content idea?",
    a: "Yes — some destinations work well as both a moving Cartoon Drive-By video and a still 2AM Worlds image set. Try the same reference in both tools and see which fits your content style better.",
  },
  {
    q: "Which format is faster to generate?",
    a: "Both generate quickly, but Cartoon Drive-By produces one finished video per generation, while 2AM Worlds produces six images you may want to arrange into a slideshow afterward.",
  },
  {
    q: "Do both formats work for any destination or world?",
    a: "2AM Worlds is built to interpret almost any reference. Cartoon Drive-By works best with destinations that make sense from a moving-vehicle viewpoint.",
  },
];

export default function CartoonDriveByVs2amWorlds() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Cartoon Drive-By vs 2AM Worlds</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Comparison
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Cartoon Drive-By vs 2AM Worlds: Which Atmospheric AI Format Should You Try?
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Both turn a fictional world into something quietly beautiful — one in motion, one in stillness. Here's how to decide which fits your idea.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Comparison</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/cartoon-vs-2am-worlds-hero.png"
              alt="A split composition showing a vibrant colorful sunset street on one side and a moody moonlit street scene on the other"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/cartoon-vs-2am-worlds-comparison.png"
              alt="An abstract glowing scale balancing a bright colorful sun on one side and a soft glowing moon on the other"
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The core difference</h2>
            <p className="text-[17px] leading-relaxed">
              Both formats take a fictional or nostalgic world and reframe it in an unexpected way — but Cartoon Drive-By does it through motion (passing the destination from inside a moving vehicle), while 2AM Worlds does it through stillness and time of day (the same world, quiet and after midnight). Same instinct, opposite execution.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Side by side</h2>
            <div className="overflow-x-auto rounded-2xl border border-[#E5E0F5]">
              <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
                <thead className="bg-purple-50">
                  <tr>
                    <th className="px-4 py-3 font-bold text-[#110829]"></th>
                    <th className="px-4 py-3 font-bold text-[#7A3BFF]">Cartoon Drive-By</th>
                    <th className="px-4 py-3 font-bold text-[#6b7280]">2AM Worlds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0F5]">
                  {COMPARISON_ROWS.slice(0, 4).map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-3 font-bold text-[#110829] bg-[#F7F5FA]">{row.label}</td>
                      <td className="px-4 py-3 text-[#374151]">{row.cartoon}</td>
                      <td className="px-4 py-3 text-[#6b7280]">{row.worlds}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-4 py-3 font-bold text-[#110829] bg-[#F7F5FA]">Posting format</td>
                    <td className="px-4 py-3 text-[#374151]">Single video, ready to post immediately</td>
                    <td className="px-4 py-3 text-[#6b7280]">Image slideshow, arranged in your editor of choice</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How to decide</h2>
            <p className="text-[17px] leading-relaxed">
              If your idea is about a place — a city, a town, a specific street — and you want viewers to feel like they're passing through it, Cartoon Drive-By is the better fit. If your idea is about a mood or a reference — a game, a show, a nostalgic memory — reimagined quietly at a specific time of night, 2AM Worlds is the better fit.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try Both</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Not sure which fits your idea? Generate the same reference in both and compare.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/cartoon-drive-by-video-maker"
                className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-6 py-3.5 rounded-[14px] hover:opacity-90 transition"
              >
                Open Cartoon Drive-By →
              </Link>
              <Link
                to="/2am-worlds-ai-generator"
                className="inline-block border border-[#7A3BFF] text-[#7A3BFF] font-bold text-[15px] px-6 py-3.5 rounded-[14px] hover:bg-purple-50 transition"
              >
                Open 2AM Worlds →
              </Link>
            </div>
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
