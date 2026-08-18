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

const INGREDIENTS = [
  { n: "01", title: "A real material palette", text: "Weathered foam, wood, plaster, paint and metal — the miniature is described as handcrafted from physical materials, not a smooth digital model." },
  { n: "02", title: "A towering blue chroma wall", text: "Scaled to dwarf the miniature, with small orange tracking crosses across the studio floor — the exact visual shorthand for \"this is a real VFX stage.\"" },
  { n: "03", title: "Full-size crew for scale", text: "Effects crew stand right beside the model, visibly as tall as entire miniature towers. Scale is proven through a body standing next to a building, not a caption." },
  { n: "04", title: "Visible rigging, never CGI", text: "Camera cranes, dolly track, coiled cables, hydraulic rigs and monitor carts are always in frame. The disaster itself is described as entirely physical, operated by the visible crew." },
  { n: "05", title: "Imperfect, amateur framing", text: "Flat cool LED lighting, sensor grain, minor exposure clipping and small handheld imperfections — consistent with someone's phone, not a polished commercial." },
];

export default function BehindTheScenesHowItsMade() {
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
            How It Works
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Why AI "Movie Set" Miniature Disaster Videos Look So Real
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            It's not one clever trick — it's five details that always show up together, locked into every generation regardless of what disaster or place you pick. Here's what actually sells the illusion.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 6 min read · How It Works</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-how-its-made-hero.png"
            alt="A hand holding a tiny handcrafted miniature building in front of a blue chroma wall with visible film crew and cameras"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">The Five Locked Ingredients</h2>
            <div className="space-y-4">
              {INGREDIENTS.map((item) => (
                <div key={item.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-[22px] font-black text-white/15 leading-none">{item.n}</span>
                    <h3 className="text-[16px] font-bold text-white m-0">{item.title}</h3>
                  </div>
                  <p className="text-[14px] leading-relaxed text-white/55">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why Consistency Matters More Than Any Single Detail</h2>
            <p className="text-[16px] leading-relaxed">
              None of these five ingredients is unusual on its own — miniatures, blue screens, and film crews are common in real behind-the-scenes content. What makes this format recognizable is that all five appear together, every time, regardless of whether the disaster is a giant wave or a giant robot. That consistency is what your eye actually reads as "this is a real, ongoing production," not a one-off image.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Where the Camera Stands Changes Everything</h2>
            <p className="text-[16px] leading-relaxed">
              The same five ingredients read completely differently depending on where the "phone" is standing when the shot is captured — right at the tank edge, up on an elevated gantry, or sweeping past on a camera crane. See{" "}
              <Link to="/blog/behind-the-scenes-camera-vantage" className="text-lime-200 hover:underline font-semibold">
                how to choose the right one
              </Link>{" "}
              for the mood you're going for.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">See It Yourself</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a place and a disaster, and Zyvo locks in every one of these details automatically.
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
