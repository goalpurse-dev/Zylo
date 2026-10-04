import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, CopyCheck } from "lucide-react";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";
import MakeFruitVideoButton from "../../../components/seo/MakeFruitVideoButton.jsx";
import { optImg } from "../../../lib/optImage.js";

const related = [
  {
    title: "40 AI Fruit Story Character Names, Grouped by Fruit",
    description: "A naming shortcut for your next fruit-drama cast.",
    date: "21.08.2026",
    slug: "/blog/ai-fruit-story-character-names",
  },
  {
    title: "AI Fruit Story vs Kit Swap: Scripted Drama or One-Line Cameo?",
    description: "Both formats build content around a talking character, at opposite paces.",
    date: "21.08.2026",
    slug: "/blog/fruit-story-vs-kit-swap",
  },
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
    title: "Is AI Fruit Story Free? Pricing and Credits",
    description: "It needs a paid plan and uses credits. What scene pictures and video cost.",
    date: "19.08.2026",
    slug: "/blog/ai-fruit-story-pricing",
  },
];

const SLUG = "blog/best-ai-fruit-story-ideas";

// Every prompt names characters from the tool's library by first name; `cast`
// holds their library ids (at most 3), so "Make this video" opens the tool
// with the cast already set. tests/fruitStoryPages.test.mjs checks the ids.
const IDEAS = [
  {
    category: "Cheating Reveals",
    color: "#A855F7",
    bg: "bg-purple-50",
    border: "border-purple-200",
    ideas: [
      { prompt: "Mia finds suspicious messages on Marco's phone while he's in the shower. She reads them out loud.", cast: ["mia", "marco"], why: "The 'reading messages out loud' device is extremely viral. Viewers feel like they're discovering alongside the character." },
      { prompt: "Rick comes home early from a work trip to surprise Margaret, but the surprise is on him.", cast: ["rick", "marg"], why: "The 'early return' setup creates instant tension. Every viewer knows what's about to happen — and still watches." },
      { prompt: "Fiona asks Pete to unlock his second phone and show her his recent calls. He refuses once. Then again. Then she sees why.", cast: ["fiona", "pete"], why: "The escalating refusal before the reveal builds unbearable tension in under 30 seconds." },
      { prompt: "Mia finds a receipt for a restaurant she's never been to, on a night Marco said he was working late.", cast: ["mia", "marco"], why: "Physical proof (the receipt) is more convincing than messages. Viewers trust it and share it." },
    ]
  },
  {
    category: "Baby Surprises",
    color: "#22C55E",
    bg: "bg-green-50",
    border: "border-green-200",
    ideas: [
      { prompt: "Bella has been hiding morning sickness from Benny for three weeks. The moment she can't hide it anymore, he walks in.", cast: ["bella", "benny"], why: "The 'hiding a secret' arc before the reveal creates a second emotional layer. You feel the relief of the truth coming out." },
      { prompt: "Marco thinks Mia is planning to leave him. She's actually planning to tell him they're having twins.", cast: ["marco", "mia"], why: "The misdirection makes the reveal hit twice as hard. Viewers feel the whiplash of going from heartbreak to joy." },
      { prompt: "Olivia tells Sally she has 'important news' about the family, then reveals the pregnancy at the dinner table.", cast: ["olive", "sally"], why: "Family reaction content is enormously shareable. When multiple people react simultaneously it multiplies the emotional impact." },
    ]
  },
  {
    category: "Secret Twin Twists",
    color: "#EAB308",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    ideas: [
      { prompt: "Marco swears to Mia he was home all evening. Kiki has a video of him at a restaurant across town at the same time. He doesn't have a twin. Or does he?", cast: ["marco", "kiki", "mia"], why: "The impossible alibi setup forces the viewer to keep watching. There has to be an explanation — and they need to see it." },
      { prompt: "Margaret meets Rick's new 'work colleague' at a party. She looks exactly like her. Then the colleague says something only Rick would know.", cast: ["marg", "rick"], why: "The twin reveal works best when it's impossible to predict. This one adds the extra layer of 'how does she know that?'" },
    ]
  },
  {
    category: "Revenge Comebacks",
    color: "#F97316",
    bg: "bg-orange-50",
    border: "border-orange-200",
    ideas: [
      { prompt: "Six months after Marco left Mia for Pia, he sees her at an event. She's unrecognisable. He immediately regrets everything.", cast: ["marco", "mia", "pia"], why: "The glow-up reveal is the most emotionally satisfying moment in any comeback story. The contrast carries all the weight." },
      { prompt: "Olivia was kicked out by Sally with nothing. She returns to the house as the new owner. The bank sold it to her.", cast: ["olive", "sally"], why: "The power reversal needs to be unexpected and definitive. Owning the house is more powerful than just 'doing well.'" },
      { prompt: "Rick cheated and was exposed in front of the whole company. Margaret didn't respond, didn't post, didn't react. Three months later, everyone finds out why.", cast: ["rick", "marg"], why: "The delayed reaction creates suspense. Viewers check your account for Part 2. Your follower count compounds." },
    ]
  },
  {
    category: "Kicked Out Stories",
    color: "#3B82F6",
    bg: "bg-blue-50",
    border: "border-blue-200",
    ideas: [
      { prompt: "Sally tells Olivia to leave with nothing but a suitcase. Grace is waiting outside with a plan.", cast: ["sally", "olive", "grace"], why: "The rescue dynamic adds a second protagonist to root for. Viewers share this because they want the grandmother to 'win.'" },
      { prompt: "Pete kicks Andy out over a decision he disagrees with. Two years later, Pete needs his son's help and has to go to him.", cast: ["pete", "andy"], why: "Role reversal payoffs are deeply satisfying. The person who was powerless now holds all the power." },
    ]
  },
];

