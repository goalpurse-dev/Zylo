import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "50 30 Days Universe Ideas: What World Should You Spend 30 Days In?",
    description: "Fifty fictional universes to try, grouped by mood.",
    date: "24.08.2026",
    slug: "/blog/30-days-universe-ideas",
  },
  {
    title: "10 Mistakes Killing Your 30 Days Video Views",
    description: "The structural choices that quietly hold results back, with a fix for each.",
    date: "24.08.2026",
    slug: "/blog/30-days-mistakes",
  },
  {
    title: "What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month",
    description: "How the eight-scene, four-milestone-day story format actually works.",
    date: "24.08.2026",
    slug: "/blog/what-is-30-days-ai-trend",
  },
];

const FORMULA_PARTS = [
  { n: "01", title: "How you arrive", desc: "Start with the inciting event — teleported, mistaken for someone, hired, born there. This single line sets the tone for everything after it." },
  { n: "02", title: "What changes because you're there", desc: "The strongest premises aren't just 'you visit' — they're 'the world reacts to you being there.' Give the universe a reason to notice you." },
  { n: "03", title: "What's at stake by Day 30", desc: "A premise with a clear direction — something to resolve, win, or become by the end — gives the four milestone days somewhere to build toward." },
  { n: "04", title: "One specific detail", desc: "A named character, a specific location, or a concrete rule of the world makes the world bible lock onto something real instead of generating something generic." },
];

const EXAMPLES = [
  { weak: "You go to Hogwarts for 30 days.", strong: "You're mistaken for a long-lost professor's apprentice and have 30 days to learn real magic before the truth comes out." },
  { weak: "You're in Minecraft.", strong: "You wake up in a Minecraft world with no memory of how you got there, and every 10 days a new threat reveals a piece of why you're really here." },
  { weak: "You join One Piece's crew.", strong: "You're recruited onto the crew as their newest member, and by Day 30 you have to prove you belong before they reach the next island." },
];

export default function ThirtyDaysPremiseFormula() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-violet-300">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">30 Days</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-violet-200 mb-6">
            Prompt Formula
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How to Write a Viral 30 Days Premise (Formula + Examples)
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            AI idea mode can write a premise for you — but knowing this formula helps you write a stronger one yourself, or edit AI's draft into something sharper.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 25, 2026 · 6 min read · Prompt Formula</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-premise-formula-hero.png"
            alt="An open glowing notebook with a small swirling purple portal of light rising from its pages"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <h2 className="text-[26px] font-black text-white mb-5 tracking-[-0.01em]">Four parts of a strong premise</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {FORMULA_PARTS.map((p) => (
                <div key={p.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-[18px] font-black text-white/20 leading-none">{p.n}</span>
                    <p className="text-[15px] font-bold text-white m-0">{p.title}</p>
                  </div>
                  <p className="text-[13px] text-white/55 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[24px] font-black text-white mb-4 tracking-[-0.01em]">Weak vs strong, side by side</h2>
            <div className="space-y-4">
              {EXAMPLES.map((e) => (
                <div key={e.weak} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <p className="text-[13px] text-white/40 mb-2"><span className="font-bold text-white/30">Weak: </span>{e.weak}</p>
                  <p className="text-[14px] text-violet-200/90"><span className="font-bold text-violet-200">Strong: </span>{e.strong}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Or Let AI Write the First Draft</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              AI idea mode applies this same formula automatically for any universe you name — use it as a starting point and edit toward something more specific. See{" "}
              <Link to="/blog/30-days-universe-ideas" className="text-violet-300 hover:underline font-semibold">fifty universe ideas</Link>{" "}
              to pick where to start.
            </p>
            <Link
              to="/30-days-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-fuchsia-300 px-7 py-3.5 text-[14px] font-black text-[#160b20] transition hover:brightness-110"
            >
              Explore 30 Days
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
