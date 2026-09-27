import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How Long Does a 30 Days Video Take to Make?",
    description: "What actually happens during generation, start to finish.",
    date: "18.08.2026",
    slug: "/blog/30-days-time",
  },
  {
    title: "How to Write a Viral 30 Days Premise (Formula + Examples)",
    description: "The premise structure that gives the planner enough to work with.",
    date: "26.08.2026",
    slug: "/blog/30-days-premise-formula",
  },
  {
    title: "How to Write a Cliffhanger That Makes Your Next 30 Days Episode a Must-Watch",
    description: "What actually makes an ending pull viewers into the next episode.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-cliffhangers",
  },
];

const PRINCIPLES = [
  { title: "The script is written to fill your actual video length", desc: "Once your scenes finish rendering, the AI watches the real finished clips and writes narration sized to that exact runtime — not a generic one-size script reused regardless of how long your video actually came out." },
  { title: "It's written to be said, not read as bullet points", desc: "The AI is deliberately told to write like someone excitedly telling a friend what happened — one flowing story with real causal transitions, not a list of scene summaries stitched together." },
  { title: "You get one clean pass to review before it costs anything", desc: "The narration script (hook + full narration) is written and shown to you first. Reading it out loud once before generating catches almost everything — awkward phrasing, a line that's too long, a beat that doesn't land." },
  { title: "\"Regenerate prompt\" is there for a reason", desc: "If the first draft doesn't feel right, you don't have to hand-edit it into something that works — regenerating writes a fresh pass from the same finished clips, still perfectly synced to your video's real length." },
];

export default function ThirtyDaysVoiceoverSync() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-300">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">30 Days</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Craft
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Getting Perfect Voiceover Sync in 30 Days
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A voiceover that runs shorter than your video leaves dead air at the end. Here's what actually decides how long the narration is, and how to get it right before you spend a generation on it.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 28, 2026 · 4 min read · Craft</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-voiceover-sync-hero.png"
            alt="A glowing green audio waveform made of vertical bars floating in dark space"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <p className="text-[15px] font-bold text-white mb-1.5">{p.title}</p>
              <p className="text-[14px] leading-relaxed text-white/55">{p.desc}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">What happens after you click Generate</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              The voiceover audio is timed against your actual clips, and there's a small amount of automatic stretch or compression to lock the two together perfectly. That's meant to fix tiny rounding differences, not carry a script that's meaningfully too short or too long — which is exactly why reviewing the draft first, rather than clicking Generate voiceover immediately, is worth the extra ten seconds.
            </p>
            <p className="text-[16px] leading-relaxed mb-6">
              This works the same way whether you're finishing a single video or narrating one episode of a{" "}
              <Link to="/blog/what-is-30-days-series-mode" className="text-lime-300 hover:underline font-semibold">30 Days Series</Link> — the script is always written against the clips that actually rendered, not against an assumption of how long they should have been.
            </p>
            <Link
              to="/30-days-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Start a 30 Days video
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
