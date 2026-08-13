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
];

const TIPS = [
  {
    n: "01",
    title: "Pick a nation with strong jersey contrast",
    text: "A nation whose kit colors clearly differ from the player's real national team reads as an obvious, deliberate swap. Same-color kits can make the joke land softer since less visibly changes.",
  },
  {
    n: "02",
    title: "Match the expression to the mood you want",
    text: "Confident or fierce expressions suit a serious 'breaking news' style clip. Joyful suits a lighter, celebratory tone. Pick the expression before writing the spoken line so the two reinforce each other.",
  },
  {
    n: "03",
    title: "Choose the background style deliberately",
    text: "Stadium tunnel reads as a big-match arrival. Press conference reads as an official announcement. Training ground reads as a casual, behind-the-scenes moment. Match it to the story you're telling.",
  },
  {
    n: "04",
    title: "Keep the spoken line short",
    text: "A brief, natural line lip-syncs more convincingly than a long one. One short sentence — a greeting, a introduction, a single confident statement — outperforms a paragraph every time.",
  },
  {
    n: "05",
    title: "Build a short sequence instead of one clip",
    text: "Generating 3 to 5 scenes and stitching them together lets you cycle through several nations in one video — a 'world tour' format that gives viewers a reason to watch to the end.",
  },
];

export default function FootballerNationalitySwapTips() {
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
            Tips
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            5 Tips for the Most Believable Footballer Nationality Swap Video
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            The default settings already produce a solid result. These five choices are what separate a clip that gets a quick glance from one that gets a rewatch.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 13, 2026 · 5 min read · Tips</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/footballer-nationality-swap-tips-hero.png"
            alt="A plain national-team-style football jersey hanging in a locker room with a blurred stadium tunnel in the background"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {TIPS.map((tip) => (
            <div key={tip.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-white/15 leading-none">{tip.n}</span>
                <h2 className="text-[17px] font-bold text-white m-0">{tip.title}</h2>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55">{tip.text}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Put These Together</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              None of these require a different plan or tool — just a more deliberate choice on the same settings you already have. Generate your next scene with one tip in mind and see how much it changes the result.
            </p>
            <Link
              to="/workspace/footballer-nationality-swap"
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
