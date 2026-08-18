import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is AI Fruit Story? The Complete Guide to TikTok's Viral Cartoon Drama Trend",
    description: "What the format is, how it's actually made, and why it's spreading right now.",
    date: "18.08.2026",
    slug: "/blog/what-is-ai-fruit-story",
  },
  {
    title: "How to Write the Perfect AI Fruit Story Prompt (Formula + Examples)",
    description: "A repeatable 6-part prompt formula, weak-vs-strong examples, and a formula variant for each drama type.",
    date: "09.08.2026",
    slug: "/blog/ai-fruit-story-prompt-formula",
  },
  {
    title: "50 AI Fruit Story Prompts and Viral Drama Ideas",
    description: "Fifty fruit-drama prompts with adaptable ideas and an explanation of why each works.",
    date: "15.05.2026",
    slug: "/blog/best-ai-fruit-story-ideas",
  },
];

const EXAMPLES = [
  {
    img: "/viral-builder/ai-fruit/presets/cheating.webp",
    preset: "Cheating Reveal",
    title: "The classic cheating reveal",
    opening: ["\"Wait — whose number is this in your phone?\"", "\"Do not touch my phone right now.\""],
    desc: "The most-used preset in the format for a reason: instant, universally understood stakes in one line. The generator opens on a shocked expression and a defensive reply, then builds the confrontation from there.",
  },
  {
    img: "/viral-builder/ai-fruit/presets/baby.webp",
    preset: "Baby Surprise",
    title: "The baby reveal",
    opening: ["\"I have something really important to tell you tonight.\"", "\"You are scaring me. What is going on?\""],
    desc: "A slower-burn opener — the tension comes from what's being withheld, not what's already been said. This preset tends to run longer before the actual reveal lands.",
  },
  {
    img: "/viral-builder/ai-fruit/presets/secret-twin.webp",
    preset: "Secret Twin",
    title: "The secret twin mystery",
    opening: ["\"Something is very seriously wrong here.\"", "\"Everything is completely fine. Just trust me.\""],
    desc: "Built around a mismatch between what one character says and what the audience can already see. The generator plays the disagreement straight, letting the visual contradiction do the work.",
  },
  {
    img: "/viral-builder/ai-fruit/presets/kicked-out.webp",
    preset: "Kicked Out",
    title: "The kicked-out confrontation",
    opening: ["\"This situation cannot keep going on like this.\"", "\"What exactly do you mean by that?\""],
    desc: "A doorstep-in-the-rain visual with a suitcase and a slammed door does most of the emotional work before dialogue even starts — this preset leans hardest on composition over line-writing.",
  },
  {
    img: "/viral-builder/ai-fruit/presets/cheats-back.webp",
    preset: "Cheats Back",
    title: "The revenge storyline",
    opening: ["\"I know exactly what you did to me.\"", "\"You do not know everything that happened.\""],
    desc: "A sequel-style premise — it assumes a betrayal already happened and opens on the response instead. Works well as episode two of a series built on the cheating-reveal preset.",
  },
  {
    img: "/viral-builder/ai-fruit/presets/custom.webp",
    preset: "Custom",
    title: "Your own premise, from scratch",
    opening: ["\"We need to have a serious talk right now.\"", "\"Is everything okay with you? What happened?\""],
    desc: "No preset at all — just a written premise. This is the option to use once you've seen how the built-in presets behave and want to build an original storyline with the same structure.",
  },
];

export default function AIFruitStoryExamples() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Examples</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Real Examples
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            6 Real AI Fruit Story Examples You Can Recreate in Minutes
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Real screenshots straight from the generator's built-in presets — the exact opening dialogue, what each one is best at, and how to make your own version.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 18, 2026 · 6 min read · Real Examples</p>
        </header>

        <div className="max-w-4xl space-y-14">

          <p className="text-[17px] leading-relaxed text-[#374151]">
            Every example below is a real starting preset inside Zyvo's AI Fruit Story maker — not a mockup. Each one ships with its own opening exchange, which the generator expands into a full multi-scene story once you pick it.
          </p>

          {EXAMPLES.map((ex, i) => (
            <section key={ex.preset} className="grid gap-6 sm:grid-cols-[220px_1fr] items-start">
              <figure className="overflow-hidden rounded-[20px] border border-[#241b38] bg-[#090a0d] p-1 shadow-[0_16px_40px_rgba(35,20,72,.14)]">
                <img
                  src={ex.img}
                  alt={`Real screenshot of the ${ex.preset} preset in Zyvo's AI Fruit Story generator`}
                  width={220}
                  height={390}
                  className="w-full rounded-[15px] object-cover"
                  loading={i < 2 ? "eager" : "lazy"}
                  {...(i < 2 ? { fetchPriority: "high" } : {})}
                />
              </figure>
              <div>
                <span className="inline-block bg-purple-100 text-purple-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide mb-2">
                  {ex.preset} Preset
                </span>
                <h2 className="text-[22px] font-bold text-[#110829] mb-3">{i + 1}. {ex.title}</h2>
                <div className="rounded-xl border-l-4 border-[#7A3BFF] bg-purple-50/50 px-4 py-3 mb-3 space-y-1">
                  {ex.opening.map((line) => (
                    <p key={line} className="text-[14px] font-semibold text-[#110829] italic">{line}</p>
                  ))}
                </div>
                <p className="text-[14px] text-[#6b7280] leading-relaxed">{ex.desc}</p>
              </div>
            </section>
          ))}

          <section className="pt-4 border-t border-[#E5E0F5]">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try Any of These Right Now</h2>
            <p className="text-[16px] leading-relaxed mb-6 text-[#374151]">
              Every preset above is available directly in the generator — pick one, adjust the characters and setting, and generate your own version. For a fully original storyline, see the{" "}
              <Link to="/blog/ai-fruit-story-prompt-formula" className="text-[#7A3BFF] hover:underline font-semibold">prompt formula guide</Link>.
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
