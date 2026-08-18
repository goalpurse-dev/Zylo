import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Write Talking Dialogue for AI Fruit Story Videos",
    description: "How mouth-synced talking characters work, plus five dialogue techniques that make fruit drama hit harder.",
    date: "08.08.2026",
    slug: "/blog/ai-fruit-story-talking-dialogue-tips",
  },
  {
    title: "The Wildest AI Fruit Story Plot Twists (And How to Write Your Own)",
    description: "Five twist structures that outperform a straightforward reveal, with real examples.",
    date: "10.08.2026",
    slug: "/blog/ai-fruit-story-plot-twists",
  },
  {
    title: "If AI Fruit Story Characters Had a Group Chat",
    description: "What the cast's messages would actually look like between episodes. Completely unofficial.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-group-chat",
  },
];

const LINES = [
  {
    n: "01",
    line: "\"I know what you did. I have the evidence.\"",
    speaker: "Orange Mom",
    tag: "The Accusation",
    why: "The line that started a thousand videos. It works because it withholds exactly one piece of information — what 'it' is — which is precisely enough to keep a scroller from swiping.",
  },
  {
    n: "02",
    line: "\"You should've asked why I was smiling.\"",
    speaker: "Gangster Pineapple",
    tag: "The Villain Reveal",
    why: "Delivered calmly, after the damage is already done. It's a line that only works in hindsight — which is exactly why people rewatch the episode immediately after hearing it.",
  },
  {
    n: "03",
    line: "\"Wait, you thought I was serious?\"",
    speaker: "Banana Dad",
    tag: "The Tension Break",
    why: "The comic-relief line that lands hardest right after the highest-stakes moment. Timing is everything here — a beat too early and it undercuts the drama; a beat too late and the joke dies.",
  },
  {
    n: "04",
    line: "\"They said I'd never make it. I just signed the deal.\"",
    speaker: "Hot Peach",
    tag: "The Comeback",
    why: "Two sentences, zero context, and the entire underdog arc is already implied. Viewers fill in the humiliation backstory themselves — the line doesn't need to explain it.",
  },
  {
    n: "05",
    line: "\"I didn't say anything. I didn't have to.\"",
    speaker: "Ananas Girl",
    tag: "The Quiet Reveal",
    why: "Proof that a great line doesn't need volume. Said flatly, in the middle of chaos, it reframes a background character as the one who was actually in control the whole time.",
  },
  {
    n: "06",
    line: "\"Their families hate each other. They love each other. Someone has to choose.\"",
    speaker: "Narration — Peach & Plum",
    tag: "The Setup Line",
    why: "A one-line premise that does the job of an entire opening scene. If you can compress your story's stakes into a sentence like this, your hook is already working before frame one.",
  },
  {
    n: "07",
    line: "\"You have 24 hours to leave this house.\"",
    speaker: "Watermelon Husband",
    tag: "The Ultimatum",
    why: "A deadline turns a vague conflict into a countdown. Viewers stay specifically to see whether the ultimatum gets followed through — which is the entire function of this line type.",
  },
  {
    n: "08",
    line: "\"The baby isn't yours.\"",
    speaker: "Strawberry Mom",
    tag: "The Cliffhanger",
    why: "Four words, dropped at the exact one-third mark of the video, right before a hard cut. It's become such a recognizable beat that creators now use it half-ironically — and it still works.",
  },
];

export default function AIFruitStoryBestLines() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>Best AI Fruit Story Lines</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Highly Entertaining
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            The Most Iconic AI Fruit Story Lines Ever Written (Ranked)
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Eight lines the format lives and dies on — the exact wording, who said it, and the one structural reason each one actually works.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 17, 2026 · 6 min read · Highly Entertaining</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-best-lines-hero.png"
            alt="A stylized 3D cartoon peach character mid-dramatic line delivery under a single bright spotlight on a dark stage"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <p className="text-[17px] leading-relaxed">
              A fruit-drama video lives or dies on maybe two lines of dialogue — the hook and the twist. Everything else is pacing and expression. Here are eight lines that consistently outperform, and the exact mechanism behind why each one lands.
            </p>
          </section>

          <section>
            <div className="space-y-4">
              {LINES.map((l) => (
                <div key={l.n} className="rounded-2xl border border-[#E5E0F5] bg-white p-6 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[20px] font-black text-[#D8CFF0] leading-none">{l.n}</span>
                    <span className="rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wide">{l.tag}</span>
                  </div>
                  <p className="text-[17px] font-semibold text-[#110829] italic leading-relaxed mb-1">{l.line}</p>
                  <p className="text-[13px] font-bold text-[#7A3BFF] mb-3">— {l.speaker}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{l.why}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">What makes a line "iconic" in this format</h2>
            <p className="text-[17px] leading-relaxed">
              Every line above shares one trait: it withholds exactly one piece of information the viewer wants. Not zero — a line with no mystery is forgettable. Not several — that reads as confusing instead of intriguing. One clean gap, closed a few seconds or a few scenes later, is the whole formula.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Write Your Own Iconic Line</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a line type above, swap in your own characters, and see the{" "}
              <Link to="/blog/ai-fruit-story-talking-dialogue-tips" className="text-[#7A3BFF] hover:underline font-semibold">dialogue guide</Link>{" "}
              for the mouth-sync mechanics. Then generate it in{" "}
              <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI Fruit Story maker</Link>.
            </p>
            <Link
              to="/ai-fruit-story-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the AI Fruit Story Tool →
            </Link>
          </section>

        </div>

        <div className="mt-20">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
