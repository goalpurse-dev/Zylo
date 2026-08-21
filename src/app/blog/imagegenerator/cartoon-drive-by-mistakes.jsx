import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Turn One Cartoon Drive-By Video Into a Series",
    description: "A themed destination lineup turns one drive-by into a series people follow.",
    date: "21.08.2026",
    slug: "/blog/cartoon-drive-by-series",
  },
  {
    title: "What Is a Cartoon Drive-By Video? (And How to Make One)",
    description: "Why the format works, what makes the parallax motion feel real, and how to generate one in Zyvo.",
    date: "11.08.2026",
    slug: "/blog/cartoon-drive-by-explained",
  },
  {
    title: "15 Cartoon Drive-By Video Ideas (With Prompts You Can Copy)",
    description: "Fifteen fictional destinations across car, train, bus, and plane viewpoints.",
    date: "11.08.2026",
    slug: "/blog/cartoon-drive-by-video-ideas",
  },
  {
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
];

const MISTAKES = [
  { n: "01", title: "Not naming a vehicle viewpoint", problem: "Leaving the vehicle unspecified means the generator defaults to a standard car view every time, even when a different viewpoint would suit the destination better.", fix: "Always specify car, train, bus, or plane — each one produces a genuinely different framing and motion feel." },
  { n: "02", title: "Describing a destination too vaguely", problem: "\"A cool city\" or \"a nice town\" gives the generator nothing distinct to render, resulting in a generic street that doesn't stand out.", fix: "Describe specific, vivid details — architecture style, color palette, time of day — the same way you'd describe a movie set." },
  { n: "03", title: "Ignoring the mood setting", problem: "Skipping a mood description leaves lighting and atmosphere inconsistent between generations.", fix: "Name a mood explicitly — golden dusk, rainy night, bright midday — to keep the lighting intentional." },
  { n: "04", title: "Picking a mismatched vehicle for the destination", problem: "A plane viewpoint for a narrow alleyway, or a train viewpoint for open ocean, breaks the internal logic of the scene.", fix: "Match the vehicle to a destination that makes sense for it — trains for rail-adjacent routes, planes for wide aerial views." },
  { n: "05", title: "Posting only one destination style repeatedly", problem: "A feed of visually similar drive-bys loses the novelty that makes any single one worth watching.", fix: "Rotate between genuinely different destination styles — a cozy town, a neon city, a coastal road — across a posting series." },
  { n: "06", title: "Underusing the parallax motion", problem: "A destination without varied depth (foreground buildings, midground street activity, background skyline) doesn't showcase the format's signature parallax effect.", fix: "Describe a scene with clear foreground, midground, and background elements so the motion has real depth to work with." },
];

export default function CartoonDriveByMistakes() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Cartoon Drive-By Mistakes</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Content Strategy
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            6 Mistakes Killing Your Cartoon Drive-By Video Views
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The most common reasons Cartoon Drive-By videos come back generic, and the specific fix for each one.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Content Strategy</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/cartoon-drive-by-mistakes-hero.png"
              alt="A vibrant colorful cartoon-styled city street passing by from inside a moving vehicle at dusk"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/cartoon-drive-by-mistakes-fixed.png"
              alt="A vibrant colorful cartoon-styled coastal town street passing by from inside a moving vehicle at sunset"
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
              Cartoon Drive-By results depend heavily on how specific your prompt is — vehicle, destination, and mood all shape the final result. Here's what usually goes wrong.
            </p>
          </section>

          <section>
            <div className="space-y-4">
              {MISTAKES.map((m) => (
                <div key={m.n} className="rounded-2xl border border-[#E5E0F5] bg-white p-6 shadow-sm">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-[22px] font-black text-[#D8CFF0] leading-none">{m.n}</span>
                    <h3 className="text-[16px] font-bold text-[#110829] m-0">{m.title}</h3>
                  </div>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed mb-3"><span className="font-bold text-[#EF4444]">Problem: </span>{m.problem}</p>
                  <p className="text-[14px] text-[#374151] leading-relaxed"><span className="font-bold text-[#22C55E]">Fix: </span>{m.fix}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Fix Your Next Drive-By</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Apply these fixes to your next generation, or start from a proven idea in{" "}
              <Link to="/blog/cartoon-drive-by-video-ideas" className="text-[#7A3BFF] hover:underline font-semibold">15 Cartoon Drive-By video ideas</Link>.
            </p>
            <Link
              to="/cartoon-drive-by-video-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Cartoon Drive-By →
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
