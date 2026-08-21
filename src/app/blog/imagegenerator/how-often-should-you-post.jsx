import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Recover From a Content Slump (Without Losing Your Audience)",
    description: "What actually gets posting moving again after a gap.",
    date: "21.08.2026",
    slug: "/blog/content-slump-recovery",
  },
  {
    title: "How to Build a 28-Day Social Media Content Calendar",
    description: "A practical structure for planning a month of posts at once.",
    date: "21.08.2026",
    slug: "/blog/28-day-social-media-content-calendar",
  },
  {
    title: "What Is Zyvo Publish? Scheduling and Posting Explained",
    description: "One dashboard for Instagram, TikTok, and YouTube — plan up to 28 days ahead.",
    date: "21.08.2026",
    slug: "/blog/what-is-zyvo-publish",
  },
];

const ANSWERS = [
  { scenario: "Starting a brand-new account", answer: "Post more frequently early on — daily where realistic — since a new account benefits from repeated chances to find which format resonates before you've established one." },
  { scenario: "An account with an established format that works", answer: "Once you have a proven format, a sustainable, repeatable cadence beats an unsustainable daily pace that eventually breaks and creates a posting gap." },
  { scenario: "Testing a brand-new format on an existing account", answer: "Post a small batch — enough to judge the format fairly — without abandoning your main posting rhythm entirely while you test." },
];

export default function HowOftenShouldYouPost() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>How Often Should You Post?</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Growth
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How Often Should You Post? A Realistic Answer for 2026
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            There's no single correct number. The right posting frequency depends on where your account actually is right now — here's how to judge it honestly.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Growth</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
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
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-zyvo-publish-hero.png"
              alt="An abstract glowing purple grid plane extending into the distance like a schedule"
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
              "Post every day" is generic advice that doesn't account for what stage your account is actually at. The right cadence changes depending on the situation.
            </p>
          </section>

          <section>
            <div className="space-y-4">
              {ANSWERS.map((a) => (
                <div key={a.scenario} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{a.scenario}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{a.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The real risk isn't posting too little</h2>
            <p className="text-[17px] leading-relaxed">
              It's setting a pace you can't actually sustain. A cadence that breaks after two weeks does more damage than a slightly lower one you can keep up indefinitely. Planning further ahead makes a sustainable cadence easier to hold — see{" "}
              <Link to="/blog/28-day-social-media-content-calendar" className="text-[#7A3BFF] hover:underline font-semibold">how to build a 28-day content calendar</Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Plan a Cadence You Can Keep</h2>
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
