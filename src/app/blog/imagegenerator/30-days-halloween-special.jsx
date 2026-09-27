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
    title: "2AM Worlds Halloween Special: 10 Spooky World Ideas",
    description: "Ten Halloween-themed 2AM World ideas, ready to generate.",
    date: "21.08.2026",
    slug: "/blog/2am-worlds-halloween-special",
  },
  {
    title: "Behind the Scenes Halloween Special: 10 Horror Movie-Set Disaster Ideas",
    description: "Fog, jack-o'-lanterns, and a monster silhouette push the format into horror-movie-set territory.",
    date: "21.08.2026",
    slug: "/blog/behind-the-scenes-halloween",
  },
];

const IDEAS = [
  { title: "You wake up in a haunted version of your favorite game", desc: "Take any universe from your usual list and reframe the premise as a Halloween-night version of it — same world bible, spookier tone." },
  { title: "You're the new resident of a haunted school", desc: "Hogwarts, an anime academy, or an original school setting all work — the premise is arriving on the one night a year the halls aren't empty." },
  { title: "You have 30 days to break a curse", desc: "A world-level crisis premise with a Halloween frame — the milestone days become checkpoints toward lifting it before Day 30." },
  { title: "You're mistaken for a ghost in a world that can't see you", desc: "A premise built around the world reacting to you strangely — characters react to your presence in ways that don't quite make sense until later." },
  { title: "You're the only trick-or-treater who never ages", desc: "A nostalgic, eerie premise that plays well in a cozy universe like Minecraft or a nostalgic anime town." },
  { title: "You arrive the night a fictional world's biggest legend comes true", desc: "Works especially well in universes with an established in-world myth or legendary event — Naruto, One Piece, or an original fantasy kingdom." },
  { title: "You have to survive 30 days in a world that resets every night", desc: "A higher-stakes premise with a built-in reason for tension to escalate by Day 30." },
  { title: "You're haunting your own 30-day story", desc: "A twist on the format — the premise reveals partway through that you're not entirely there the way you thought." },
  { title: "You arrive during a world's one cursed day of the year", desc: "A single in-universe holiday or event becomes the reason the whole 30 days is stranger than usual." },
  { title: "You have to find your way home before the world forgets you exist", desc: "A quietly eerie premise that works well with a calm, atmospheric universe rather than a high-action one." },
];

export default function ThirtyDaysHalloweenSpecial() {
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
            Seasonal
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            30 Days Halloween Special: 10 Spooky Universe Ideas
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Ten Halloween-framed premises for any universe you already have in mind — the format's world bible and milestone-day structure were already built for this.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 25, 2026 · 6 min read · Seasonal</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-halloween-hero.png"
            alt="A glowing purple doorway portal standing open in a foggy graveyard at night, with jack-o'-lanterns glowing along the path"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <p className="text-[16px] leading-relaxed">
              None of these need a new universe — reframe a world you already love with a Halloween-shaped premise, and the same world bible and milestone-day structure carries the rest.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {IDEAS.map((idea, i) => (
                <div key={idea.title} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-black text-white/25">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-[14px] font-bold text-white">{idea.title}</p>
                  </div>
                  <p className="text-[13px] text-white/55 leading-relaxed">{idea.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Generate Your Halloween Special</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a premise above and pair it with any universe from{" "}
              <Link to="/blog/30-days-universe-ideas" className="text-violet-300 hover:underline font-semibold">fifty universe ideas</Link>.
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
