import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, CopyCheck } from "lucide-react";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Go Viral on TikTok with AI Fruit Drama Videos (2026)",
    description: "A practical TikTok strategy for AI fruit drama, including hooks, publishing cadence, and audience testing.",
    date: "15.05.2026",
    slug: "/blog/how-to-go-viral-tiktok-fruit-drama",
  },
  {
    title: "AI Fruit Story Maker: Create Viral Fruit Drama Videos in 2026",
    description: "How Zyvo's AI Fruit Story maker turns a prompt into a multi-scene vertical video workflow.",
    date: "14.05.2026",
    slug: "/ai-fruit-story-maker",
  },
  {
    title: "AI Fruit Drama Videos: Story Structure and Workflow",
    description: "Inside the AI fruit drama format — what makes it work and why it dominates TikTok.",
    date: "14.05.2026",
    slug: "/blog/viral-ai-fruit-drama-videos",
  },
  {
    title: "The Wildest AI Fruit Story Plot Twists (And How to Write Your Own)",
    description: "Five twist structures that outperform a straightforward reveal, with real examples.",
    date: "10.08.2026",
    slug: "/blog/ai-fruit-story-plot-twists",
  },
  {
    title: "The Most Unhinged AI Fruit Story Plots We've Ever Generated",
    description: "Ten genuinely deranged fruit-drama premises, ranked by chaos level, free to steal.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-unhinged-plots",
  },
  {
    title: "6 Real AI Fruit Story Examples You Can Recreate in Minutes",
    description: "Real preset screenshots from the generator, with the exact opening lines used in each.",
    date: "18.08.2026",
    slug: "/blog/ai-fruit-story-examples",
  },
  {
    title: "Is AI Fruit Story Free? Pricing, Credits, and What You Actually Get",
    description: "Character portraits, scene images, and scene video — what a story actually costs.",
    date: "19.08.2026",
    slug: "/blog/ai-fruit-story-pricing",
  },
];

