import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month",
    description: "How the seven-scene story format actually works.",
    date: "24.08.2026",
    slug: "/blog/what-is-30-days-ai-trend",
  },
  {
    title: "50 30 Days Universe Ideas: What World Should You Spend 30 Days In?",
    description: "Fifty fictional universes to try, grouped by mood.",
    date: "24.08.2026",
    slug: "/blog/30-days-universe-ideas",
  },
  {
    title: "How to Turn One 30 Days Story Into a Series",
    description: "A simple structure for turning one 30-day story into an ongoing world you keep returning to.",
    date: "24.08.2026",
    slug: "/blog/30-days-video-series",
  },
  {
    title: "Is 30 Days Worth It? Credits, Cost, and What You Actually Get",
    description: "Exactly where the credits go, and what you get back for them.",
    date: "25.08.2026",
    slug: "/blog/is-30-days-worth-it",
  },
];

const MISTAKES = [
  { n: "01", title: "The universe is too vague", problem: "\"A fantasy world\" or \"a video game\" gives the world bible nothing specific to lock onto, so the eight scenes can end up visually inconsistent.", fix: "Name a specific, recognizable universe — a real game, show, or clearly defined original setting." },
  { n: "02", title: "The premise doesn't put you at the center", problem: "A premise written entirely about other characters leaves the viewer protagonist as a background extra instead of the story's lead.", fix: "Frame the premise around what happens to you specifically — 'you get teleported there,' 'you become,' 'you arrive just as.'" },
  { n: "03", title: "Skipping AI idea mode when you're stuck", problem: "Struggling to write an original premise from scratch is the most common reason people abandon the tool before generating anything.", fix: "Turn on AI idea mode — it writes a viral-shaped premise for your chosen universe that you can use as-is or edit." },
  { n: "04", title: "Picking the wrong quality tier for the platform", problem: "A 4K generation costs more credits than a quick test needs, while 1K may undersell a universe with fine detail, like an intricate fantasy kingdom.", fix: "Use V2 (1K) to test a new universe and premise, then upgrade to V3 or V4 once you know the story is worth polishing." },
  { n: "05", title: "Not reviewing the narration script before generating voice", problem: "The AI-written script is a strong first draft, not a guaranteed-perfect one — publishing it unread risks an awkward line making it into the final video.", fix: "Read and edit the hook and narration before picking a voice — it's a text field specifically because it's meant to be adjusted." },
  { n: "06", title: "Choosing a voice that doesn't match the premise's tone", problem: "A calm, gentle voice narrating a high-stakes crisis premise undercuts the tension the story is trying to build.", fix: "Match the voice's traits to your premise — energetic and bold voices for high-stakes drama, warm and narrative voices for slower, atmospheric stories." },
];

export default function ThirtyDaysMistakes() {
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
            Mistakes
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            10 Mistakes Killing Your 30 Days Video Views
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            The default settings already produce a strong story. These are the choices that quietly hold results back — and the fix for each one.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 24, 2026 · 6 min read · Mistakes</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/30-days-mistakes-hero.png"
              alt="A row of five floating glowing rectangular panels, four glowing clean purple and one flickering dim red"
              width={1024}
              height={576}
              className="aspect-[16/9] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/30-days-mistakes-fix.png"
              alt="An abstract glowing purple checkmark shape made of light against a dark background"
              width={1024}
              height={576}
              className="aspect-[16/9] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="max-w-3xl space-y-4 text-white/68">
          {MISTAKES.map((m) => (
            <div key={m.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-white/15 leading-none">{m.n}</span>
                <h2 className="text-[17px] font-bold text-white m-0">{m.title}</h2>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55 mb-2">{m.problem}</p>
              <p className="text-[14px] leading-relaxed text-violet-200/80"><span className="font-bold text-violet-200">Fix: </span>{m.fix}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try It With These Fixed</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              None of these require a different plan — just a more deliberate choice on the settings you already have. See{" "}
              <Link to="/blog/what-is-30-days-ai-trend" className="text-violet-300 hover:underline font-semibold">how the format actually works</Link>{" "}
              for the full step-by-step.
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
