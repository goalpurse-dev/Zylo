import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is the \"Behind the Scenes\" AI Video Trend?",
    description: "Why the format works and how to generate your first episode.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-trend-explained",
  },
  {
    title: "How to Turn One Behind the Scenes Video Into a Series",
    description: "Trending episode ideas, Surprise Me, and how to keep a season consistent.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-series",
  },
];

const IDEAS = [
  { icon: "🌊", disaster: "Giant Wave", place: "A neon-lit harbor metropolis of glass towers along the waterfront" },
  { icon: "🌋", disaster: "Eruption", place: "A mountainside city of terraced stone buildings climbing a steep slope" },
  { icon: "💥", disaster: "Explosion", place: "A gritty industrial dockyard district of rusted warehouses and shipping cranes" },
  { icon: "🌪️", disaster: "Tornado", place: "A flat prairie grain-town skyline of tall silos and a wide main street" },
  { icon: "🌊", disaster: "Flood", place: "A historic European river city with domed rooftops and stone bridges" },
  { icon: "☄️", disaster: "Meteor", place: "A desert skyline of sand-colored towers and wind-carved spires" },
  { icon: "🔥", disaster: "Firestorm", place: "A dry hillside vineyard town of terracotta-roofed stone villas" },
  { icon: "❄️", disaster: "Blizzard", place: "A fjord town of timber houses lining a narrow frozen inlet" },
  { icon: "🦖", disaster: "Giant Creature", place: "A harbor city spanned by a tall suspension bridge" },
  { icon: "🚁", disaster: "Aircraft Chase", place: "A neon-lit futuristic downtown with tall glass megatowers" },
  { icon: "🚂", disaster: "Vehicle Chase", place: "A historic river city with domed rooftops and stone bridges" },
  { icon: "🏢", disaster: "Structural Collapse", place: "A dense glass high-rise business block of mirrored office towers" },
  { icon: "🚢", disaster: "Ship Disaster", place: "A dense harbor city of cranes, warehouses and waterfront towers" },
  { icon: "🏔️", disaster: "Avalanche", place: "A high-altitude alpine ski town of chalets and a central bell tower" },
  { icon: "🛸", disaster: "Alien Craft", place: "A desert skyline of sand-colored towers and wind-carved spires" },
  { icon: "🤖", disaster: "Giant Robot", place: "A dense downtown of tall glass towers and a wide central avenue" },
  { icon: "🏜️", disaster: "Sandstorm", place: "A neon-lit futuristic downtown with tall glass megatowers" },
  { icon: "⚡", disaster: "Superstorm", place: "A tropical island resort town of white stucco villas and palm-lined promenades" },
];

function IdeaCard({ idea }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">{idea.icon}</span>
        <span className="rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-lime-200">
          {idea.disaster}
        </span>
      </div>
      <p className="text-[14px] leading-relaxed text-white/60">{idea.place}</p>
    </div>
  );
}

export default function BehindTheScenesVideoIdeas() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Behind the Scenes</span>
        </nav>

        <header className="mb-14 max-w-4xl">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Episode Ideas
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            30 Behind the Scenes AI Video Ideas You Can Generate Right Now
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            18 curated place-and-disaster combos to start with — pulled straight from the same episode-idea pool built into the generator. Pick one, or mix your own place with any disaster module.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 5 min read · Episode Ideas</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-video-ideas-hero.png"
            alt="A practical eruption effect with glowing orange fluid and smoke rising behind a miniature mountain city on a film soundstage"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
          {IDEAS.map((idea, i) => (
            <IdeaCard key={i} idea={idea} />
          ))}
        </div>

        <section className="mt-16 max-w-3xl">
          <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Beyond These 18</h2>
          <p className="text-[16px] leading-relaxed text-white/68 mb-4">
            These pair 12 of the 30 disaster modules with a place — but every module works with any place description. Swap the setting, keep the disaster, and you have a new episode instantly. The generator's own "Trending episode ideas" and "Surprise Me" shortcuts do exactly this automatically if you'd rather not pick manually.
          </p>
          <p className="text-[16px] leading-relaxed text-white/68">
            For a repeatable format, see{" "}
            <Link to="/blog/behind-the-scenes-series" className="text-lime-200 hover:underline font-semibold">
              how to turn one video into a series
            </Link>{" "}
            — keeping one dial fixed while rolling a new value for the other is what makes a season feel connected.
          </p>
        </section>

        <section className="mt-14 max-w-3xl">
          <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Generate Your Own</h2>
          <p className="text-[16px] leading-relaxed text-white/68 mb-6">
            Pick an idea above, or describe your own place, then let Zyvo build and animate the episode.
          </p>
          <Link
            to="/behind-the-scenes-video-maker"
            className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
          >
            Explore Behind the Scenes
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <div className="mt-20 -mx-6 rounded-[24px] bg-[#F7F5FA] py-10 sm:mx-0">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
