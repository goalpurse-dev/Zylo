import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "18 Behind the Scenes AI Video Ideas You Can Generate Right Now",
    description: "Curated place-and-disaster combos across every module.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-video-ideas",
  },
  {
    title: "Tank Edge, Gantry, or Crane Follow? Choosing the Right Camera Angle",
    description: "What each camera vantage does to the shot, and when to use it.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-camera-vantage",
  },
  {
    title: "10 Mistakes Killing Your Behind the Scenes Video Views",
    description: "The ten most common structural mistakes, with a fix for each.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-mistakes",
  },
  {
    title: "12 Extended Behind the Scenes Modules: Kaiju, Robots, and Full Movie-Shoot Chaos",
    description: "Beyond the elemental 8 — giant creatures, aircraft chases, giant robots, and more.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-extended-modules",
  },
];

const PILLARS = [
  {
    n: "01",
    title: "Keep one dial fixed",
    text: "Roll a new disaster while keeping the same place for a \"one city, every disaster\" season — or keep the same disaster and change the place for a world tour. Changing both every time makes episodes feel unrelated.",
  },
  {
    n: "02",
    title: "Let the format do the consistency work",
    text: "The locked style — miniature materials, blue wall, visible crew, practical rigging — never changes between generations. You don't need to manually match anything; picking a place and a disaster is enough for episodes to feel like the same production.",
  },
  {
    n: "03",
    title: "Vary the camera vantage on purpose",
    text: "Using the same vantage every time gets repetitive fast. Rotate between Tank Edge, Gantry, and Crane Follow across a season the way a real show would vary its coverage.",
  },
  {
    n: "04",
    title: "Use Surprise Me when you're stuck",
    text: "The generator's \"Surprise Me\" shortcut rolls a completely new place, disaster, and vantage in one click — useful for breaking a pattern once a season has run long enough to feel predictable.",
  },
];

export default function BehindTheScenesSeries() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Behind the Scenes</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Series
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How to Turn One Behind the Scenes Video Into a Series
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A single episode gets a view. A recognizable, ongoing "production" gets a following. Here's how to make the second one feel like it belongs with the first.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 5 min read · Series</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-series-hero.png"
            alt="A giant robot rig striding through a miniature downtown model with full-size crew operating hydraulic controls nearby"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Four Pillars of a Season</h2>
            <div className="space-y-4">
              {PILLARS.map((p) => (
                <div key={p.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-[22px] font-black text-white/15 leading-none">{p.n}</span>
                    <h3 className="text-[16px] font-bold text-white m-0">{p.title}</h3>
                  </div>
                  <p className="text-[14px] leading-relaxed text-white/55">{p.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">A Simple Way to Start</h2>
            <p className="text-[16px] leading-relaxed">
              Pick one place you like from{" "}
              <Link to="/blog/behind-the-scenes-video-ideas" className="text-lime-200 hover:underline font-semibold">
                these 18 starter ideas
              </Link>{" "}
              and generate it with three different disasters — that's already a three-episode "season" with zero extra planning. From there, use Trending episode ideas or Surprise Me to keep it going.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Start Your Season</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Generate your first episode, then use the built-in shortcuts to keep the format going.
            </p>
            <Link
              to="/behind-the-scenes-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Explore Behind the Scenes
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

        </div>

        <div className="mt-20 -mx-6 rounded-[24px] bg-[#F7F5FA] py-10 sm:mx-0">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
