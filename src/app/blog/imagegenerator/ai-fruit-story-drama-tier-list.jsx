import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "The Most Unhinged AI Fruit Story Plots We've Ever Generated",
    description: "Ten genuinely deranged fruit-drama premises, ranked by chaos level, free to steal.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-unhinged-plots",
  },
  {
    title: "The Wildest AI Fruit Story Plot Twists (And How to Write Your Own)",
    description: "Five twist structures that outperform a straightforward reveal, with real examples.",
    date: "10.08.2026",
    slug: "/blog/ai-fruit-story-plot-twists",
  },
  {
    title: "10 Mistakes Killing Your AI Fruit Story Views",
    description: "The ten most common structural mistakes, with a specific fix for each one.",
    date: "11.08.2026",
    slug: "/blog/ai-fruit-story-mistakes",
  },
];

const TIERS = [
  {
    tier: "S",
    color: "#7A3BFF",
    label: "Unhinged",
    items: [
      { title: "The Secret Second Family", note: "There's a whole other household. Nobody knew. Everybody's in the room now." },
      { title: "The Two Grandmas Situation", note: "Both claim to be real. Neither will explain. The reunion is over before it starts." },
      { title: "The Will That Requires Betrayal", note: "The inheritance only unlocks if the family turns on each other. They do, immediately." },
    ],
  },
  {
    tier: "A",
    color: "#A855F7",
    label: "Certified Chaos",
    items: [
      { title: "The Cheating Reveal", note: "The oldest format in the genre for a reason — it just works, every time." },
      { title: "The Best Friend Betrayal", note: "Lower stakes than cheating, but hits harder because it's more relatable." },
      { title: "The Secret Twin", note: "Explains an impossible alibi. Occasionally there's no twin at all, which is worse." },
    ],
  },
  {
    tier: "B",
    color: "#3B82F6",
    label: "Reliable Drama",
    items: [
      { title: "Sibling Rivalry", note: "Favoritism, inheritance, and one twin who never got over it. Dependable." },
      { title: "Workplace Power Struggle", note: "A bad boss, a fired employee, and a secret that flips the power balance." },
      { title: "The Comeback Arc", note: "Underdog gets humiliated, underdog returns. Always satisfying, rarely surprising." },
    ],
  },
  {
    tier: "C",
    color: "#22C55E",
    label: "Solid Filler",
    items: [
      { title: "The Forbidden Romance", note: "Families who hate each other, a couple who don't care. Classic, a little predictable." },
      { title: "The Class Envy Plot", note: "Works, but needs a sharper hook than most to stand out in a feed." },
      { title: "The Group Chat Leak", note: "Fun chaos generator, but usually needs a bigger plot around it to really land." },
    ],
  },
];

export default function AIFruitStoryDramaTierList() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Drama Tier List</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Highly Entertaining
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Every AI Fruit Story Drama Type, Ranked From Petty to Unhinged
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            An extremely scientific, not-at-all-biased ranking of every fruit-drama plot type — from "mildly annoyed" to "someone needs to sit down."
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 17, 2026 · 6 min read · Highly Entertaining</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-tier-list-hero.png"
            alt="A stylized 3D cartoon pineapple character in a trench coat standing triumphantly on a glowing podium above smaller fruit characters looking up"
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
              Not every fruit-drama premise is created equal. Some are dependable, comfort-food conflict — you know exactly what you're getting and it delivers. Others are unhinged enough that the comment section needs a moment. Here's the definitive, entirely-vibes-based ranking.
            </p>
          </section>

          {TIERS.map((t) => (
            <section key={t.tier}>
              <div className="mb-5 flex items-center gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[22px] font-black text-white"
                  style={{ background: t.color }}
                >
                  {t.tier}
                </span>
                <h2 className="text-[24px] font-bold text-[#110829]">{t.label}</h2>
              </div>
              <div className="space-y-3">
                {t.items.map((item) => (
                  <div key={item.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                    <p className="text-[15px] font-bold text-[#110829] mb-1">{item.title}</p>
                    <p className="text-[14px] text-[#6b7280] leading-relaxed">{item.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Ranking your own plot</h2>
            <p className="text-[17px] leading-relaxed">
              If you're not sure where your idea lands, ask one question: does the ending recontextualize everything before it, or does it just resolve? Recontextualizing endings — the secret family, the fake grandmother, the betrayal-clause will — climb the tier list fast. A clean resolution is fine, but it caps out around B tier no matter how well it's executed.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Generate Your Own S-Tier Plot</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a tier, borrow the shape, and swap in your own characters — or check the{" "}
              <Link to="/blog/ai-fruit-story-prompt-formula" className="text-[#7A3BFF] hover:underline font-semibold">prompt formula guide</Link>{" "}
              to build the premise from scratch. Then generate it in{" "}
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
