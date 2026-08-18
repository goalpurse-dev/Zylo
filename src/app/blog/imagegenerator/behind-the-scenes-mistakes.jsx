import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "8 Behind the Scenes Disaster Types Explained",
    description: "What each module feels like, and which places suit it best.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-disaster-types",
  },
  {
    title: "How to Turn One Behind the Scenes Video Into a Series",
    description: "Four pillars of a consistent season, and a simple way to start your first one.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-series",
  },
  {
    title: "Behind the Scenes vs Clay Rescue: Which Miniature AI Video Format Should You Try?",
    description: "Same scale-contrast trick, opposite emotional arc — how to pick.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-vs-clay-rescue",
  },
];

const MISTAKES = [
  { n: "01", title: "The disaster doesn't match the place's scale", problem: "A giant wave against three small buildings reads as small, not epic — there's nothing large enough for the water to convincingly dwarf.", fix: "Match ambitious disasters to places with tall, dense skylines. See the disaster-by-disaster breakdown to pair scale correctly." },
  { n: "02", title: "Every episode uses the same camera vantage", problem: "Tank Edge every time makes a season feel like one repeated shot instead of an ongoing production.", fix: "Rotate between Tank Edge, Gantry, and Crane Follow across a season the way a real show would vary its coverage." },
  { n: "03", title: "The caption explains the whole shot", problem: "If the caption describes exactly what's about to happen, the video loses its \"wait, what am I watching\" pull.", fix: "Let the visual carry the reveal. A short, open caption outperforms a fully descriptive one." },
  { n: "04", title: "Posting once and stopping", problem: "A single strong episode doesn't build a following on its own, however good it looks.", fix: "Treat the format as a repeatable production, not a one-off. Consistency compounds far more than any individual clip's performance." },
  { n: "05", title: "No crew visible for scale", problem: "Without a full-size crew member in frame, the miniature can read as just a static model rather than something happening at a real scale.", fix: "Keep at least one crew figure visibly dwarfing the miniature towers — it's the single strongest scale cue in every generation." },
  { n: "06", title: "Skipping the sound", problem: "A silent or muted clip loses the crew chatter and rig noise that sell the \"real production\" illusion.", fix: "Every generation includes full sound design by default — post with audio on, not muted." },
  { n: "07", title: "The ending resolves too cleanly", problem: "A fully wrapped-up disaster gives viewers no reason to check back for the next episode.", fix: "End on the impact itself, not the aftermath — leave the resolution implied rather than shown." },
  { n: "08", title: "Only using the 8 elemental disasters", problem: "Sticking to wave, eruption, explosion and the other originals caps your range once viewers have seen a few.", fix: "Mix in the 12 extended modules — giant creatures, aircraft chases, giant robots — for real variety across a season." },
  { n: "09", title: "The same place every episode", problem: "Reusing one city repeatedly makes new episodes feel like reruns even when the disaster changes.", fix: "Roll a new place while keeping the disaster fixed, or vice versa — never lock both at once for very long." },
  { n: "10", title: "No consistent identity across episodes", problem: "Without any throughline, episodes feel like unrelated one-offs instead of a season.", fix: "Keep one dial fixed at a time and build a simple pattern viewers can recognize — see the guide to building a series for the full approach." },
];

export default function BehindTheScenesMistakes() {
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
            Troubleshooting
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            10 Mistakes Killing Your Behind the Scenes Video Views
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Most underperforming episodes aren't failing because of the format — they're failing because of one fixable structural choice. Here are the ten most common mistakes and exactly what to change.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 7 min read · Troubleshooting</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-mistakes-hero.png"
            alt="Water rising around a miniature river city foundation in a flooded FX tank while crew check equipment at the tank edge"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {MISTAKES.map((item) => (
            <div key={item.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-white/15 leading-none">{item.n}</span>
                <h2 className="text-[16px] font-bold text-white m-0">{item.title}</h2>
              </div>
              <p className="text-[12px] text-white/35 font-bold uppercase tracking-wide mb-1">The problem</p>
              <p className="text-[14px] text-white/55 leading-relaxed mb-3">{item.problem}</p>
              <p className="text-[12px] text-lime-200/70 font-bold uppercase tracking-wide mb-1">The fix</p>
              <p className="text-[14px] text-white/68 leading-relaxed">{item.fix}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Fix One at a Time</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Don't try to fix all ten at once. Pick the one that sounds most familiar, apply it to your next episode, and generate it in Zyvo.
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
