import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "8 AI Fruit Story Character Ideas & Storylines",
    description: "Eight fruit-character pairings with clear conflicts and adaptable story hooks.",
    date: "27.05.2026",
    slug: "/blog/ai-fruit-story-character-ideas",
  },
  {
    title: "8 AI Fruit Story Fan Theories That Are Probably True",
    description: "Playful lore theories connecting the recurring cast into one shared universe.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-fan-theories",
  },
  {
    title: "The Most Iconic AI Fruit Story Couples (And How to Ship Your Own)",
    description: "Four pairing dynamics worth building a series around, and how to design your own.",
    date: "10.08.2026",
    slug: "/blog/ai-fruit-story-couples",
  },
];

const QUESTIONS = [
  {
    q: "A rumor starts about you that isn't true. What do you do?",
    options: [
      { text: "Address it head-on, in front of everyone, immediately.", type: "orange" },
      { text: "Say nothing. Let them wonder if it's true.", type: "pineapple" },
      { text: "Quietly gather receipts. You'll need them later.", type: "ananas" },
      { text: "Turn it into a bit. Let people laugh about it with you.", type: "banana" },
      { text: "Use it as motivation to prove everyone wrong.", type: "peach" },
    ],
  },
  {
    q: "Pick a season finale twist.",
    options: [
      { text: "The villain was right the whole time.", type: "pineapple" },
      { text: "The quiet one had the biggest secret.", type: "ananas" },
      { text: "A comeback nobody saw coming.", type: "peach" },
      { text: "A confession, live, in front of everyone.", type: "orange" },
      { text: "A joke that turns out to be completely true.", type: "banana" },
    ],
  },
  {
    q: "Your best friend betrays you. Your first move?",
    options: [
      { text: "Confront them on camera, no notes.", type: "orange" },
      { text: "Plan something they won't see coming for weeks.", type: "pineapple" },
      { text: "Write it all down. You'll use it eventually.", type: "ananas" },
      { text: "Make a joke about it before they can.", type: "banana" },
      { text: "Get better, quietly, and let the results speak.", type: "peach" },
    ],
  },
  {
    q: "How do you want the audience to feel watching your storyline?",
    options: [
      { text: "On the edge of their seat.", type: "orange" },
      { text: "Slightly scared of you, honestly.", type: "pineapple" },
      { text: "Suspicious of everyone but you.", type: "ananas" },
      { text: "Entertained, even during the sad parts.", type: "banana" },
      { text: "Rooting for you like it's personal.", type: "peach" },
    ],
  },
  {
    q: "Pick your exit line for the episode.",
    options: [
      { text: "\"I know what you did. I have the evidence.\"", type: "orange" },
      { text: "\"You should've asked why I was smiling.\"", type: "pineapple" },
      { text: "\"I didn't say anything. I didn't have to.\"", type: "ananas" },
      { text: "\"Wait, you thought I was serious?\"", type: "banana" },
      { text: "\"They said I'd never make it. I just signed the deal.\"", type: "peach" },
    ],
  },
];

const RESULTS = {
  orange: {
    name: "Orange Mom",
    tag: "The Confrontational Lead",
    emoji: "🍊",
    desc: "You don't do subtext. If something's wrong, you say it out loud, in the room, in front of everyone — and somehow it always makes for the best scene of the episode. You're the character every fruit-drama needs at least one of: the person who forces the plot to actually happen.",
    ideas: "Best cast in: cheating reveals, wedding-day confrontations, ultimatum scenes.",
  },
  pineapple: {
    name: "Gangster Pineapple",
    tag: "The Misunderstood Villain",
    emoji: "🍍",
    desc: "Everyone thinks you're the antagonist for eleven episodes straight — and then episode twelve reveals you were quietly protecting someone the whole time. You play the long game, you don't explain yourself, and the reveal always recolors everything before it.",
    ideas: "Best cast in: sabotage-with-a-secret-reason plots, slow-burn redemption arcs.",
  },
  ananas: {
    name: "Ananas Girl",
    tag: "The Silent Mastermind",
    emoji: "🌱",
    desc: "You barely talk. You don't need to. By the finale it turns out you knew everything — you were just waiting for the right moment. Viewers rewatch your early scenes just to see what they missed the first time.",
    ideas: "Best cast in: background-character-holds-the-secret twists, group-chat-leak plots.",
  },
  banana: {
    name: "Banana Dad",
    tag: "The Chaotic Comic Relief",
    emoji: "🍌",
    desc: "Somehow, whatever's happening, you make it funnier — even the confessions, even the confrontations. You forget the ring. You say the wrong name at the worst time. And somehow the internet loves you more for it.",
    ideas: "Best cast in: comedy-twist plots, forgot-something-important storylines.",
  },
  peach: {
    name: "Hot Peach",
    tag: "The Comeback Underdog",
    emoji: "🍑",
    desc: "You got counted out early — publicly, humiliatingly — and you came back anyway. Your storyline arc is the one people screenshot the final scene of. You're proof the format rewards a good redemption arc more than almost anything else.",
    ideas: "Best cast in: underdog comeback arcs, public-humiliation-to-triumph plots.",
  },
};

