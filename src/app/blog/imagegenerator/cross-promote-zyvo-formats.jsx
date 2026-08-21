import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Building a Multi-Format Weekly Content Calendar With Zyvo",
    description: "How to combine several formats into one sustainable weekly posting rhythm.",
    date: "21.08.2026",
    slug: "/blog/multi-format-weekly-calendar",
  },
  {
    title: "Every Zyvo AI Video Format Compared: Which One Should You Try Next?",
    description: "Six format-specific AI video tools, side by side.",
    date: "21.08.2026",
    slug: "/blog/every-zyvo-video-format-compared",
  },
  {
    title: "What Is Zyvo Connections? Managing Your Social Accounts",
    description: "The connection layer behind Publish and Stats.",
    date: "21.08.2026",
    slug: "/blog/what-is-zyvo-connections",
  },
];

const TACTICS = [
  { title: "Reference one format inside another's caption", desc: "Mention \"more like this in my [other format] series\" in a caption — viewers who liked one format are a warm audience for a related one, not a cold one." },
  { title: "Pin a different format as your profile's top post", desc: "If your feed is dominated by one format, pinning a strong post from a second format gives new visitors a reason to explore beyond the first thing they saw." },
  { title: "Use a consistent moment to bridge formats", desc: "A recurring end-card or sign-off across every format — regardless of which one it is — builds recognition that a viewer follows you, not just one series." },
  { title: "Let performance data guide the next format to add", desc: "If a format's audience skews toward a mood — dramatic, calm, spectacle — add a second format with a similar mood before trying something completely different." },
];

export default function CrossPromoteZyvoFormats() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Cross-Promoting Between Formats</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Growth
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How to Cross-Promote Between Zyvo Formats: Turn One Audience Into Many
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A viewer who liked your 2AM Worlds slideshow isn't a stranger to your Fruit Story series — they're a warm lead. Here's how to actually connect the two.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Growth</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/cross-promote-formats-hero.png"
              alt="An abstract glowing purple network of one large central sphere radiating outward into many smaller connected spheres"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/cross-promote-formats-audience.png"
              alt="An abstract glowing purple crowd of small light particles flowing along converging streams toward a single bright point"
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
              Running multiple formats only compounds if viewers of one actually discover the others. None of this requires new content — just deliberate connections between what already exists.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {TACTICS.map((t) => (
                <div key={t.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{t.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Keeping every platform connected</h2>
            <p className="text-[17px] leading-relaxed">
              Cross-promotion works best when every account is actually connected to your publishing workflow, so posting from one format to all your platforms is never a separate manual step. See{" "}
              <Link to="/blog/what-is-zyvo-connections" className="text-[#7A3BFF] hover:underline font-semibold">how Zyvo Connections works</Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Grow Every Format Together</h2>
            <Link
              to="/signup"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Start Creating Free →
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
