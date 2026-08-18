import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Which AI Fruit Story Character Are You? Take the Quiz",
    description: "Five questions, one very specific fruit personality waiting on the other side.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-quiz",
  },
  {
    title: "How to Build an AI Fruit Story Series (Turn One Video Into a Cinematic Universe)",
    description: "Four pillars of a fruit story universe, and a simple way to start your first series.",
    date: "11.08.2026",
    slug: "/blog/ai-fruit-story-series-universe",
  },
  {
    title: "The Wildest AI Fruit Story Plot Twists (And How to Write Your Own)",
    description: "Five twist structures that outperform a straightforward reveal, with real examples.",
    date: "10.08.2026",
    slug: "/blog/ai-fruit-story-plot-twists",
  },
  {
    title: "If AI Fruit Story Characters Had a Group Chat",
    description: "What the cast's messages would look like between episodes. Completely unofficial.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-group-chat",
  },
];

const THEORIES = [
  {
    n: "01",
    title: "Ananas Girl has never once been surprised on camera",
    evidence: "Across every video she appears in, her expression never shifts during a reveal — not the cheating scandal, not the secret twin, not the group chat leak. Either she's the calmest fruit alive, or she already knew.",
    verdict: "Probably true",
  },
  {
    n: "02",
    title: "Gangster Pineapple and Hot Peach are running the same long con",
    evidence: "Both characters spend an entire storyline looking like the villain before a finale reveal flips it. That's not a coincidence — that's a house style. Somewhere, there's a shared playbook.",
    verdict: "Extremely likely",
  },
  {
    n: "03",
    title: "Orange Mom and Banana Dad have broken up and gotten back together more times than anyone can count",
    evidence: "Every 'first meeting' scene between them has suspiciously specific tension for two characters who are supposedly strangers. Nobody argues that well with someone they just met.",
    verdict: "Fan consensus: true",
  },
  {
    n: "04",
    title: "The wedding venue is cursed",
    evidence: "Look at how many storylines end in a ceremony interrupted by a falling document, a surprise guest, or a confession nobody asked for. At some point it stops being a coincidence and starts being a location problem.",
    verdict: "Circumstantial, but compelling",
  },
  {
    n: "05",
    title: "Every 'silent partner' storyline is the same character in disguise",
    evidence: "The mysterious funder who's 'never seen' shows up across multiple unrelated storylines with the same vague description. Somebody's out here quietly bankrolling half the fruit-drama economy.",
    verdict: "Unconfirmed, but suspicious",
  },
  {
    n: "06",
    title: "Cherry and Blueberry's rivalry predates the inheritance plot entirely",
    evidence: "The tension in their very first scene together is too immediate for a conflict that supposedly started with a will. Something happened before episode one.",
    verdict: "Widely believed",
  },
  {
    n: "07",
    title: "Avocado and Tomato's class-conflict arc is secretly a redemption arc for both of them",
    evidence: "Neither character is written as purely right. By the end of most versions of this storyline, both walk away having learned something — which means neither was really the villain to begin with.",
    verdict: "Underrated theory",
  },
  {
    n: "08",
    title: "There's a single shared universe timeline, and nobody's mapped it yet",
    evidence: "Character names, dynamics, and callback lines repeat across completely different creators' fruit-drama videos. Someone, somewhere, needs to build the actual timeline. It might be you.",
    verdict: "Needs more research",
  },
];

export default function AIFruitStoryFanTheories() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Fan Theories</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Highly Entertaining
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            8 AI Fruit Story Fan Theories That Are Probably True
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Treat the recurring cast like it's an actual cinematic universe for five minutes and the theories start writing themselves. None of this is official. All of it checks out.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 17, 2026 · 6 min read · Highly Entertaining</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-fan-theories-hero.png"
            alt="A small stylized 3D cartoon blueberry character in shadow holding a magnifying glass up to a wall of pinned photos connected by red string"
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
              Every recurring fruit-drama character — Orange Mom, Banana Dad, Gangster Pineapple, Hot Peach, Ananas Girl — reappears across enough independently generated storylines that patterns start to form whether anyone intended them or not. Here's what the evidence actually suggests.
            </p>
          </section>

          <section>
            <div className="space-y-4">
              {THEORIES.map((t) => (
                <div key={t.n} className="rounded-2xl border border-[#E5E0F5] bg-white p-6 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px] font-black text-[#D8CFF0] leading-none">{t.n}</span>
                      <h3 className="text-[17px] font-bold text-[#110829] m-0">{t.title}</h3>
                    </div>
                    <span className="rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wide">{t.verdict}</span>
                  </div>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{t.evidence}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Build your own lore</h2>
            <p className="text-[17px] leading-relaxed">
              None of this needs to be official to be fun — the entire appeal of the fruit-drama format is that it's built for exactly this kind of fan theorizing. Reuse the same character names across your own storylines, drop a callback line to an earlier "episode," and let your audience start connecting dots. See the{" "}
              <Link to="/blog/ai-fruit-story-series-universe" className="text-[#7A3BFF] hover:underline font-semibold">series and universe-building guide</Link>{" "}
              for the mechanics.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Which Character Are You?</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Before you start building lore, find out where you fit in it — take the{" "}
              <Link to="/blog/ai-fruit-story-quiz" className="text-[#7A3BFF] hover:underline font-semibold">character quiz</Link>{" "}
              — then generate your own storyline in{" "}
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
