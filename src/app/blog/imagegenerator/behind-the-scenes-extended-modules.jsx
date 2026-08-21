import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "8 Behind the Scenes Disaster Types Explained",
    description: "What each of the original elemental modules feels like, and which places suit it best.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-disaster-types",
  },
  {
    title: "18 Behind the Scenes AI Video Ideas You Can Generate Right Now",
    description: "Curated place-and-disaster combos across every module.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-video-ideas",
  },
  {
    title: "Behind the Scenes Halloween Special: 10 Horror Movie-Set Disaster Ideas",
    description: "Fog, jack-o'-lanterns, and a monster silhouette push the format into horror-movie-set territory.",
    date: "21.08.2026",
    slug: "/blog/behind-the-scenes-halloween",
  },
];

const MODULES = [
  { icon: "🦖", label: "Giant Creature", text: "A towering original creature rig lumbers through the grid, dwarfing both the miniature and the full-size crew operating it." },
  { icon: "🚁", label: "Aircraft Chase", text: "Wire-rigged miniature helicopters or planes sweep low across the skyline on practical cable rigs." },
  { icon: "🚂", label: "Vehicle Chase", text: "A motorized track rig drives a miniature train, car, or truck through the model at speed with practical debris kicked up alongside." },
  { icon: "🏢", label: "Structural Collapse", text: "A rigged bridge, tower, or crane buckles section by section as pull-cables release and dust cannons fire." },
  { icon: "🚢", label: "Ship Disaster", text: "A large miniature ship on a motorized track carves through the FX water tank with practical waves and spray." },
  { icon: "🏔️", label: "Avalanche", text: "An elevated drop rig releases tons of practical fake snow down a mountain model in seconds." },
  { icon: "🛸", label: "Alien Craft", text: "A wire-suspended hovering craft drifts above the skyline with practical light rigs and wind-machine haze." },
  { icon: "🤖", label: "Giant Robot", text: "A full-size hydraulic rig walks a giant robot through the model streets, each footfall crushing miniature buildings." },
  { icon: "🏜️", label: "Sandstorm", text: "Industrial dust cannons and wind turbines blast a dense wall of practical sand across the set." },
  { icon: "⚡", label: "Superstorm", text: "Rain bars, wind turbines, and a water tank operate together as strobe rigs simulate lightning overhead." },
  { icon: "🔥", label: "Fire Tornado", text: "Pyrotechnic fire bars paired with a rotating wind rig spin flame into a vertical vortex above the set." },
  { icon: "🏚️", label: "Earthquake", text: "Hydraulic shaker platforms vibrate the model while a hidden rig splits the street open beneath it." },
];

export default function BehindTheScenesExtendedModules() {
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
            Disaster Guide
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            12 Extended Behind the Scenes Modules: Kaiju, Robots, and Full Movie-Shoot Chaos
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Beyond the 8 elemental disasters, 12 more modules push into full "movie set-piece" territory — rigged characters, chase vehicles, and full-scale action beats instead of pure elemental forces.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 6 min read · Disaster Guide</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-extended-modules-hero.png"
            alt="A towering practical creature rig with visible rigging structure looming over a miniature downtown model with full-size crew nearby"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl mb-10">
          <p className="text-[16px] leading-relaxed text-white/68">
            Where the 8 elemental disasters are about a force acting on the miniature — water, fire, wind, impact — these 12 add a rigged character, vehicle, or set-piece into the frame, closer to a real action-movie stunt sequence than a pure natural-disaster shot.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
          {MODULES.map((m) => (
            <div key={m.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">{m.icon}</span>
                <h2 className="text-[15px] font-bold text-white m-0">{m.label}</h2>
              </div>
              <p className="text-[13px] leading-relaxed text-white/55">{m.text}</p>
            </div>
          ))}
        </div>

        <section className="mt-14 max-w-3xl">
          <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Mixing Elemental and Extended</h2>
          <p className="text-[16px] leading-relaxed text-white/68 mb-4">
            The two categories combine well within a series — an elemental episode followed by an extended one keeps a season from feeling one-note. For the elemental 8 in the same depth, see{" "}
            <Link to="/blog/behind-the-scenes-disaster-types" className="text-lime-200 hover:underline font-semibold">
              the disaster types breakdown
            </Link>
            , or browse{" "}
            <Link to="/blog/behind-the-scenes-video-ideas" className="text-lime-200 hover:underline font-semibold">
              ready-made combos across both
            </Link>.
          </p>
        </section>

        <section className="mt-10 max-w-3xl">
          <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try One</h2>
          <p className="text-[16px] leading-relaxed text-white/68 mb-6">
            Pick a module above and generate your first movie-set-scale episode.
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
