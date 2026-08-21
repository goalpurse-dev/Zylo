import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Best AI Video Generators for TikTok in 2026",
    description: "The criteria that matter, and how to evaluate any tool before committing.",
    date: "21.08.2026",
    slug: "/blog/best-ai-video-generators-tiktok",
  },
  {
    title: "AI Video Generator for TikTok and Reels",
    description: "How to plan and create vertical AI videos for TikTok and Instagram Reels.",
    date: "21.08.2026",
    slug: "/blog/ai-video-generator-tiktok-reels",
  },
  {
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
];

const SPECS = [
  { platform: "TikTok", ratio: "9:16", res: "1080 × 1920px", note: "Full-bleed vertical, minimal safe-zone margin needed" },
  { platform: "Instagram Reels", ratio: "9:16", res: "1080 × 1920px", note: "Same as TikTok, but leave extra bottom margin for the caption/UI overlay" },
  { platform: "YouTube Shorts", ratio: "9:16", res: "1080 × 1920px", note: "Same core spec; top and bottom UI overlays are slightly taller" },
];

const RULES = [
  { title: "Design for the safe zone, not just the frame", desc: "Platform UI — captions, like/share buttons, usernames — covers roughly the top and bottom 15% of every vertical video. Keep key visual details and text out of those zones." },
  { title: "Match resolution exactly, don't just match aspect ratio", desc: "A correctly cropped 9:16 video at the wrong resolution still gets upscaled or compressed by the platform, softening detail. Export at the platform's native resolution when possible." },
  { title: "Cut for sound-off viewing first", desc: "A large share of vertical video is watched muted initially — a hook and story that read clearly without audio hold attention longer before sound gets turned on." },
  { title: "Keep pacing tight for the format", desc: "Vertical, single-column video has no peripheral visual interest to hold attention during a slow moment — cuts and pacing generally need to be tighter than landscape video." },
];

export default function VerticalVideoFormatsGuide() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Vertical Video Formats Guide</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Tutorial
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            The Complete Guide to Vertical Video Formats for TikTok, Reels & Shorts
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The exact aspect ratios, resolutions, and safe zones each platform expects, plus the pacing rules that actually hold attention in a vertical frame.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 7 min read · Tutorial</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/vertical-video-formats-hero.png"
              alt="Abstract glowing purple bar chart columns of varying heights"
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Platform specs at a glance</h2>
            <div className="overflow-x-auto rounded-2xl border border-[#E5E0F5]">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="bg-[#F3EFFB]">
                    <th className="px-4 py-3 font-bold text-[#110829]">Platform</th>
                    <th className="px-4 py-3 font-bold text-[#110829]">Ratio</th>
                    <th className="px-4 py-3 font-bold text-[#110829]">Resolution</th>
                    <th className="px-4 py-3 font-bold text-[#110829]">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {SPECS.map((s, i) => (
                    <tr key={s.platform} className={i % 2 === 0 ? "bg-white" : "bg-[#FBFAFE]"}>
                      <td className="px-4 py-3 font-semibold text-[#110829] align-top">{s.platform}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{s.ratio}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{s.res}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Four rules that actually matter</h2>
            <div className="space-y-4">
              {RULES.map((r) => (
                <div key={r.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{r.title}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How Zyvo handles this automatically</h2>
            <p className="text-[17px] leading-relaxed">
              Every Zyvo video template outputs finished, correctly formatted vertical video by default — no manual cropping, resolution matching, or safe-zone guesswork required. See{" "}
              <Link to="/blog/best-ai-video-generators-tiktok" className="text-[#7A3BFF] hover:underline font-semibold">what else to check</Link>{" "}
              in a format-specific video tool.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Create Ready-to-Post Vertical Video</h2>
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
