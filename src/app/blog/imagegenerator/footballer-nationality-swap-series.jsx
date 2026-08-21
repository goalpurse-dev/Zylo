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
    title: "15 Footballer Nationality Swap Video Ideas You Can Try",
    description: "Fifteen structural concepts, from rival-nation swaps to full world-tour sequences.",
    date: "21.08.2026",
    slug: "/blog/footballer-nationality-swap-ideas",
  },
  {
    title: "10 Mistakes Killing Your Footballer Nationality Swap Video Views",
    description: "The ten most common structural mistakes, with a fix for each.",
    date: "21.08.2026",
    slug: "/blog/footballer-nationality-swap-mistakes",
  },
];

const PILLARS = [
  { title: "A running world-tour format", desc: "Frame every clip as one stop on an ongoing tour — 'Stop 12: Brazil' — so a single video reads as part of something larger, not a one-off." },
  { title: "A consistent announcement style", desc: "Keep the same background style (tunnel, press conference) and delivery tone across episodes so the series has a recognizable identity." },
  { title: "A rotating cast of players", desc: "Cycle through different players rather than repeating the same one — variety is what keeps a series from feeling stale." },
  { title: "A clear stopping point or theme", desc: "A 'top 10 rival swaps' or 'every host nation' arc gives the series a natural conclusion viewers can look forward to, rather than running indefinitely with no shape." },
];

export default function FootballerNationalitySwapSeries() {
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
            Series
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How to Turn One Footballer Nationality Swap Video Into a Series
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A single swap is a fun clip. A running world-tour format is something viewers follow. Here's how to structure it.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 5 min read · Series</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/footballer-swap-ideas-jerseys.png"
              alt="A plain navy football jersey on a wooden hanger with stadium floodlights glowing in the background"
              width={1024}
              height={576}
              className="aspect-[16/9] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/footballer-swap-time-hero.png"
              alt="An abstract glowing purple stopwatch shaped like a football"
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
            <h2 className="text-[26px] font-black text-white mb-5 tracking-[-0.01em]">Four pillars of a Nationality Swap series</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {PILLARS.map((p) => (
                <div key={p.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <p className="text-[15px] font-bold text-white mb-1.5">{p.title}</p>
                  <p className="text-[13px] text-white/55 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[24px] font-black text-white mb-4 tracking-[-0.01em]">A simple way to start</h2>
            <p className="text-[16px] leading-relaxed">
              Pick three nations from{" "}
              <Link to="/blog/footballer-nationality-swap-ideas" className="text-amber-200 hover:underline font-semibold">15 Nationality Swap video ideas</Link>{" "}
              and generate them for the same player, stitched into one sequence — that's a three-stop tour with zero extra planning. Post the next stop as a follow-up and the series builds itself from there.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Start Your Series</h2>
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
