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
    title: "10 Mistakes Killing Your Clay Rescue Video Views",
    description: "The ten most common structural mistakes, with a specific fix for each one.",
    date: "21.08.2026",
    slug: "/blog/clay-rescue-mistakes",
  },
];

const PILLARS = [
  { title: "A recurring clay village", desc: "Keep the same village, houses, and background details across episodes so viewers recognize it immediately as part of the same series." },
  { title: "A rotating cast of clay characters", desc: "Reuse the same few clay people across scenarios — familiar characters give a series continuity a one-off video can't." },
  { title: "Varied crisis types", desc: "Rotate between weather, food, and everyday-object disasters so the series doesn't start feeling repetitive." },
  { title: "A consistent posting rhythm", desc: "Regular posting is what turns a handful of videos into something viewers actually follow." },
];

export default function ClayRescueSeries() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Clay Rescue Series</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Series
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How to Turn One Clay Rescue Video Into a Series
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A single rescue gets a view. A recognizable, ongoing clay village gets a following. Here's how to make episode two feel like it belongs with episode one.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Series</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/clay-rescue-series-hero.png"
              alt="A row of five small clay-village dioramas lined up in sequence, each with a different miniature disaster scene"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/clay-rescue-series-village.png"
              alt="A charming tiny clay village with recurring clay characters standing together outside their homes"
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Four pillars of a Clay Rescue series</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {PILLARS.map((p) => (
                <div key={p.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{p.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">A simple way to start</h2>
            <p className="text-[17px] leading-relaxed">
              Pick three different crisis types from{" "}
              <Link to="/blog/clay-rescue-video-ideas" className="text-[#7A3BFF] hover:underline font-semibold">20 Clay Rescue video ideas</Link>{" "}
              and generate them with the same clay village setting — that's already a three-episode season with zero extra planning. Once you have a rhythm going, keep rotating between weather, food, and everyday-object crises to stay fresh.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Start Your Series</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Generate your first episode, then keep the same village and cast for episode two.
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