const QUICK_PROMPTS = [
  {
    category: "Workplace & Business Drama",
    color: "#7A3BFF",
    prompts: [
      { prompt: "Rick promotes an outsider over Greg, who has been loyal for years, until everyone learns why.", cast: ["rick", "greg"] },
      { prompt: "Candy discovers her business partner Vic has been quietly recording their calls for months.", cast: ["candy", "vic"] },
      { prompt: "Greg gets fired for a mistake that was Vic's fault the whole time.", cast: ["greg", "vic"] },
      { prompt: "Margaret opens a company across the street from Rick, using everything she learned building his.", cast: ["marg", "rick"] },
      { prompt: "Bella finds out Vic has been taking credit for her ideas in every meeting.", cast: ["bella", "vic"] },
      { prompt: "Gloria quits on the spot after 19 years. The next morning Rick finds the whole office has quit with her.", cast: ["gloria", "rick"] },
    ],
  },
  {
    category: "Friendship Betrayal",
    color: "#22C55E",
    prompts: [
      { prompt: "Kiki finds out her best friend Ana has been dating her ex the entire time she was comforting her about the breakup.", cast: ["kiki", "ana"] },
      { prompt: "Kiki lends Benny money for an emergency, then sees him post about a vacation the next week.", cast: ["kiki", "benny"] },
      { prompt: "Maya admits she has been telling everyone Kiki's secrets for years.", cast: ["maya", "kiki"] },
      { prompt: "Benny throws a surprise party for his best friend Milo, who forgot Benny's birthday completely.", cast: ["benny", "milo"] },
      { prompt: "Ana is left out of a group trip photo that Paige and Kiki are both in.", cast: ["ana", "paige", "kiki"] },
      { prompt: "Big Pina finds out Coco, his ride-or-die, never showed up when it mattered.", cast: ["pina", "coco"] },
    ],
  },
  {
    category: "Family Secrets",
    color: "#EAB308",
    prompts: [
      { prompt: "Andy finds an old letter proving Grandpa Gus isn't who the family thought he was.", cast: ["andy", "gus"] },
      { prompt: "Maya discovers she has a half-sibling Manny never mentioned.", cast: ["maya", "manny"] },
      { prompt: "Grace reveals she has been secretly funding Pete's family business for a decade.", cast: ["grace", "pete"] },
      { prompt: "Andy finds out his inheritance was never real. It was Georgia's money the whole time.", cast: ["andy", "georgia"] },
      { prompt: "Gus shows up after fifteen years, right before Olivia's family wedding.", cast: ["gus", "olive"] },
      { prompt: "Jade uncovers a decades-old family feud that Grace never wanted to explain to her.", cast: ["jade", "grace"] },
    ],
  },
  {
    category: "Roommate Chaos",
    color: "#3B82F6",
    prompts: [
      { prompt: "Milo has been using Benny's shampoo, his charger, and now his car, without asking.", cast: ["milo", "benny"] },
      { prompt: "Jade comes home to find her roommate Ana threw a party she wasn't invited to, in her own apartment.", cast: ["jade", "ana"] },
      { prompt: "Kiki discovers her roommate Paige has been subletting her room on weekends without telling her.", cast: ["kiki", "paige"] },
      { prompt: "Benny's new roommate turns out to be Adam, his childhood rival from summer camp.", cast: ["benny", "adam"] },
      { prompt: "Maya finds that Milo, her roommate's 'guest', has basically been living there for two months.", cast: ["maya", "milo"] },
      { prompt: "Benny and Milo finally confront each other about the world's messiest kitchen.", cast: ["benny", "milo"] },
    ],
  },
  {
    category: "Money & Debt",
    color: "#F97316",
    prompts: [
      { prompt: "Abby lends her savings to Candy, who suddenly stops answering her calls.", cast: ["abby", "candy"] },
      { prompt: "Mia discovers Marco has a secret credit card with a shocking balance.", cast: ["mia", "marco"] },
      { prompt: "Ali finds out Greg has been skimming from the restaurant's register for months.", cast: ["ali", "greg"] },
      { prompt: "Milo wins big and has to decide whether to tell Maya and the family or keep it quiet.", cast: ["milo", "maya"] },
      { prompt: "Georgia finds out her 'investment' with Candy was just her own money moved around.", cast: ["georgia", "candy"] },
      { prompt: "Walt co-signs a loan for Marco, who immediately disappears.", cast: ["walt", "marco"] },
    ],
  },
  {
    category: "Wedding & Engagement Drama",
    color: "#EC4899",
    prompts: [
      { prompt: "Pia shows up uninvited to Bella and Benny's engagement dinner. She is Benny's ex.", cast: ["pia", "bella", "benny"] },
      { prompt: "Paige finds out Dina, her wedding planner, double-booked the venue with another couple.", cast: ["paige", "dina"] },
      { prompt: "Benny discovers his best man Adam has feelings for Bella, days before the wedding.", cast: ["benny", "adam", "bella"] },
      { prompt: "Sally tries to rewrite Olivia's entire guest list without asking.", cast: ["sally", "olive"] },
      { prompt: "Manny interrupts the toast to explain exactly why he hates the groom, Benny.", cast: ["manny", "benny"] },
      { prompt: "Maya reveals a family secret right as Mia's vows are about to start.", cast: ["maya", "mia"] },
    ],
  },
];

