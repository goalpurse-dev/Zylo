import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month",
    description: "How the eight-scene, four-milestone-day story format actually works.",
    date: "24.08.2026",
    slug: "/blog/what-is-30-days-ai-trend",
  },
  {
    title: "30 Days Quality Tiers Explained: V2 vs V3 vs V4",
    description: "What each quality tier actually changes, and which one is worth it.",
    date: "25.08.2026",
    slug: "/blog/30-days-quality-tiers",
  },
  {
    title: "10 Mistakes Killing Your 30 Days Video Views",
    description: "The structural choices that quietly hold results back, with a fix for each.",
    date: "24.08.2026",
    slug: "/blog/30-days-mistakes",
  },
];

const STAGES = [
  { n: "01", title: "Naming the universe and premise", desc: "The fastest step — type a universe, write or AI-generate a premise, and move on. This is where most of your creative decisions happen, not where the wait is." },
  { n: "02", title: "Locking the world bible", desc: "Before any scene renders, Zyvo generates 4 to 6 reference images — the key locations and canon characters — so the visual style stays consistent for the rest of the story." },
  { n: "03", title: "Generating eight scenes", desc: "Two scene images for each of Day 1, 10, 20, and 30, each animated into a 5-second clip. This is the longest stage, and it scales with your chosen quality tier." },
  { n: "04", title: "Watching the footage and writing narration", desc: "Once all eight clips are done, Zyvo watches them and writes a continuous story from what actually happens on screen — this step can't start until every clip exists." },
  { n: "05", title: "Voice and final export", desc: "Picking a voice and generating the narration take is quick. Stitching the final video is the last step before you have a finished, exportable story." },
];

export default function ThirtyDaysTime() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-violet-300">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">30 Days</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-violet-200 mb-6">
            Time
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How Long Does a 30 Days Video Take to Make?
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            From naming a universe to a finished, narrated video — what actually takes time, step by step.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 25, 2026 · 5 min read · Time</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-time-hero.png"
            alt="A glowing purple magical hourglass floating in a dark cosmic void, with swirling portal energy inside it instead of sand"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
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
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">The quality tier is the real time lever</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              A V2 (1K) generation is the fastest way to test a new universe and premise before committing to a sharper, slower V3 or V4 render. See{" "}
              <Link to="/blog/30-days-quality-tiers" className="text-violet-300 hover:underline font-semibold">what each tier actually changes</Link>{" "}
              before picking one.
            </p>
            <Link
              to="/30-days-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-fuchsia-300 px-7 py-3.5 text-[14px] font-black text-[#160b20] transition hover:brightness-110"
            >
              Explore 30 Days
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
