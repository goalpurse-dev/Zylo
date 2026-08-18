import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Why AI \"Movie Set\" Miniature Disaster Videos Look So Real",
    description: "The five locked ingredients that sell the illusion.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-how-its-made",
  },
  {
    title: "How to Turn One Behind the Scenes Video Into a Series",
    description: "Trending episode ideas, Surprise Me, and how to keep a season consistent.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-series",
  },
  {
    title: "10 Mistakes Killing Your Behind the Scenes Video Views",
    description: "The ten most common structural mistakes, with a fix for each.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-mistakes",
  },
  {
    title: "Behind the Scenes vs Clay Rescue: Which Miniature AI Video Format Should You Try?",
    description: "Same scale-contrast trick, opposite emotional arc — how to pick.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-vs-clay-rescue",
  },
];

const VANTAGES = [
  {
    n: "01",
    label: "Tank Edge",
    sublabel: "Closest to the chaos",
    text: "Ground level, right beside the FX tank and equipment. The nearest crew member's shoulder or back sits at the frame edge, cables and hoses crossing the foreground. Use this when you want the viewer to feel like they're standing right next to the rig.",
  },
  {
    n: "02",
    label: "Gantry",
    sublabel: "Full scale reveal",
    text: "An elevated view looking down over the entire miniature set, with a metal guardrail low in frame and crew visible only from behind or in silhouette on the catwalk. Use this when the place itself — the full skyline, the full disaster — is the thing worth showing off.",
  },
  {
    n: "03",
    label: "Crane Follow",
    sublabel: "Most cinematic",
    text: "A sweeping camera crane move low over the miniature during the impact, with the crane arm and cable rigging faintly visible at the frame edge. Use this for the most dramatic, most \"trailer-like\" version of a shot.",
  },
];

export default function BehindTheScenesCameraVantage() {
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
            Tips
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Tank Edge, Gantry, or Crane Follow? Choosing the Right Camera Angle
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            The disaster module decides what happens. The camera vantage decides how it feels. Same place, same disaster, three completely different videos.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 5 min read · Tips</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-camera-vantage-hero.png"
            alt="A wide gantry viewpoint looking down over a full miniature desert town set and water tank from an elevated catwalk"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {VANTAGES.map((v) => (
            <div key={v.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-white/15 leading-none">{v.n}</span>
                <div>
                  <h2 className="text-[17px] font-bold text-white m-0">{v.label}</h2>
                  <p className="text-[12px] font-bold uppercase tracking-wide text-lime-200/70">{v.sublabel}</p>
                </div>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55">{v.text}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">A Simple Way to Choose</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              If you're not sure, start with Tank Edge — it's the most intimate and the easiest to read on a phone screen. Move to Gantry when the place itself is dramatic enough to be the star. Save Crane Follow for a disaster with real motion across the frame, like a{" "}
              <Link to="/blog/behind-the-scenes-video-ideas" className="text-lime-200 hover:underline font-semibold">
                giant wave or a tornado
              </Link>
              , where the sweep adds to the chaos instead of competing with it.
            </p>
            <p className="text-[16px] leading-relaxed">
              Want to know why any of this actually reads as believable in the first place? See{" "}
              <Link to="/blog/behind-the-scenes-how-its-made" className="text-lime-200 hover:underline font-semibold">
                the five ingredients that sell the illusion
              </Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try All Three</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Generate the same place and disaster with each vantage and compare. It's the fastest way to learn what each one does.
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
