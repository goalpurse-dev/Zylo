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
    title: "The Complete Zyvo Content Workflow: From Idea to Published Post",
    description: "Generate, connect, publish, measure — how every Zyvo tool fits into one repeatable content loop.",
    date: "21.08.2026",
    slug: "/blog/zyvo-content-workflow",
  },
  {
    title: "The Complete Guide to Vertical Video Formats for TikTok, Reels & Shorts",
    description: "The exact specs and pacing rules for TikTok, Reels, and Shorts.",
    date: "21.08.2026",
    slug: "/blog/vertical-video-formats-guide",
  },
];

const SOURCES = [
  { title: "A multi-scene generation, split apart", desc: "A Fruit Story series, a 2AM Worlds six-image set, or a stitched Nationality Swap sequence is already several individual scenes — each one can stand alone as its own post instead of only existing inside the combined video." },
  { title: "One premise, several formats", desc: "The same idea can become a full video, a single-image teaser, a caption-only text post, and a comment reply — one generation session, four different post types." },
  { title: "The same world, different angles", desc: "A single 2AM World or Cartoon Drive-By destination can be posted from its still image, its animated version, and a 'making of' caption explaining the prompt behind it." },
  { title: "A series' individual episodes", desc: "Behind the Scenes, Clay Rescue, and Micro Camera Animal series each naturally produce standalone episodes — post them individually across the week instead of all at once." },
];

export default function RepurposeOneVideoTenPieces() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Repurpose One Video Into 10 Pieces of Content</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Tutorial
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How to Repurpose One AI Video Into 10 Pieces of Content
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Most AI video formats already generate several individual scenes or images along the way — most creators only ever post the combined result. Here's how to get a full week out of one session.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Tutorial</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/zyvo-content-workflow-hero.png"
              alt="An abstract glowing purple spark of energy traveling along a wavy line toward a bright glowing sphere"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/vertical-video-formats-comparison.png"
              alt="A split-panel comparison of a tall vertical glowing rectangle and a wide horizontal glowing rectangle"
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
              Multi-scene AI video formats generate more usable material per session than most creators actually use. Here are four ways to split one generation into a week's worth of posts.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {SOURCES.map((s) => (
                <div key={s.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{s.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Scheduling the split-out pieces</h2>
            <p className="text-[17px] leading-relaxed">
              Once one session becomes several posts, spacing them across the week matters more than posting them all at once. See{" "}
              <Link to="/blog/what-is-zyvo-publish" className="text-[#7A3BFF] hover:underline font-semibold">how scheduled posting works</Link>{" "}
              to queue a week's worth of pieces from a single sitting.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Get More From One Session</h2>
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