export default function AIFruitStoryQuiz() {
  const [answers, setAnswers] = useState([]);
  const current = answers.length;
  const done = current >= QUESTIONS.length;

  const result = useMemo(() => {
    if (!done) return null;
    const counts = {};
    for (const type of answers) counts[type] = (counts[type] || 0) + 1;
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return RESULTS[winner];
  }, [answers, done]);

  function pick(type) {
    setAnswers((prev) => [...prev, type]);
  }

  function restart() {
    setAnswers([]);
  }

  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Character Quiz</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Take the Quiz
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Which AI Fruit Story Character Are You?
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Five questions. No wrong answers, only one very specific fruit personality waiting on the other side.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 17, 2026 · 3 min quiz · Highly Entertaining</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-quiz-hero.png"
            alt="Five stylized 3D cartoon fruit characters lined up under colorful spotlights, each showing a different exaggerated expression"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl">

          {!done && (
            <div className="rounded-2xl border border-[#E5E0F5] bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wide text-[#7A3BFF]">
                  Question {current + 1} of {QUESTIONS.length}
                </span>
                <div className="flex gap-1.5">
                  {QUESTIONS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-6 rounded-full ${i < current ? "bg-[#7A3BFF]" : i === current ? "bg-purple-300" : "bg-[#ECE8F2]"}`}
                    />
                  ))}
                </div>
              </div>
              <h2 className="text-[22px] font-bold text-[#110829] mb-6">{QUESTIONS[current].q}</h2>
              <div className="space-y-3">
                {QUESTIONS[current].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => pick(opt.type)}
                    className="w-full rounded-xl border border-[#E5E0F5] bg-[#F7F5FA] px-5 py-4 text-left text-[15px] font-medium text-[#110829] transition hover:border-[#7A3BFF] hover:bg-purple-50"
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {done && result && (
            <div className="rounded-2xl border border-purple-200 bg-white p-8 text-center shadow-sm">
              <span className="text-[64px] leading-none">{result.emoji}</span>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-[#7A3BFF]">You are</p>
              <h2 className="text-[32px] font-bold text-[#110829] mb-1">{result.name}</h2>
              <p className="mb-6 text-[15px] font-semibold text-[#A855F7]">{result.tag}</p>
              <p className="mx-auto mb-4 max-w-lg text-[16px] leading-relaxed text-[#4A4A55]">{result.desc}</p>
              <p className="mx-auto mb-8 max-w-lg text-[13px] text-[#888]">{result.ideas}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={restart}
                  className="rounded-xl border border-[#E5E0F5] px-6 py-3 text-[14px] font-bold text-[#110829] transition hover:bg-[#F7F5FA]"
                >
                  Retake the Quiz
                </button>
                <Link
                  to="/ai-fruit-story-maker"
                  className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[14px] px-6 py-3 rounded-xl hover:opacity-90 transition"
                >
                  Generate Your Character's Story →
                </Link>
              </div>
            </div>
          )}

          <section className="mt-16 space-y-6 text-[#374151]">
            <h2 className="text-[24px] font-bold text-[#110829]">Not who you expected?</h2>
            <p className="text-[16px] leading-relaxed">
              That's the fun of it — the fruit-drama cast covers five completely different personality archetypes on purpose, so every viewer can find one to project onto. If your result surprised you, try building a story around a character type you don't usually reach for. Check{" "}
              <Link to="/blog/ai-fruit-story-character-ideas" className="text-[#7A3BFF] hover:underline font-semibold">8 character ideas and storylines</Link>{" "}
              for a starting pairing.
            </p>
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