const IDEAS = [
  {
    category: "Cheating Reveals",
    color: "#A855F7",
    bg: "bg-purple-50",
    border: "border-purple-200",
    ideas: [
      { prompt: "Orange Mom finds suspicious messages on Banana Dad's phone while he's in the shower. She reads them out loud.", why: "The 'reading messages out loud' device is extremely viral. Viewers feel like they're discovering alongside the character." },
      { prompt: "Boss Mango comes home early from a work trip to surprise his wife, but the surprise is on him.", why: "The 'early return' setup creates instant tension. Every viewer knows what's about to happen — and still watches." },
      { prompt: "Strawberry Mom asks Gangster Pineapple to unlock his phone and show her his recent calls. He refuses once. Then again. Then she sees why.", why: "The escalating refusal before the reveal builds unbearable tension in under 30 seconds." },
      { prompt: "Orange Mom finds a receipt for a restaurant she's never been to, on a date she thought Banana Dad was working late.", why: "Physical proof (the receipt) is more convincing than messages. Viewers trust it and share it." },
    ]
  },
  {
    category: "Baby Surprises",
    color: "#22C55E",
    bg: "bg-green-50",
    border: "border-green-200",
    ideas: [
      { prompt: "Orange Mom has been hiding morning sickness from Banana Dad for three weeks. The moment she can't hide it anymore — caught on camera.", why: "The 'hiding a secret' arc before the reveal creates a second emotional layer. You feel the relief of the truth coming out." },
      { prompt: "Boss Mango thinks Orange Mom is planning to leave him. She's actually planning to tell him they're having twins.", why: "The misdirection makes the reveal hit twice as hard. Viewers feel the whiplash of going from heartbreak to joy." },
      { prompt: "Strawberry Mom tells her mother-in-law she has 'important news' about the family — then reveals the pregnancy at the dinner table.", why: "Family reaction content is enormously shareable. When multiple people react simultaneously it multiplies the emotional impact." },
    ]
  },
  {
    category: "Secret Twin Twists",
    color: "#EAB308",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    ideas: [
      { prompt: "Banana Dad swears he was home all evening. Orange Mom's friend has video of him at a restaurant across town at the same time. He doesn't have a twin. Or does he?", why: "The impossible alibi setup forces the viewer to keep watching. There has to be an explanation — and they need to see it." },
      { prompt: "Orange Mom meets her husband's 'work colleague' at a party. She looks exactly like her. Then the colleague says something only her husband would know.", why: "The twin reveal works best when it's impossible to predict. This one adds the extra layer of 'how does she know that?'" },
    ]
  },
  {
    category: "Revenge Comebacks",
    color: "#F97316",
    bg: "bg-orange-50",
    border: "border-orange-200",
    ideas: [
      { prompt: "Six months after Banana Dad left Orange Mom for Hot Peach, he sees her at an event. She's unrecognisable. He immediately regrets everything.", why: "The glow-up reveal is the most emotionally satisfying moment in any comeback story. The contrast carries all the weight." },
      { prompt: "Strawberry Mom was kicked out with nothing. She returns to the house — as the new owner. The bank sold it to her.", why: "The power reversal needs to be unexpected and definitive. Owning the house is more powerful than just 'doing well.'" },
      { prompt: "Boss Mango cheated and was exposed publicly. Orange Mom didn't respond, didn't post, didn't react. Three months later, everyone finds out why.", why: "The delayed reaction creates suspense. Viewers check your account for Part 2. Your follower count compounds." },
    ]
  },
  {
    category: "Kicked Out Stories",
    color: "#3B82F6",
    bg: "bg-blue-50",
    border: "border-blue-200",
    ideas: [
      { prompt: "Orange Mom is told to leave by her mother-in-law with nothing but a suitcase. Her own mother is waiting outside with a plan.", why: "The rescue dynamic adds a second protagonist to root for. Viewers share this because they want the mother to 'win.'" },
      { prompt: "Banana Dad kicks his son out for a decision he disagrees with. Two years later, he needs his son's help — and has to go to him.", why: "Role reversal payoffs are deeply satisfying. The person who was powerless now holds all the power." },
    ]
  },
];

