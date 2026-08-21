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
    title: "8 Behind the Scenes Disaster Types Explained",
    description: "What each of the eight original disaster modules feels like, and which places suit each one best.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-disaster-types",
  },
  {
    title: "How to Turn One Behind the Scenes Video Into a Series",
    description: "Four pillars of a Behind the Scenes series, and a simple way to start your first season.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-series",
  },
];

const STAGES = [
  { n: "01", title: "The movie-set still image", desc: "The generator first produces a single photorealistic still — the miniature model, the disaster, and the crew, all in one frame. This is the fastest step and the one worth reviewing closely before animating." },
  { n: "02", title: "The 8-second animated video", desc: "Once the still is right, it's turned into an 8-second video with sound — crew chatter, rig and machine noise, and the disaster's impact. This step takes longer than the still since it's generating motion and audio together." },
  { n: "03", title: "Picking a disaster module", desc: "Choosing from the 8 elemental disasters or the 12 extended modules doesn't add generation time on its own — but a more complex scene (a kaiju versus a simple flood) can take a little longer to render convincingly." },
  { n: "04", title: "Regenerating a scene", desc: "If the still doesn't land — wrong crew framing, disaster not dramatic enough — regenerating the still is quick. It's cheaper to fix the still before committing to the animated version." },
];

export default function BehindTheScenesTime() {
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
            Time
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How Long Does a Behind the Scenes Video Take to Make?
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            From picking a disaster module to a finished 8-second clip with sound — what actually takes time, step by step.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 5 min read · Time</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-time-hero.png"
            alt="An abstract glowing purple stopwatch with a tiny city skyline silhouette inside its face"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {STAGES.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-white/15 leading-none">{s.n}</span>
                <h2 className="text-[17px] font-bold text-white m-0">{s.title}</h2>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55">{s.desc}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Start With the Still</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Reviewing the still image before animating it is the single fastest way to keep total generation time down — see{" "}
              <Link to="/blog/behind-the-scenes-disaster-types" className="text-lime-200 hover:underline font-semibold">all 8 disaster types explained</Link>{" "}
              to pick one that fits your idea before you start.
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
