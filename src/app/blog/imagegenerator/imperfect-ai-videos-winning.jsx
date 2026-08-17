import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What's Hot Right Now: 8 AI Video Trends Creators Are Riding in 2026",
    description: "What each current format is, why it's working, and where to generate one.",
    date: "16.08.2026",
    slug: "/blog/whats-hot-right-now-ai-trends",
  },
  {
    title: "How to Spot the Next Viral AI Trend Before It Blows Up",
    description: "The signals that show up right before a format explodes.",
    date: "16.08.2026",
    slug: "/blog/how-to-spot-viral-ai-trend",
  },
];

const REASONS = [
  {
    n: "01",
    title: "Imperfection reads as evidence",
    text: "Camera shake, exposed cables, sensor grain, a slightly blown-out background — these are the visual markers viewers unconsciously associate with something that actually happened, rather than something that was designed to be looked at.",
  },
  {
    n: "02",
    title: "Polish signals \"ad\"",
    text: "Years of hyper-produced content has trained viewers to scroll past anything that looks too clean. A rougher frame doesn't trigger the same instant skip.",
  },
  {
    n: "03",
    title: "Visible process invites curiosity",
    text: "Showing the rig, the crew, or the \"how\" behind a shot — even a fictional one — gives viewers something to figure out. That curiosity is what turns a passive view into a comment.",
  },
  {
    n: "04",
    title: "Contrast still needs to be dramatic",
    text: "\"Imperfect\" doesn't mean low-effort. The most successful examples pair rough, amateur framing with an enormous, dramatic subject — a giant wave, a towering miniature reveal. The rawness sells the scale; it doesn't replace it.",
  },
];

export default function ImperfectAiVideosWinning() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>Content Strategy</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Content Strategy
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Why "Imperfect" AI Videos Are Beating Polished Content Right Now
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The most-watched AI video formats right now aren't the smoothest ones — they're the ones that look like someone's shaky phone footage. That's not an accident.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 16, 2026 · 6 min read · Content Strategy</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/imperfect-ai-videos-winning-hero.png"
            alt="A split composition contrasting a soft glossy blurred light against a rough, grainy dark textured surface"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-6 text-[#374151]">

          <p className="text-[17px] leading-relaxed">
            Look at what's actually working right now: miniature movie sets filmed like leaked BTS clips, a car window passing a nostalgic destination, a dashcam-style angle on a fictional world. None of these formats are trying to look flawless. That's the point.
          </p>

          <div className="space-y-4">
            {REASONS.map((r) => (
              <div key={r.n} className="rounded-xl border border-[#ECE8F2] bg-white p-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[24px] font-black text-purple-200 leading-none">{r.n}</span>
                  <h2 className="text-[18px] font-bold text-[#110829] m-0">{r.title}</h2>
                </div>
                <p className="text-[14px] text-[#374151] leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>

          <section className="mt-10">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Seeing It in Practice</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              Zyvo's{" "}
              <Link to="/behind-the-scenes-video-maker" className="text-[#7A3BFF] hover:underline font-semibold">
                Behind the Scenes
              </Link>{" "}
              generator is built entirely around this principle — visible crew, exposed rigging, amateur phone-footage grain, all locked into every generation. It's a deliberate style choice, not a limitation.
            </p>
            <p className="text-[17px] leading-relaxed">
              For the full lineup of formats using this same idea, see{" "}
              <Link to="/blog/whats-hot-right-now-ai-trends" className="text-[#7A3BFF] hover:underline font-semibold">
                what's trending right now
              </Link>
              .
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Apply This to Your Own Content</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              You don't need a polished production to compete. Generate your next video with a format built around authenticity instead of gloss.
            </p>
            <Link
              to="/workspace/home"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Start Creating on Zyvo →
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
