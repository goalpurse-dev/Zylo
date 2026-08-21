import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Every Zyvo AI Video Format Compared: Which One Should You Try Next?",
    description: "Six format-specific AI video tools, side by side.",
    date: "21.08.2026",
    slug: "/blog/every-zyvo-video-format-compared",
  },
  {
    title: "How to Build a 28-Day Social Media Content Calendar",
    description: "A practical structure for planning a month of posts at once.",
    date: "21.08.2026",
    slug: "/blog/28-day-social-media-content-calendar",
  },
  {
    title: "How to Cross-Promote Between Zyvo Formats: Turn One Audience Into Many",
    description: "How a fan of one format becomes a viewer of another.",
    date: "21.08.2026",
    slug: "/blog/cross-promote-zyvo-formats",
  },
];

const WEEK = [
  { day: "Monday", format: "AI Fruit Story", why: "A drama episode gives the week a strong narrative anchor — post early so it has time to build views before the next episode." },
  { day: "Tuesday", format: "2AM Worlds", why: "A quick atmospheric slideshow — fast to generate, good for a lower-effort mid-week post." },
  { day: "Wednesday", format: "Behind the Scenes", why: "Big spectacle mid-week tends to get a strong bump from the audience that's been active all week." },
  { day: "Thursday", format: "Clay Rescue or Micro Camera Animal", why: "A calmer, wholesome or curiosity-driven post — good variety heading into the weekend." },
  { day: "Friday", format: "Cartoon Drive-By", why: "Atmospheric, easy-to-watch content that performs well as weekend scrolling picks up." },
  { day: "Weekend", format: "Footballer Nationality Swap or a fruit story cliffhanger", why: "Fast novelty content or a hook into next week's fruit story episode." },
];

export default function MultiFormatWeeklyCalendar() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Multi-Format Weekly Calendar</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Growth
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Building a Multi-Format Weekly Content Calendar With Zyvo
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Running one format all week gets repetitive fast — for both you and your audience. Here's a sample week that spreads several Zyvo formats across different moods.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Growth</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/multi-format-calendar-hero.png"
              alt="An abstract glowing purple weekly calendar grid of seven vertical panels of varying heights"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-publish-schedule.png"
              alt="A row of glowing purple rectangular calendar-like cards receding into the distance"
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
              This isn't a rule to follow exactly — it's a starting structure. Swap any day for whichever format fits your niche, using{" "}
              <Link to="/blog/every-zyvo-video-format-compared" className="text-[#7A3BFF] hover:underline font-semibold">the full format comparison</Link>{" "}
              to pick replacements.
            </p>
          </section>

          <section>
            <div className="space-y-3">
              {WEEK.map((d) => (
                <div key={d.day} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                    <p className="text-[13px] font-black text-[#7A3BFF] uppercase tracking-wider">{d.day}</p>
                    <p className="text-[15px] font-bold text-[#110829]">{d.format}</p>
                  </div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{d.why}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Scheduling it all in one place</h2>
            <p className="text-[17px] leading-relaxed">
              Once you know the week's lineup, queue every post ahead of time instead of generating and posting daily. See{" "}
              <Link to="/blog/what-is-zyvo-publish" className="text-[#7A3BFF] hover:underline font-semibold">how scheduled posting works</Link>{" "}
              to plan the whole week in one sitting.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Plan Your Week</h2>
            <Link
              to="/publish"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Explore Zyvo Publish →
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
