import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month",
    description: "How the eight-scene, four-milestone-day story format actually works.",
    date: "24.08.2026",
    slug: "/blog/what-is-30-days-ai-trend",
  },
  {
    title: "How to Turn One 30 Days Story Into a Series",
    description: "A simple structure for turning one 30-day story into an ongoing world you keep returning to.",
    date: "24.08.2026",
    slug: "/blog/30-days-video-series",
  },
  {
    title: "10 Mistakes Killing Your 30 Days Video Views",
    description: "The structural choices that quietly hold results back, with a fix for each.",
    date: "24.08.2026",
    slug: "/blog/30-days-mistakes",
  },
];

const GROUPS = [
  {
    title: "Games & fictional worlds",
    ideas: ["LEGO Ninjago", "Minecraft", "GTA Vice City", "Hogwarts", "A fantasy kingdom under siege", "An open-world RPG town", "A battle-royale island", "A retro arcade game brought to life"],
  },
  {
    title: "Anime & characters",
    ideas: ["Naruto's Hidden Leaf Village", "One Piece's pirate crew", "Studio Ghibli's countryside", "A mecha anime hangar", "An anime train station at rush hour", "A magical academy after curfew"],
  },
  {
    title: "Nostalgia & mood",
    ideas: ["Your childhood neighborhood, but everyone's a stranger", "A 90s shopping mall that never closes", "An empty theme park after hours", "A summer camp that never ends", "A liminal hotel where the clock never moves"],
  },
  {
    title: "High-stakes premises",
    ideas: ["You're the only human left in the world", "You accidentally become the chosen one", "The world changes the moment you arrive", "You're mistaken for someone important", "You have 30 days to fix what's broken"],
  },
];

export default function ThirtyDaysUniverseIdeas() {
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
            Ideas
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            50 30 Days Universe Ideas: What World Should You Spend 30 Days In?
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            The hardest part is picking the first universe. Here are ideas grouped by mood, from recognizable game worlds to pure nostalgia to high-stakes premises.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 24, 2026 · 6 min read · Ideas</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/30-days-universe-ideas-hero.png"
              alt="A glowing purple doorway portal standing open in a dark void, swirling light inside like an entrance to another world"
              width={1024}
              height={576}
              className="aspect-[16/9] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/30-days-universe-ideas-grid.png"
              alt="A grid of six small glowing abstract portal-doorway shapes in different colors"
              width={1024}
              height={576}
              className="aspect-[16/9] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <p className="text-[16px] leading-relaxed">
              Every idea below works as either a typed-in universe with your own premise, or a starting point for AI idea mode to build on.
            </p>
          </section>

          {GROUPS.map((g) => (
            <section key={g.title}>
              <h2 className="text-[22px] font-black text-white mb-4 tracking-[-0.01em]">{g.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.ideas.map((idea) => (
                  <div key={idea} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-[14px] text-white/75">{idea}</div>
                ))}
              </div>
            </section>
          ))}

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Pick One and Generate It</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Once you've picked a universe, AI idea mode can write a viral-shaped premise for it automatically — you don't have to script the story yourself.
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
