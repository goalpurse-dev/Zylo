import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is the \"Behind the Scenes\" AI Video Trend?",
    description: "Why the format works and how to make your first episode.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-trend-explained",
  },
  {
    title: "Behind the Scenes Disaster Tier List: All 20 Modules Ranked",
    description: "All 8 elemental disasters and 12 extended modules, ranked.",
    date: "21.08.2026",
    slug: "/blog/behind-the-scenes-tier-list",
  },
  {
    title: "8 Behind the Scenes Disaster Types Explained",
    description: "What each of the eight original disaster modules feels like.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-disaster-types",
  },
];

const PICKS = [
  { title: "Want the clearest, most dramatic first video", desc: "Start with a full-scale explosion or a kaiju attack — both read instantly and don't require any setup context to land." },
  { title: "Want something a little different from the obvious picks", desc: "Try a giant robot rampage or an aircraft chase — still big, but less commonly seen than the classic explosion." },
  { title: "Want a slower, more atmospheric first video", desc: "A blizzard or a firestorm builds more gradually — a good choice if you want the crew and set details to carry more of the shot." },
  { title: "Not sure at all", desc: "Full-scale explosion is the safest first pick — it's the single most reliably readable disaster type in the catalog." },
];

export default function BehindTheScenesBeginnersGuide() {
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
            Beginners
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How to Pick Your First Behind the Scenes Disaster Type: A Beginner's Guide
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            20 disaster modules is a lot of choice for a first try. Here's a simple way to pick based on what you actually want your first video to feel like.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 5 min read · Beginners</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-beginners-guide-hero.png"
            alt="A clean grid of six glowing line-art disaster icons representing wave, explosion, tornado, meteor, storm, and robot"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {PICKS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <p className="text-[15px] font-bold text-white mb-1.5">{p.title}</p>
              <p className="text-[14px] text-white/55 leading-relaxed">{p.desc}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Then Build From There</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Once your first video lands well, the{" "}
              <Link to="/blog/behind-the-scenes-tier-list" className="text-lime-200 hover:underline font-semibold">disaster tier list</Link>{" "}
              is a good next stop for picking your second and third modules.
            </p>
            <Link
              to="/behind-the-scenes-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Make Your First Video
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
