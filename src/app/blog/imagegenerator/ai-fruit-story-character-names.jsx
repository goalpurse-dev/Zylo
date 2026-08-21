import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "50 AI Fruit Story Prompts and Viral Drama Ideas",
    description: "Fifty fruit-drama prompts across reveal, family, friendship, comeback, workplace, and wedding-drama plots.",
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
    title: "AI Fruit Story Halloween Special: 10 Spooky Drama Ideas",
    description: "Ten Halloween-themed premises ready to generate this season.",
    date: "21.08.2026",
    slug: "/blog/ai-fruit-story-halloween",
  },
];

const NAME_GROUPS = [
  { fruit: "Apple", names: ["Delia Crisp", "Rosalind Gala", "Fuji Winters", "Bramley Cole"] },
  { fruit: "Orange", names: ["Val Citrus", "Clementine Vance", "Navel Reyes", "Sunny Zest"] },
  { fruit: "Banana", names: ["Chiquita Grove", "Plantain Reed", "Bunches Miller", "Cavendish Lee"] },
  { fruit: "Strawberry", names: ["Berry Fields", "Shortcake Ruiz", "Rojo Vine", "Junebug Sweet"] },
  { fruit: "Grape", names: ["Concord Vale", "Vino Marsh", "Cluster James", "Raisin Frost"] },
  { fruit: "Watermelon", names: ["Melon Hayes", "Rind Carter", "Seedless Cruz", "Picnic Dune"] },
  { fruit: "Pineapple", names: ["Prickly Diaz", "Tropic Wells", "Spike Alani", "Golden Husk"] },
  { fruit: "Peach", names: ["Georgia Fuzz", "Cobbler Stone", "Blush Avery", "Pit Sinclair"] },
  { fruit: "Kiwi", names: ["Fuzz Okafor", "Tart Nguyen", "Emerald Poe", "Vine Hollow"] },
  { fruit: "Lemon", names: ["Zest Adler", "Sour Blythe", "Rind Delacroix", "Twist Marlowe"] },
];

const TIPS = [
  { title: "Match the name to the fruit's real traits", desc: "A lemon character named something sharp or tart, a peach character named something soft — the name reinforces the personality before a single line of dialogue is written." },
  { title: "Keep surnames short and punchy", desc: "One or two syllables read better on-screen in fast-paced dialogue than long, formal-sounding surnames." },
  { title: "Reuse names across a series deliberately", desc: "A recurring name across multiple videos is what makes a series feel connected — pick names early and stay consistent once a character resonates." },
];

export default function AIFruitStoryCharacterNames() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Character Names</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Character Ideas
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            40 AI Fruit Story Character Names, Grouped by Fruit
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A naming shortcut for your next fruit-drama cast — four names for each of ten fruit types, ready to drop straight into a prompt.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Character Ideas</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/fruit-story-names-hero.png"
              alt="Five stylized 3D cartoon fruit characters standing together on a spotlit stage like a cast lineup"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/fruit-story-names-scroll.png"
              alt="An elegant glowing golden decorative scroll flourish"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <p className="text-[17px] leading-relaxed">
              A good name does real work in a fruit-drama premise — it sets personality before the first line of dialogue plays. Here are four names for ten common fruit character types.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {NAME_GROUPS.map((g) => (
                <div key={g.fruit} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[14px] font-bold text-[#7A3BFF] uppercase tracking-wider mb-2">{g.fruit}</p>
                  <ul className="space-y-1">
                    {g.names.map((n) => (
                      <li key={n} className="text-[14px] text-[#374151]">{n}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How to pick well</h2>
            <div className="space-y-4">
              {TIPS.map((t) => (
                <div key={t.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{t.title}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Cast Your Story</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick two names above, give them a conflict, and generate the scene in{" "}
              <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI Fruit Story maker</Link>. For premise ideas, see{" "}
              <Link to="/blog/ai-fruit-story-character-ideas" className="text-[#7A3BFF] hover:underline font-semibold">eight ready-made character pairings</Link>.
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