const QUICK_PROMPTS = [
  {
    category: "Workplace & Business Drama",
    color: "#7A3BFF",
    prompts: [
      "Boss Mango promotes an outsider over Gangster Pineapple, who's been loyal for years — until everyone learns why.",
      "Hot Peach discovers her business partner has been quietly recording their calls for months.",
      "Orange Kid gets fired for a mistake that was actually Banana Dad's fault the whole time.",
      "Strawberry Mom opens a shop across from her former boss, using everything she learned working for him.",
      "Ananas Girl finds out her coworker has been taking credit for her ideas in every meeting.",
      "Gangster Pineapple quits on the spot — then the whole team quits with him the next morning.",
    ],
  },
  {
    category: "Friendship Betrayal",
    color: "#22C55E",
    prompts: [
      "Orange Mom finds out her best friend has been dating her ex the entire time she was comforting her about the breakup.",
      "Hot Peach lends Banana Dad money for an emergency — then sees him post about a vacation the next week.",
      "Strawberry Mom's childhood friend reveals she's been telling everyone their secrets for years.",
      "Boss Mango throws a surprise party for his best friend, who forgot his birthday completely.",
      "Ananas Girl is left out of a group trip photo everyone else was invited to.",
      "Gangster Pineapple finds out his 'ride or die' friend never actually showed up when it mattered.",
    ],
  },
  {
    category: "Family Secrets",
    color: "#EAB308",
    prompts: [
      "Orange Kid finds an old letter proving Grandpa Mango isn't who the family thought he was.",
      "Strawberry Mom discovers she has a half-sibling nobody in the family ever mentioned.",
      "Banana Dad's mother reveals she's been secretly funding the family business for a decade.",
      "Hot Peach finds out her 'inheritance' was never real — it was her aunt's money the whole time.",
      "Boss Mango's father shows up after fifteen years, right before a family wedding.",
      "Ananas Girl uncovers a decades-old family feud nobody wanted to explain to her.",
    ],
  },
  {
    category: "Roommate Chaos",
    color: "#3B82F6",
    prompts: [
      "Gangster Pineapple's roommate has been using his shampoo, his charger, and now his car — without asking.",
      "Orange Kid comes home to find their roommate threw a party they weren't invited to, in their own apartment.",
      "Hot Peach discovers her roommate has been subletting her room on weekends without telling her.",
      "Banana Dad's new roommate turns out to be his childhood rival from summer camp.",
      "Strawberry Mom finds her roommate's 'guest' has basically been living there for two months.",
      "Boss Mango and his roommate finally confront each other about the world's messiest kitchen.",
    ],
  },
  {
    category: "Money & Debt",
    color: "#F97316",
    prompts: [
      "Ananas Girl lends her savings to a friend who suddenly stops answering her calls.",
      "Orange Mom discovers Banana Dad has a secret credit card with a shocking balance.",
      "Hot Peach's business partner has been skimming from the register for months.",
      "Gangster Pineapple wins big and has to decide whether to tell his family or keep it quiet.",
      "Strawberry Mom finds out her 'investment' from a friend was actually just her own money moved around.",
      "Boss Mango co-signs a loan for a friend who immediately disappears.",
    ],
  },
  {
    category: "Wedding & Engagement Drama",
    color: "#EC4899",
    prompts: [
      "Orange Kid's fiancé's ex shows up uninvited to the engagement dinner.",
      "Hot Peach finds out her wedding planner double-booked her venue with another couple.",
      "Banana Dad discovers his best man has feelings for the bride, days before the wedding.",
      "Strawberry Mom's future mother-in-law tries to rewrite the entire guest list without asking.",
      "Gangster Pineapple proposes at the worst possible moment — during his ex's toast.",
      "Ananas Girl's sister reveals a secret right as the vows are about to start.",
    ],
  },
];

