import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "8 Behind the Scenes Disaster Types Explained",
    description: "What each of the eight original disaster modules feels like, and which places suit each one best.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-disaster-types",
  },
  {
    title: "12 Extended Behind the Scenes Modules: Kaiju, Robots, and Full Movie-Shoot Chaos",
    description: "Beyond the 8 elemental disasters — giant creatures, aircraft chases, giant robots, and more.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-extended-modules",
  },
  {
    title: "18 Behind the Scenes AI Video Ideas You Can Generate Right Now",
    description: "Curated place-and-disaster combos across every module, ready to copy into the generator.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-video-ideas",
  },
];

const TIERS = [
  { tier: "S", modules: "Kaiju attack, full-scale explosion", why: "Maximum scale contrast and the clearest, most instantly readable spectacle — these two consistently produce the strongest first-second hook." },
  { tier: "A", modules: "Tsunami wave, volcanic eruption, giant robot rampage", why: "Big, dramatic, and visually distinct from each other — strong picks for keeping a series varied." },
  { tier: "B", modules: "Tornado, meteor strike, aircraft chase", why: "Reliable and well understood by viewers, though slightly less novel than the top tier on their own." },
  { tier: "C", modules: "Flood, blizzard, firestorm", why: "Still effective, but slower-building disasters read as less immediately dramatic in a short clip than an explosion or creature reveal." },
];

export default function BehindTheScenesTierList() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Behind the Scenes</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Tier List
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Behind the Scenes Disaster Tier List: All 20 Modules Ranked
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            All 8 elemental disasters and 12 extended modules, ranked by how reliably they hook a viewer in the first second.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 6 min read · Tier List</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-tier-list-hero.png"
            alt="A glowing purple ranked tier-list ladder made of abstract geometric blocks stacked from tallest to shortest"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {TIERS.map((t) => (
            <div key={t.tier} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-lime-200 leading-none">{t.tier}</span>
                <h2 className="text-[17px] font-bold text-white m-0">{t.modules}</h2>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55">{t.why}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Rankings Are a Starting Point</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              A lower-tier module still works well when it fits your specific idea — these rankings are about average hook strength, not a hard rule. See{" "}
              <Link to="/blog/behind-the-scenes-extended-modules" className="text-lime-200 hover:underline font-semibold">all 12 extended modules explained</Link>{" "}
              for the full list beyond the original 8.
            </p>
            <Link
              to="/behind-the-scenes-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Explore Behind the Scenes
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
