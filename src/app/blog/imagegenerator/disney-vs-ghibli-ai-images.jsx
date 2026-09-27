import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "10 AI Image Styles You Didn't Know You Could Generate",
    description: "Six lesser-known Zyvo image styles most creators never try.",
    date: "23.08.2026",
    slug: "/blog/hidden-ai-image-styles",
  },
  {
    title: "2AM in Studio Ghibli: The Viral Painterly AI World Trend",
    description: "Turn a painterly, lantern-lit countryside town into a cinematic 2AM AI image set.",
    date: "Aug 11, 2026",
    slug: "/blog/2am-studio-ghibli-ai-images",
  },
  {
    title: "Noir vs Cyberpunk: The Two Moodiest AI Image Styles Compared",
    description: "Two opposite ways to make an image feel cinematic.",
    date: "23.08.2026",
    slug: "/blog/noir-vs-cyberpunk-ai-images",
  },
];

const COMPARISON_ROWS = [
  { label: "Color palette", disney: "Bright, saturated, high-contrast", ghibli: "Soft, muted, watercolor-toned" },
  { label: "Mood", disney: "Magical, sparkling, larger-than-life", ghibli: "Calm, nostalgic, gently whimsical" },
  { label: "Best subject", disney: "Castles, sparkle effects, dramatic skies", ghibli: "Countryside, quiet villages, soft skies" },
  { label: "Rendering style", disney: "Bold storybook illustration", ghibli: "Hand-painted watercolor illustration" },
  { label: "Works best for", disney: "High-energy, eye-catching visuals", ghibli: "Cozy, atmospheric, slow-paced visuals" },
];

export default function DisneyVsGhibliAiImages() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Disney vs Ghibli</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Comparison
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Disney vs Ghibli: Which Animated AI Style Should You Use?
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Two of Zyvo's most popular animated-illustration styles, built for opposite moods — bold sparkle versus soft watercolor calm.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 23, 2026 · 5 min read · Comparison</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/disney-vs-ghibli-hero.png"
              alt="A split image: a vibrant sparkling storybook fairytale castle on the left, a soft hand-painted countryside on the right"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/disney-vs-ghibli-detail.png"
              alt="A split image: a bright magical sparkle-dust sky on the left, a soft painterly cloud over green hills on the right"
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
              Disney and Ghibli are both named illustration styles in Zyvo's image generator — both animated and hand-drawn in feel, but built around very different color logic and energy.
            </p>
          </section>

          <section>
            <div className="overflow-x-auto rounded-2xl border border-[#E5E0F5]">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="bg-[#F3EFFB]">
                    <th className="px-4 py-3 font-bold text-[#110829]">What matters</th>
                    <th className="px-4 py-3 font-bold text-[#7A3BFF]">Disney</th>
                    <th className="px-4 py-3 font-bold text-[#7A3BFF]">Ghibli</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((r, i) => (
                    <tr key={r.label} className={i % 2 === 0 ? "bg-white" : "bg-[#FBFAFE]"}>
                      <td className="px-4 py-3 font-semibold text-[#110829] align-top">{r.label}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{r.disney}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{r.ghibli}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Want the full cinematic-world version?</h2>
            <p className="text-[17px] leading-relaxed">
              For a full six-image painterly world set instead of a single still, see{" "}
              <Link to="/blog/2am-studio-ghibli-ai-images" className="text-[#7A3BFF] hover:underline font-semibold">2AM in Studio Ghibli</Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try Either Style</h2>
            <Link
              to="/image-generator"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the AI Image Generator →
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
