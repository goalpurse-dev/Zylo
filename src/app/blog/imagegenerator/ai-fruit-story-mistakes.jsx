import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Improve AI Fruit Drama Videos for TikTok",
    description: "Test clearer hooks, story angles, publishing cadence, and audience feedback.",
    date: "15.05.2026",
    slug: "/blog/how-to-go-viral-tiktok-fruit-drama",
  },
  {
    title: "How to Write the Perfect AI Fruit Story Prompt (Formula + Examples)",
    description: "A repeatable 6-part prompt formula, weak-vs-strong examples, and a formula variant for each drama type.",
    date: "09.08.2026",
    slug: "/blog/ai-fruit-story-prompt-formula",
  },
  {
    title: "How to Build an AI Fruit Story Series (Turn One Video Into a Cinematic Universe)",
    description: "Four pillars of a fruit story universe, and a simple way to start your first series.",
    date: "11.08.2026",
    slug: "/blog/ai-fruit-story-series-universe",
  },
];

const MISTAKES = [
  {
    n: "01",
    title: "The premise takes too long to land",
    problem: "If the conflict isn't clear in the first shot, viewers swipe before the story even starts.",
    fix: "Open on the tension itself — a suspicious message, a shocked expression — not a scene-setting introduction. Use the six-part formula in the prompt guide to build this in from the start.",
  },
  {
    n: "02",
    title: "Too many characters in one story",
    problem: "A premise with four or five characters dilutes the conflict and confuses new viewers.",
    fix: "Cap most videos at two or three characters. Save larger ensembles for a payoff episode once viewers already know the cast.",
  },
  {
    n: "03",
    title: "The ending resolves everything",
    problem: "A fully wrapped-up story gives viewers no reason to check back for a follow-up.",
    fix: "Leave one small thread open — a question, a reaction, a consequence not yet shown — and answer it in the next video.",
  },
  {
    n: "04",
    title: "Posting once and stopping",
    problem: "A single video, however strong, doesn't build an audience on its own.",
    fix: "Treat the format as a repeatable system, not a one-off experiment. Consistent posting compounds far more than any individual video's performance.",
  },
  {
    n: "05",
    title: "Every video is a standalone story",
    problem: "Without a recurring cast or world, viewers have nothing to recognize between videos.",
    fix: "Build a small, consistent cast across videos — see the guide to building a fruit story series (linked below) for the full approach.",
  },
  {
    n: "06",
    title: "The caption explains the whole plot",
    problem: "If the caption gives away the twist, there's no reason to watch — or to share it.",
    fix: "Write a short, open-ended caption that raises a question instead of answering one.",
  },
  {
    n: "07",
    title: "Only posting to one platform",
    problem: "TikTok-only distribution caps your video's reach to a single, extremely saturated feed.",
    fix: "Cross-post the same video to Instagram Reels and YouTube Shorts, adjusting the caption and title for each platform's discovery system.",
  },
  {
    n: "08",
    title: "No consistent visual identity",
    problem: "Characters that look slightly different in every video make a series harder to recognize.",
    fix: "Reuse the same character selections across a series so their visual identity stays locked from video to video.",
  },
  {
    n: "09",
    title: "The dialogue explains instead of confronts",
    problem: "Lines that narrate backstory read slower than lines that confront the conflict directly.",
    fix: "Favor direct confrontation over exposition — see the dialogue-writing guide for specific techniques.",
  },
  {
    n: "10",
    title: "No reaction moment to react to",
    problem: "A video with no clear emotional beat gives other creators nothing to duet or stitch.",
    fix: "Build in one unmistakable reaction moment and a short pause after it, so the beat is easy to react to.",
  },
];

export default function AIFruitStoryMistakes() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>Mistakes to Avoid</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Troubleshooting
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            10 Mistakes Killing Your AI Fruit Story Views (And How to Fix Each One)
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Most underperforming fruit-drama videos aren't failing because of the AI — they're failing because of one fixable structural choice. Here are the ten most common mistakes and exactly what to change.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 11, 2026 · 9 min read · Troubleshooting</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-mistakes-hero.png"
            alt="A stylized 3D cartoon fruit character looking discouraged while holding a glowing smartphone in a dim room"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-6 text-[#374151]">

          <p className="text-[17px] leading-relaxed">
            Every mistake below shows up constantly in fruit-drama accounts that plateau after a strong start. None of them require a different tool or a bigger budget to fix — just a different structural choice in the premise, the caption, or the posting habit.
          </p>

          <div className="space-y-4">
            {MISTAKES.map((item) => (
              <div key={item.n} className="rounded-xl border border-[#ECE8F2] bg-white p-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[24px] font-black text-purple-200 leading-none">{item.n}</span>
                  <h2 className="text-[18px] font-bold text-[#110829] m-0">{item.title}</h2>
                </div>
                <p className="text-[13px] text-[#9ca3af] font-bold uppercase tracking-wide mb-1">The problem</p>
                <p className="text-[14px] text-[#6b7280] leading-relaxed mb-3">{item.problem}</p>
                <p className="text-[13px] text-purple-600 font-bold uppercase tracking-wide mb-1">The fix</p>
                <p className="text-[14px] text-[#374151] leading-relaxed">{item.fix}</p>
              </div>
            ))}
          </div>

          <figure className="my-10 overflow-hidden rounded-3xl bg-[#090a0d] p-1.5">
            <img
              src="/blog-assets/ai-fruit-story-detective.png"
              alt="A stylized 3D cartoon fruit character in a detective pose holding a magnifying glass, examining clues"
              width={1200}
              height={675}
              className="mx-auto aspect-[9/16] w-full max-w-[370px] rounded-[19px] object-cover"
              loading="lazy"
            />
          </figure>

          <section className="mt-10">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Fix One Mistake at a Time</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Don't try to fix all ten at once. Pick the one mistake that sounds most familiar, apply the fix to your next premise, and generate it in <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI Fruit Story maker</Link>.
            </p>
            <Link
              to="/ai-fruit-story-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the Paid AI Fruit Story Tool →
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
