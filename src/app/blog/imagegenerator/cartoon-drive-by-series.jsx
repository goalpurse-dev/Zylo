import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is a Cartoon Drive-By Video? (And How to Make One)",
    description: "Why the format works, what makes the parallax motion feel real, and how to generate one in Zyvo.",
    date: "11.08.2026",
    slug: "/blog/cartoon-drive-by-explained",
  },
  {
    title: "15 Cartoon Drive-By Video Ideas (With Prompts You Can Copy)",
    description: "Fifteen fictional destinations across car, train, bus, and plane viewpoints.",
    date: "11.08.2026",
    slug: "/blog/cartoon-drive-by-video-ideas",
  },
  {
    title: "6 Mistakes Killing Your Cartoon Drive-By Video Views",
    description: "The most common reasons results come back generic, and the fix for each one.",
    date: "21.08.2026",
    slug: "/blog/cartoon-drive-by-mistakes",
  },
];

const PILLARS = [
  { title: "A themed destination lineup", desc: "Group destinations by a shared theme — cozy fantasy towns, neon cities, coastal roads — so a series feels curated rather than random." },
  { title: "A rotating vehicle viewpoint", desc: "Alternate between car, train, bus, and plane across episodes to keep the motion and framing feeling different each time." },
  { title: "A consistent mood per season", desc: "Pick one mood — golden dusk, rainy night, bright midday — and stick with it across a run of videos so the series has a visual identity." },
  { title: "A destination viewers can request", desc: "Ending a caption with 'next stop?' turns a passive series into one your comments help write." },
];

export default function CartoonDriveBySeries() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Cartoon Drive-By</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Series
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How to Turn One Cartoon Drive-By Video Into a Series
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            One drive-by is a nice clip. A themed lineup of destinations is a series people follow for the next stop. Here's how to structure it.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 5 min read · Series</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/cartoon-drive-by-explained-hero.png"
              alt="A view through a car window at dusk of a cozy fantasy village with warm lantern-lit houses"
              width={1024}
              height={576}
              className="aspect-[16/9] w-full rounded-[19px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/cartoon-drive-by-video-ideas-hero.png"
              alt="A view through an airplane window of a fantastical floating castle city above the clouds at sunset"
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
            <h2 className="text-[26px] font-black text-white mb-5 tracking-[-0.01em]">Four pillars of a Cartoon Drive-By series</h2>
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
              Pick three destinations with a shared mood from{" "}
              <Link to="/blog/cartoon-drive-by-video-ideas" className="text-lime-200 hover:underline font-semibold">15 Cartoon Drive-By video ideas</Link>{" "}
              and generate each with a different vehicle viewpoint — that's already a three-part series with real visual variety.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Start Your Series</h2>
            <Link
              to="/cartoon-drive-by-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Explore Cartoon Drive-By
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
