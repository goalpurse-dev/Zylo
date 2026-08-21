import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is Face ASMR? The AI Trend Turning Any Face Into a Satisfying Texture",
    description: "What Face ASMR is, how the texture transformation works, and how to make your own.",
    date: "20.08.2026",
    slug: "/blog/what-is-face-asmr",
  },
  {
    title: "Best ASMR Video Ideas for TikTok in 2026 (That Actually Go Viral)",
    description: "The 10 ASMR video concepts generating the most views, with execution tips for each.",
    date: "25.05.2026",
    slug: "/blog/asmr-video-ideas-tiktok-2026",
  },
  {
    title: "Why Face ASMR Videos Go Viral on TikTok in 2026",
    description: "The psychology behind ASMR virality and the face recognition scroll-stop.",
    date: "24.05.2026",
    slug: "/blog/viral-face-asmr-videos",
  },
];

const MISTAKES = [
  { n: "01", title: "Uploading a dark or poorly lit photo", problem: "Poor source lighting carries straight through into the texture transformation, leaving the final result muddy and unclear.", fix: "Use a well-lit, evenly exposed photo — natural daylight or soft indoor lighting works best." },
  { n: "02", title: "Using a photo with an unclear or angled face", problem: "A side profile, a partially obscured face, or an extreme angle gives the generator less clean information to work from.", fix: "Use a clear, front-facing photo where the whole face is visible and unobstructed." },
  { n: "03", title: "Choosing a low-resolution or blurry source photo", problem: "Fine detail in the source photo carries into the fine detail of the glossy texture — a blurry source stays blurry.", fix: "Use the highest-quality photo available, ideally shot on a modern phone camera in good light." },
  { n: "04", title: "Not considering how the texture will move", problem: "A photo where the face is scrunched, mid-expression, or unusually posed can translate strangely once rendered in a fluid material.", fix: "Use a neutral, relaxed expression as your source — it gives the smoothest, most satisfying result." },
  { n: "05", title: "Ignoring background clutter in the source photo", problem: "A busy, distracting background can pull focus away from the texture transformation itself.", fix: "Use a photo with a simple, uncluttered background so the final video stays focused on the face." },
  { n: "06", title: "Expecting every upload to look identical", problem: "Treating every generation as if it should produce the exact same texture style undersells the format's range.", fix: "Experiment with different source photos and expect some natural variation between generations." },
];

export default function FaceAsmrMistakes() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Face ASMR Mistakes</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Content Strategy
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            6 Mistakes Killing Your Face ASMR Video Quality
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The most common reasons Face ASMR generations come back muddy or unclear, and the source-photo fix for each one.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 5 min read · Content Strategy</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/face-asmr-mistakes-hero.png"
              alt="A dim, poorly lit, blurry abstract head silhouette with unclear muddy texture"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/face-asmr-mistakes-fixed.png"
              alt="A bright, clean, glossy abstract head silhouette with crisp sharp texture and clear light reflections"
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
              Face ASMR's result quality depends almost entirely on the source photo — everything wrong with a final result usually traces back to one of these six upload habits.
            </p>
          </section>

          <section>
            <div className="space-y-4">
              {MISTAKES.map((m) => (
                <div key={m.n} className="rounded-2xl border border-[#E5E0F5] bg-white p-6 shadow-sm">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-[22px] font-black text-[#D8CFF0] leading-none">{m.n}</span>
                    <h3 className="text-[16px] font-bold text-[#110829] m-0">{m.title}</h3>
                  </div>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed mb-3"><span className="font-bold text-[#EF4444]">Problem: </span>{m.problem}</p>
                  <p className="text-[14px] text-[#374151] leading-relaxed"><span className="font-bold text-[#22C55E]">Fix: </span>{m.fix}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try It With a Better Photo</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Apply these fixes to your next upload in{" "}
              <Link to="/face-asmr-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's Face ASMR tool</Link>. New to the format? Start with{" "}
              <Link to="/blog/what-is-face-asmr" className="text-[#7A3BFF] hover:underline font-semibold">the complete guide</Link>.
            </p>
            <Link
              to="/face-asmr-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Face ASMR →
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
