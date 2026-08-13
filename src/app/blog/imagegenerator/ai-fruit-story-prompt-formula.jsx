import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "50 AI Fruit Story Prompts and Viral Drama Ideas",
    description: "Fifty fruit-drama prompts with adaptable ideas and an explanation of why each works.",
    date: "15.05.2026",
    slug: "/blog/best-ai-fruit-story-ideas",
  },
  {
    title: "AI Fruit Story Character Ideas and Storylines",
    description: "Eight fruit-character pairings with clear conflicts and adaptable story hooks.",
    date: "27.05.2026",
    slug: "/blog/ai-fruit-story-character-ideas",
  },
  {
    title: "How to Write Talking Dialogue for AI Fruit Story Videos",
    description: "How mouth-synced talking characters work, plus five dialogue techniques.",
    date: "08.08.2026",
    slug: "/blog/ai-fruit-story-talking-dialogue-tips",
  },
  {
    title: "The Wildest AI Fruit Story Plot Twists (And How to Write Your Own)",
    description: "Five twist structures that outperform a straightforward reveal, with real examples.",
    date: "10.08.2026",
    slug: "/blog/ai-fruit-story-plot-twists",
  },
];

const BY_DRAMA_TYPE = [
  {
    type: "Cheating Reveal",
    formula: "[Character A] discovers [evidence] that [Character B] has been [secret action]. The reveal happens [where/how].",
    example: "Orange Mom finds a restaurant receipt for a date she never went on. The reveal happens at breakfast, in front of the kids.",
  },
  {
    type: "Baby Surprise",
    formula: "[Character A] has been hiding [pregnancy detail] for [time period]. [Character B] finds out when [trigger moment].",
    example: "Strawberry Mom has been hiding morning sickness for three weeks. Boss Mango finds out when she faints at a family dinner.",
  },
  {
    type: "Secret Twin",
    formula: "[Character A] has an alibi that seems impossible because [reason]. The explanation is [twin/lookalike detail].",
    example: "Banana Dad swears he was home all night, but there's video of him across town. He doesn't have a twin. Or does he?",
  },
  {
    type: "Revenge Comeback",
    formula: "[Character A] was wronged by [Character B] [time period] ago. Now [Character A] returns as [power reversal detail].",
    example: "Strawberry Mom was kicked out with nothing six months ago. She returns to the house — as its new owner.",
  },
  {
    type: "Kicked Out",
    formula: "[Character A] is forced to leave by [Character B] over [reason]. [Rescue or reversal] changes everything.",
    example: "Orange Mom is told to leave by her mother-in-law with nothing but a suitcase. Her own mother is waiting outside with a plan.",
  },
];

export default function AIFruitStoryPromptFormula() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Prompt Formula</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Prompt Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How to Write the Perfect AI Fruit Story Prompt (Formula + Examples)
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The difference between a flat fruit-drama video and one people finish watching usually comes down to one sentence: your premise. Here's a repeatable formula for writing a premise that gives Zyvo enough to build a real story arc from.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 9, 2026 · 9 min read · Prompt Guide</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-prompt-formula-thumb.png"
            alt="Two stylized 3D cartoon fruit characters at a table with a glowing recipe card, illustrating the AI Fruit Story prompt formula"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why the premise sentence matters more than anything else</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              You don't write scene-by-scene scripts for an AI Fruit Story — Zyvo's planner does that from one sentence. Which means that one sentence carries almost the entire creative weight of the finished video. A vague premise produces a vague story; a specific one produces a specific, escalating drama.
            </p>
            <p className="text-[17px] leading-relaxed">
              The good news is that a strong premise follows a predictable shape. Once you know the shape, writing a new one takes under a minute.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The 6-part AI Fruit Story prompt formula</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              A strong premise answers six questions. You don't need to write them as a list — one flowing sentence that touches all six is enough.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { n: "1", title: "Who", desc: "Which two or three fruit characters are involved?" },
                { n: "2", title: "What's hidden", desc: "What secret, lie, or truth is being concealed?" },
                { n: "3", title: "Who's discovering it", desc: "Whose point of view does the reveal happen from?" },
                { n: "4", title: "How it's discovered", desc: "A message, a receipt, a photo, a slip of the tongue?" },
                { n: "5", title: "Where it comes to a head", desc: "A dinner table, a doorway, in front of family?" },
                { n: "6", title: "What's at stake", desc: "Trust, family, money, reputation — name it directly." },
              ].map((item) => (
                <div key={item.n} className="rounded-xl border border-[#ECE8F2] bg-white p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] mb-1">{item.n}. {item.title}</div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Weak vs strong: the same idea, two ways</h2>
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-red-400 mb-2">Weak</div>
                <p className="text-[15px] font-semibold text-[#110829] italic">"A fruit couple has an argument."</p>
                <p className="mt-2 text-[13px] text-[#6b7280] leading-relaxed">No secret, no discovery, no stakes. There's nothing for the story planner to escalate.</p>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-green-600 mb-2">Stronger</div>
                <p className="text-[15px] font-semibold text-[#110829] italic">"Orange Mom finds a hotel receipt for a date she never went on, and confronts Banana Dad at breakfast in front of the kids."</p>
                <p className="mt-2 text-[13px] text-[#6b7280] leading-relaxed">Names who, what's hidden, how it's found, where the confrontation happens, and implies the stakes (the kids are watching).</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">The formula by drama type</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Each of Zyvo's drama presets bends the six-part formula slightly. Here's the variant for each, with a filled-in example.
            </p>
            <div className="space-y-4">
              {BY_DRAMA_TYPE.map((item) => (
                <div key={item.type} className="rounded-xl border border-purple-200 bg-purple-50 p-5">
                  <div className="text-[13px] font-bold text-[#110829] mb-2">{item.type}</div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed mb-3"><span className="font-semibold text-[#374151]">Formula:</span> {item.formula}</p>
                  <p className="text-[14px] font-semibold text-[#110829] leading-relaxed italic">"{item.example}"</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Three complete example prompts</h2>
            <div className="space-y-4">
              {[
                "Gangster Pineapple has been secretly paying off Hot Peach's debt for months. Strawberry Mom finds the bank statements and confronts him in the kitchen, certain it means something it doesn't.",
                "Boss Mango tells everyone he's working late every night this month. Orange Mom follows him and finds him at night school, secretly studying for a exam he's embarrassed to admit he's taking.",
                "Banana Dad has been quietly selling his prized comic collection. Orange Kid finds the empty shelves and assumes the worst, until she learns it's paying for her birthday trip.",
              ].map((prompt) => (
                <div key={prompt} className="rounded-xl border border-[#ECE8F2] bg-white p-5 text-[15px] leading-relaxed text-[#374151] italic">"{prompt}"</div>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-[#6b7280] leading-relaxed">
              Notice these aren't all cheating premises — the formula works equally well for misdirection, kindness twists, and comeback stories. The structure matters more than the specific drama type.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Try Your Own Formula</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Fill in the six parts, write it as one sentence, and paste it into <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI Fruit Story maker</Link>. The tool handles the rest — story planning, dialogue, scenes, and animation.
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
