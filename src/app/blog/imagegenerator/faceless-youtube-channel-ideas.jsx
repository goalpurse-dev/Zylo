import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Best AI Video Generators for TikTok in 2026",
    description: "What actually separates a good AI video generator from a disappointing one.",
    date: "21.08.2026",
    slug: "/blog/best-ai-video-generators-tiktok",
  },
  {
    title: "The Ultimate Zyvo Template Comparison: All 9 Tools Side by Side",
    description: "Every Zyvo tool, its real output format, and what it's actually best for.",
    date: "21.08.2026",
    slug: "/blog/zyvo-template-comparison",
  },
  {
    title: "Best Free AI Tools for Content Creators in 2026",
    description: "What to look for in a free tier before committing time to it.",
    date: "21.08.2026",
    slug: "/blog/best-free-ai-tools-creators",
  },
];

const IDEAS = [
  { title: "Micro Camera Animal", desc: "A tiny research-style camera follows a real animal's POV through its own world — no host, no face, no voiceover required." },
  { title: "2AM Worlds slideshows", desc: "Six cinematic images of an atmospheric late-night world, built for a slideshow-style video with music instead of narration." },
  { title: "AI Fruit Story series", desc: "Stylized cartoon characters carry the drama with dialogue and animation — the channel's voice comes from the writing, not from being on camera." },
  { title: "Behind the Scenes disaster videos", desc: "Miniature-model spectacle styled like leaked movie-set footage — the format itself is the hook, independent of who's making it." },
  { title: "Cartoon Drive-By destinations", desc: "A moving passenger-window view of a fictional place — purely visual, with no on-camera presence needed at all." },
  { title: "Footballer Nationality Swap", desc: "AI-generated footballer clips carry the content — you never appear on camera yourself." },
];

export default function FacelessYoutubeChannelIdeas() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Faceless YouTube Channel Ideas</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Tutorial
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Faceless YouTube Channel Ideas Using AI in 2026
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Six AI-generated formats that never require appearing on camera — the format itself carries the content instead of a host.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Tutorial</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/best-ai-video-generators-hero.png"
              alt="An abstract arrangement of glowing colorful geometric video-frame shapes floating together"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/best-free-ai-tools-sparkle.png"
              alt="An abstract glowing golden sparkle burst shape"
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
              A faceless channel isn't a limitation — some of the most-watched short-form formats never show a host at all. Here are six real, format-specific ways to build one without a camera pointed at yourself.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {IDEAS.map((idea) => (
                <div key={idea.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{idea.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{idea.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Picking a format to start with</h2>
            <p className="text-[17px] leading-relaxed">
              Each format has a different rhythm — some are built for a recurring series, others work as one-off atmospheric pieces. See{" "}
              <Link to="/blog/zyvo-template-comparison" className="text-[#7A3BFF] hover:underline font-semibold">the full template comparison</Link>{" "}
              to match a format to the channel you want to build.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Start a Faceless Channel</h2>
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
