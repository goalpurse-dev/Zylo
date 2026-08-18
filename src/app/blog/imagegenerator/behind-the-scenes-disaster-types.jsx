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

const DISASTERS = [
  { icon: "🌊", label: "Giant Wave", mood: "Sudden and overwhelming.", text: "A towering wall of water swallows entire model blocks in seconds. Best on waterfront places — harbors, coastal resorts, canal towns — where the scale of the wave against the skyline is the whole story." },
  { icon: "🌋", label: "Eruption", mood: "Building dread, then release.", text: "Smoke and glowing practical fluid roll down the slopes before the plume towers over everything. Pairs naturally with mountain or hillside places, especially ones already built into terraced or stacked terrain." },
  { icon: "💥", label: "Explosion", mood: "Fast and violent.", text: "No slow build — a fireball and shockwave blast a building apart in a single beat. Works best in dense downtowns or industrial districts where debris has somewhere dramatic to scatter." },
  { icon: "🌪️", label: "Tornado", mood: "Relentless and sweeping.", text: "A spinning column of dust and debris tracks across the entire grid rather than hitting one spot. Flat, wide places — prairie towns, suburban grids, coastal skylines — give it the most room to move." },
  { icon: "🌊", label: "Flood", mood: "Slow, tense, unavoidable.", text: "Water rises steadily around the foundations while crew wade at the tank edge. The most patient of the eight — best for places where a rising waterline has real visual drama, like river cities or delta towns." },
  { icon: "☄️", label: "Meteor", mood: "A single dramatic beat.", text: "One glowing projectile drops from above and slams into the grid. Works anywhere, but hits hardest against open, exposed places — deserts, salt flats, canyon towns — with nothing to soften the impact." },
  { icon: "🔥", label: "Firestorm", mood: "Rolling and consuming.", text: "A wall of practical fire sweeps across rooftops as smoke banks build. Best suited to older, denser architecture — timber districts, hillside villages — where fire reads as a real structural threat." },
  { icon: "❄️", label: "Blizzard", mood: "Slow whiteout, quiet menace.", text: "Wind and snow build gradually until the tallest towers disappear into the gusts. Alpine and fjord-style places do the most work here — the cold setting and the disaster reinforce each other." },
];

export default function BehindTheScenesDisasterTypes() {
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
            8 Behind the Scenes Disaster Types Explained
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            The eight original disaster modules each have a completely different rhythm — some build slowly, some hit in one violent beat. Here's what each one actually feels like, and which places suit it best.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 6 min read · Disaster Guide</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-disaster-types-hero.png"
            alt="A glowing meteor dropping from an overhead rig and slamming into a miniature desert town on a film soundstage"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="grid gap-4 sm:grid-cols-2 max-w-6xl">
          {DISASTERS.map((d) => (
            <div key={d.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">{d.icon}</span>
                <div>
                  <h2 className="text-[16px] font-bold text-white m-0">{d.label}</h2>
                  <p className="text-[12px] font-bold uppercase tracking-wide text-lime-200/70">{d.mood}</p>
                </div>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55">{d.text}</p>
            </div>
          ))}
        </div>

        <section className="mt-14 max-w-3xl">
          <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Beyond the Original Eight</h2>
          <p className="text-[16px] leading-relaxed text-white/68 mb-4">
            Once you've got a feel for these, there are 12 more extended modules — giant creatures, aircraft chases, vehicle chases, structural collapse, avalanches, alien craft, giant robots, and more — that push into full "movie shoot" territory rather than pure elemental disasters.
          </p>
          <p className="text-[16px] leading-relaxed text-white/68">
            For ready-made place-and-disaster pairings across all of them, see{" "}
            <Link to="/blog/behind-the-scenes-video-ideas" className="text-lime-200 hover:underline font-semibold">
              18 episode ideas you can generate right now
            </Link>.
          </p>
        </section>

        <section className="mt-10 max-w-3xl">
          <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try Your First Pick</h2>
          <p className="text-[16px] leading-relaxed text-white/68 mb-6">
            Pick the disaster whose mood matches what you want to make, then choose a place that plays to its strengths.
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
