import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "15 Micro Camera Animal Video Ideas You Can Generate Right Now",
    description: "Seven real animals, each with its own underground world, with ideas for every one.",
    date: "20.08.2026",
    slug: "/blog/micro-camera-animal-video-ideas",
  },
  {
    title: "What Is Micro Camera Animal? The Viral Insect's-Eye-View AI Trend",
    description: "What the format is, how it's made, and why it works as a content format.",
    date: "20.08.2026",
    slug: "/blog/what-is-micro-camera-animal",
  },
  {
    title: "8 Mistakes Killing Your Micro Camera Animal Video Views",
    description: "The most common structural mistakes, with a specific fix for each one.",
    date: "21.08.2026",
    slug: "/blog/micro-camera-animal-mistakes",
  },
];

const PILLARS = [
  { title: "One animal per season", desc: "Stick with the same animal across a run of episodes so viewers know exactly what kind of underground world to expect each time." },
  { title: "Progressive depth across episodes", desc: "Structure a season so each episode goes one level deeper than the last, building toward the deepest chamber as a finale." },
  { title: "Consistent documentary framing", desc: "Keep the same ultra-realistic, scientific visual style across every episode so the series reads as one continuous research log." },
  { title: "Rotate animals between seasons", desc: "Once you've covered one animal's full depth, move to a different one for the next season to keep the format feeling fresh." },
];

export default function MicroCameraAnimalSeries() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Micro Camera Animal Series</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Series
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How to Turn One Micro Camera Animal Video Into a Series
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A single POV clip gets a view. A full research-log-style season gets a following. Here's how to structure an ongoing series around one animal at a time.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Series</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/micro-camera-animal-series-hero.png"
              alt="Four different tiny cameras laid out neatly in a row on natural soil"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/micro-camera-animal-series-lineup.png"
              alt="An ant and a beetle standing together on natural soil in soft morning light"
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Four pillars of a Micro Camera Animal season</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {PILLARS.map((p) => (
                <div key={p.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{p.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">A simple way to start</h2>
            <p className="text-[17px] leading-relaxed">
              Pick one animal from{" "}
              <Link to="/blog/micro-camera-animal-video-ideas" className="text-[#7A3BFF] hover:underline font-semibold">15 video ideas</Link>{" "}
              and generate three episodes that go progressively deeper — surface entrance, main passage, deepest chamber. That's a complete three-episode arc with a natural beginning, middle, and finale.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Start Your Season</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Generate your first episode, then keep the same animal for the rest of the season.
            </p>
            <Link
              to="/micro-camera-animal-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Micro Camera Animal →
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