function QuickPromptCard({ prompt }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable — copy button simply won't confirm
    }
  };

  return (
    <div className="rounded-xl border border-[#ECE8F2] bg-white p-4">
      <p className="text-[13px] leading-relaxed text-[#374151]">{prompt}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#ECE8F2] bg-[#F7F5FA] px-2.5 py-1 text-[11px] font-bold text-[#7A3BFF] transition hover:bg-purple-100"
      >
        {copied ? <CopyCheck size={11} /> : <Copy size={11} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function BestAIFruitStoryIdeas() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>50 AI Fruit Story Prompts</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Content Ideas
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            50 AI Fruit Story Prompts and Viral Drama Ideas
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Fifty fruit-drama prompts for TikTok and Instagram Reels — fourteen full ideas with the storytelling principle behind each, plus thirty-six quick-fire prompts across six more drama categories.
          </p>
          <p className="text-[13px] text-[#999] mt-5">May 15, 2026 · 14 min read · Content Ideas</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-ideas-hero.png"
            alt="Cute stylized 3D cartoon fruit characters brainstorming around a table under a glowing idea lightbulb"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        {/* Characters showcase */}
        <div className="mb-16 flex flex-wrap justify-center gap-3">
          {[
            { src: "/viral-builder/ai-fruit/characters/orangemom.png",        name: "Orange Mom" },
            { src: "/viral-builder/ai-fruit/characters/banana.png",           name: "Banana Dad" },
            { src: "/viral-builder/ai-fruit/characters/hotpeach.webp",        name: "Hot Peach" },
            { src: "/viral-builder/ai-fruit/characters/bossmango.png",        name: "Boss Mango" },
            { src: "/viral-builder/ai-fruit/characters/strawberrymom.png",    name: "Strawberry Mom" },
            { src: "/viral-builder/ai-fruit/characters/gangsterpineapple.png",name: "Gangster Pineapple" },
            { src: "/viral-builder/ai-fruit/characters/ananasgirl.png",       name: "Ananas Girl" },
            { src: "/viral-builder/ai-fruit/characters/lemonkid.webp",        name: "Lemon Kid" },
          ].map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="h-[68px] w-[54px] overflow-hidden rounded-[14px] border border-[#ECE8F2] bg-white shadow-sm">
                <img src={c.src} alt={`${c.name} AI fruit story character`} className="h-full w-full object-cover object-top" loading="lazy" />
              </div>
              <span className="text-[10px] text-[#9ca3af]">{c.name}</span>
            </div>
          ))}
        </div>

        <div className="prose-custom max-w-3xl space-y-6 text-[#374151]">

          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 mb-10">
            <p className="text-[15px] text-[#7A3BFF] font-semibold mb-2">How to use these ideas</p>
            <p className="text-[14px] text-[#374151] leading-relaxed">
              Copy any prompt below and paste it directly into <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI Fruit Story builder</Link>. The tool uses your prompt to plan the story arc, generate the scenes, and animate talking characters. Generation time varies by settings and queue conditions.
            </p>
          </div>

          {IDEAS.map((category, ci) => (
            <section key={ci}>
              <h2 className="text-[26px] font-bold text-[#110829] mb-5 flex items-center gap-3">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: category.color }} />
                {category.category}
              </h2>
              <div className="space-y-4">
                {category.ideas.map((idea, ii) => (
                  <div key={ii} className={`rounded-xl border ${category.border} ${category.bg} p-5`}>
                    <div className="mb-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] mb-2">PROMPT</div>
                      <p className="text-[15px] font-semibold text-[#110829] leading-relaxed italic">"{idea.prompt}"</p>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] mb-1">WHY IT WORKS</div>
                      <p className="text-[13px] text-[#6b7280] leading-relaxed">{idea.why}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="mt-10">
            <h2 className="text-[26px] font-bold text-[#110829] mb-3">36 More Quick-Fire Prompts</h2>
            <p className="text-[15px] leading-relaxed mb-6">
              Fourteen down, thirty-six to go. These are shorter — pick one, adapt the characters, and paste it straight into the generator.
            </p>
            {QUICK_PROMPTS.map((category, ci) => (
              <div key={ci} className="mb-10">
                <h3 className="text-[18px] font-bold text-[#110829] mb-4 flex items-center gap-2.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: category.color }} />
                  {category.category}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {category.prompts.map((prompt) => (
                    <QuickPromptCard key={prompt} prompt={prompt} />
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="mt-10">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">What Makes a Fruit Drama Idea Go Viral</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              Every idea above shares four structural elements. Understanding them lets you generate your own viral ideas endlessly:
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "An unanswered question in the first 2 seconds", desc: "\"Whose number is this?\" \"What was in the bag?\" The viewer needs to need an answer before they've made a conscious decision to keep watching." },
                { title: "A clear emotional stake", desc: "Viewers need to care what happens to someone. That person needs to either win or lose something real — love, trust, power, family." },
                { title: "A revelation the viewer didn't fully predict", desc: "The best twists are ones viewers can see in retrospect but couldn't see coming. The twin was always there. The receipt was always visible. They just didn't connect it yet." },
                { title: "An ending that demands a Part 2", desc: "Don't resolve everything. Leave one unanswered question. The best-performing series end each episode with a new problem, not a solution." },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-[#ECE8F2] bg-white p-5">
                  <div className="text-[13px] font-bold text-[#110829] mb-2">{i + 1}. {item.title}</div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Generate Any of These Ideas in Minutes</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Every prompt above works directly in Zyvo's <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">AI Fruit Story maker</Link>. Pick an idea, adapt the prompt, choose your characters, and use the workspace to generate the script, scenes, animation, and talking characters.
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