const CAST_STRIP = [
  { id: "mia", name: "Mia Mango" },
  { id: "marco", name: "Marco Mango" },
  { id: "pia", name: "Pia Peach" },
  { id: "rick", name: "Rick Crisp" },
  { id: "marg", name: "Margaret Crisp" },
  { id: "bella", name: "Bella Berry" },
  { id: "olive", name: "Olivia Orange" },
  { id: "sally", name: "Sally Strawberry" },
];

// Copy + "Make this video" for one prompt.
function PromptActions({ prompt, cast }) {
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
    <div className="mt-3 flex flex-wrap gap-2">
      <MakeFruitVideoButton prompt={prompt} castIds={cast} slug={SLUG}
        className="rounded-lg bg-[#7A3BFF] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#6a2ff0]" />
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#ECE8F2] bg-[#F7F5FA] px-2.5 py-1 text-[11px] font-bold text-[#7A3BFF] transition hover:bg-purple-100"
      >
        {copied ? <CopyCheck size={11} /> : <Copy size={11} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function QuickPromptCard({ prompt, cast }) {
  return (
    <div className="rounded-xl border border-[#ECE8F2] bg-white p-4">
      <p className="text-[13px] leading-relaxed text-[#374151]">{prompt}</p>
      <PromptActions prompt={prompt} cast={cast} />
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
          <Link to="/blog/category/fruit-stories" className="hover:text-[#7A3BFF]">Fruit Stories</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Prompts</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Prompts
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            AI Fruit Story Prompts: 50 Copy-Paste Ideas for Fruit Drama Videos
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Fifty AI fruit story prompts for TikTok, Reels and Shorts: fourteen full ideas with the reason each one works, plus thirty-six quick prompts in six more categories. Every AI fruit video prompt here uses real characters from the generator, so you can copy it or open it in the tool with one click.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Updated October 5, 2026 · 14 min read · Prompts</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            {...optImg("/blog-assets/ai-fruit-story-ideas-hero.png", "(min-width: 1024px) 896px, 100vw", 960)}
            alt="Cute stylized 3D cartoon fruit characters brainstorming around a table under a glowing idea lightbulb"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        {/* Characters used in the prompts */}
        <div className="mb-16 flex flex-wrap justify-center gap-3">
          {CAST_STRIP.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-1.5">
              <div className="h-[68px] w-[54px] overflow-hidden rounded-[14px] border border-[#ECE8F2] bg-white shadow-sm">
                <img {...optImg(`/lp/fruit/characters/${c.id}.jpg`, "54px", 240)} alt={`${c.name}, an AI fruit story character`} width={54} height={68} className="h-full w-full object-cover object-top" loading="lazy" decoding="async" />
              </div>
              <span className="text-[10px] text-[#9ca3af]">{c.name}</span>
            </div>
          ))}
        </div>

        <div className="prose-custom max-w-3xl space-y-6 text-[#374151]">

          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 mb-10">
            <p className="text-[15px] text-[#7A3BFF] font-semibold mb-2">How to use these prompts</p>
            <p className="text-[14px] text-[#374151] leading-relaxed">
              Press &ldquo;Make this video&rdquo; to open a prompt in Zyvo&apos;s <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">AI fruit story generator</Link> with the story and its characters already filled in, or copy the text and change it first. The names are characters from the tool&apos;s library of 150, so they look the same in every scene. Swap them for any others you like. Making a video needs a paid plan.
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
                      <PromptActions prompt={idea.prompt} cast={idea.cast} />
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
            <h2 className="text-[26px] font-bold text-[#110829] mb-3">36 More AI Fruit Story Prompts</h2>
            <p className="text-[15px] leading-relaxed mb-6">
              Fourteen down, thirty-six to go. These are shorter: pick one, change the characters if you like, and open it in the generator.
            </p>
            {QUICK_PROMPTS.map((category, ci) => (
              <div key={ci} className="mb-10">
                <h3 className="text-[18px] font-bold text-[#110829] mb-4 flex items-center gap-2.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: category.color }} />
                  {category.category}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {category.prompts.map((item) => (
                    <QuickPromptCard key={item.prompt} prompt={item.prompt} cast={item.cast} />
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
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Turn Any Prompt Into a Video or a Series</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Every prompt above works in Zyvo&apos;s <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">AI Fruit Story maker</Link>. The tool writes the script, makes a picture for every scene so you can check them, then animates the characters saying their lines. If an idea is too big for one video, the same cast can carry <Link to="/ai-fruit-story-maker#series" className="text-[#7A3BFF] hover:underline font-semibold">a series of up to 10 episodes</Link>, each ending on a cliffhanger. To write your own, use the <Link to="/blog/ai-fruit-story-prompt-formula" className="text-[#7A3BFF] hover:underline font-semibold">prompt formula</Link>.
            </p>
            <Link
              to="/ai-fruit-story-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              See the AI Fruit Story Generator →
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
