import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is Footballer Nationality Swap? (And How It Works)",
    description: "Why the format works, what actually gets generated, and how to create one in Zyvo.",
    date: "13.08.2026",
    slug: "/blog/footballer-nationality-swap-explained",
  },
  {
    title: "5 Tips for the Most Believable Footballer Nationality Swap Video",
    description: "Jersey contrast, expression, background style, and spoken-line length.",
    date: "13.08.2026",
    slug: "/blog/footballer-nationality-swap-tips",
  },
  {
    title: "How to Turn One Footballer Nationality Swap Video Into a Series",
    description: "A simple structure for turning single clips into an ongoing world-tour format.",
    date: "21.08.2026",
    slug: "/blog/footballer-nationality-swap-series",
  },
];

const MISTAKES = [
  { n: "01", title: "The kit colors barely differ from the real nation", problem: "If the swapped nation's kit is a similar color to the player's real national team, the change doesn't read clearly at a glance.", fix: "Pick a nation with strong, obviously different kit colors so the swap is unmistakable within the first second." },
  { n: "02", title: "The spoken line is too long", problem: "A long sentence lip-syncs less convincingly and gives the illusion more places to break down.", fix: "Keep the spoken line to one short sentence — a greeting, a single confident statement." },
  { n: "03", title: "The background doesn't match the story", problem: "A casual training-ground background undercuts a clip meant to feel like breaking news, and vice versa.", fix: "Match the background deliberately — tunnel for arrival, press conference for an announcement, training ground for something casual." },
  { n: "04", title: "Only one clip instead of a sequence", problem: "A single scene is a novelty. It doesn't give viewers a reason to watch to the end or come back for more.", fix: "Stitch 3 to 5 scenes into a 'world tour' sequence — it turns a one-off gag into something worth watching in full." },
  { n: "05", title: "The expression doesn't match the tone", problem: "A joyful expression paired with a serious announcement-style line feels mismatched and undercuts the clip.", fix: "Choose the expression before writing the spoken line so the two reinforce the same mood." },
  { n: "06", title: "Posting the same player repeatedly", problem: "Cycling through the same one or two players makes a feed feel repetitive fast.", fix: "Rotate through different players and nations across a posting run to keep the format feeling fresh." },
];

export default function FootballerNationalitySwapMistakes() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-amber-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Nationality Swap</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-amber-200 mb-6">
            Mistakes
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            10 Mistakes Killing Your Footballer Nationality Swap Video Views
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            The default settings already produce a solid clip. These are the structural choices that quietly hold results back — and the fix for each one.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 5 min read · Mistakes</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/footballer-swap-time-stadium.png"
              alt="An empty stadium tunnel leading out to a floodlit pitch"
              width={1024}
              height={576}
              className="aspect-[16/9] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/footballer-nationality-swap-tips-hero.png"
              alt="A plain blue football jersey hanging in a locker room with a blurred stadium tunnel in the background"
              width={1024}
              height={576}
              className="aspect-[16/9] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="max-w-3xl space-y-4 text-white/68">
          {MISTAKES.map((m) => (
            <div key={m.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-white/15 leading-none">{m.n}</span>
                <h2 className="text-[17px] font-bold text-white m-0">{m.title}</h2>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55 mb-2">{m.problem}</p>
              <p className="text-[14px] leading-relaxed text-amber-200/80"><span className="font-bold text-amber-200">Fix: </span>{m.fix}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try It With These Fixed</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              None of these require a different tool — just a more deliberate choice on the settings you already have. See{" "}
              <Link to="/blog/footballer-nationality-swap-tips" className="text-amber-200 hover:underline font-semibold">five tips for a more believable result</Link>{" "}
              for more on jersey contrast and expression.
            </p>
            <Link
              to="/footballer-nationality-swap-ai"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-7 py-3.5 text-[14px] font-black text-[#150F02] transition hover:bg-amber-200"
            >
              Create a Nationality Swap
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>

        <div className="mt-20 -mx-6 rounded-[24px] bg-[#F7F5FA] py-10 sm:mx-0">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
