import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "20 Clay Rescue Video Ideas You Can Generate Right Now",
    description: "Twenty real crisis-and-fix pairs, ready to generate today.",
    date: "21.08.2026",
    slug: "/blog/clay-rescue-video-ideas",
  },
  {
    title: "What Is Clay Rescue? The Viral Giant-Hand Rescue AI Trend Explained",
    description: "How a giant hand rescues tiny clay people from everyday disasters, without ever touching them.",
    date: "20.08.2026",
    slug: "/blog/what-is-clay-rescue",
  },
  {
    title: "How to Turn One Clay Rescue Video Into a Series",
    description: "Four pillars of a Clay Rescue series, and a simple way to start your first season.",
    date: "21.08.2026",
    slug: "/blog/clay-rescue-series",
  },
];

const MISTAKES = [
  { n: "01", title: "The hand touches the clay people directly", problem: "Picking the clay people up and moving them to safety resolves the crisis, but removes the ingenuity that makes the rescue satisfying.", fix: "Always solve the problem indirectly — a tool, an object, a redirected force — never a direct lift or touch." },
  { n: "02", title: "The celebration happens too early", problem: "If the clay people react with relief before the danger is fully gone, the payoff is undercut before it lands.", fix: "Hold the crisis expression — scared, frozen, no smiles — until the fix is completely resolved, then celebrate." },
  { n: "03", title: "The crisis is too mild to feel real", problem: "A weak, low-stakes setup gives viewers nothing to actually worry about, so the resolution doesn't land as a relief.", fix: "Make the danger visually overwhelming relative to the tiny clay people — genuinely blocking, trapping, or threatening them." },
  { n: "04", title: "The fix is unclear or hard to read", problem: "If the object or action solving the crisis isn't instantly recognizable, viewers lose the exact moment that makes the video satisfying.", fix: "Use everyday, instantly recognizable objects — a ruler, a sponge, a fork — so the fix reads in under a second." },
  { n: "05", title: "The crisis isn't shown clearly in the first two seconds", problem: "A slow, unclear opening gives viewers a reason to scroll before they understand what's even wrong.", fix: "Open directly on the crisis at full severity — no build-up, no establishing shot first." },
  { n: "06", title: "Too many clay characters dilute the focus", problem: "A crowd of unclear, unnamed characters makes it hard for viewers to know who to root for.", fix: "Keep the cast small and visually distinct — a handful of clay people is enough to carry the emotional stakes." },
  { n: "07", title: "The fix doesn't logically match the crisis", problem: "An object that doesn't make sense for the problem it's solving breaks the internal logic that makes the format feel clever rather than random.", fix: "Choose a fix with a clear cause-and-effect relationship to the crisis — a sponge for a spill, a bridge for a gap." },
  { n: "08", title: "The scenario repeats too often across a series", problem: "Posting several similar crises back to back makes the format feel formulaic instead of inventive.", fix: "Rotate between genuinely different crisis types — weather, food, everyday objects, structural problems — across a posting series." },
  { n: "09", title: "The celebration is too short", problem: "Rushing past the payoff after building tension through the whole crisis wastes the emotional release viewers were waiting for.", fix: "Give the celebration real screen time — it's the reward the whole video was building toward." },
  { n: "10", title: "The scale contrast isn't sold clearly", problem: "If the size difference between the giant hand and the tiny clay people isn't obvious, the entire premise of the format is undercut.", fix: "Keep the hand realistically proportioned and the clay world consistently miniature — the scale gap is the joke." },
];

export default function ClayRescueMistakes() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Clay Rescue Mistakes</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Content Strategy
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            10 Mistakes Killing Your Clay Rescue Video Views
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The ten most common structural mistakes in Clay Rescue videos, with a specific fix for each one.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 7 min read · Content Strategy</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/clay-rescue-mistakes-hero.png"
              alt="A giant hand directly picking up a startled tiny clay figure, an example of what not to do"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/clay-rescue-mistakes-fixed.png"
              alt="A tiny clay figure cheering after being rescued indirectly with a small tool, the correct approach"
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
              Clay Rescue has a tight, proven three-beat structure — crisis, indirect fix, celebration. Almost every underperforming video breaks one part of that structure. Here's what to check.
            </p>
          </section>

          <section>
            <div className="space-y-4">
              {MISTAKES.map((m) => (
                <div key={m.n} className="rounded-2xl border border-[#E5E0F5] bg-white p-6 shadow-sm">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-[22px] font-black text-[#D8CFF0] leading-none">{m.n}</span>
                    <h3 className="text-[16px] font-bold text-[#110829] m-0">{m.title}</h3>
                  </div>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed mb-3"><span className="font-bold text-[#EF4444]">Problem: </span>{m.problem}</p>
                  <p className="text-[14px] text-[#374151] leading-relaxed"><span className="font-bold text-[#22C55E]">Fix: </span>{m.fix}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Fix Your Next Rescue</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Check your next generation against this list before posting, or start from a proven scenario in{" "}
              <Link to="/blog/clay-rescue-video-ideas" className="text-[#7A3BFF] hover:underline font-semibold">20 Clay Rescue video ideas</Link>.
            </p>
            <Link
              to="/clay-rescue-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Clay Rescue →
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
