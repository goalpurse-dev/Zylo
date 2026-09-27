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
    title: "2AM in a Cyberpunk City: The Neon-Lit AI World Trend",
    description: "Turn an empty, rain-slicked neon-lit street into a cinematic 2AM AI image set.",
    date: "Aug 19, 2026",
    slug: "/blog/2am-cyberpunk-city-ai-images",
  },
  {
    title: "AI Image Generator for Dark, Moody & Cinematic Visuals",
    description: "How to get a consistently dark, atmospheric result from a prompt.",
    date: "12.06.2026",
    slug: "/blog/ai-image-generator-dark-moody-cinematic",
  },
];

const COMPARISON_ROWS = [
  { label: "Color palette", noir: "Black and white, high contrast", cyberpunk: "Saturated neon — pink, cyan, purple" },
  { label: "Mood", noir: "Tense, mysterious, restrained", cyberpunk: "Energetic, futuristic, overstimulating" },
  { label: "Best subject", noir: "A single figure, a quiet street, a shadow", cyberpunk: "A dense city street, reflective surfaces, architecture" },
  { label: "Reference era", noir: "Classic detective-film photography", cyberpunk: "Near-future science fiction" },
  { label: "Works best for", noir: "Minimal, moody personal or portrait content", cyberpunk: "Bold, high-energy scene-setting content" },
];

export default function NoirVsCyberpunkAiImages() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Noir vs Cyberpunk</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Comparison
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Noir vs Cyberpunk: The Two Moodiest AI Image Styles Compared
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Both styles turn an ordinary prompt into something cinematic — in almost opposite directions. Here's how to pick.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 23, 2026 · 5 min read · Comparison</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/noir-vs-cyberpunk-hero.png"
              alt="A split image: a black-and-white film-noir city street on the left, a neon-lit cyberpunk street on the right"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/noir-vs-cyberpunk-detail.png"
              alt="A split close-up: moody film-noir window-blind shadows on the left, glowing neon reflections on wet pavement on the right"
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
              Both Noir and Cyberpunk are named styles in Zyvo's image generator, and both take a prompt somewhere far from a plain, evenly lit photo — just not the same direction.
            </p>
          </section>

          <section>
            <div className="overflow-x-auto rounded-2xl border border-[#E5E0F5]">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="bg-[#F3EFFB]">
                    <th className="px-4 py-3 font-bold text-[#110829]">What matters</th>
                    <th className="px-4 py-3 font-bold text-[#7A3BFF]">Noir</th>
                    <th className="px-4 py-3 font-bold text-[#7A3BFF]">Cyberpunk</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((r, i) => (
                    <tr key={r.label} className={i % 2 === 0 ? "bg-white" : "bg-[#FBFAFE]"}>
                      <td className="px-4 py-3 font-semibold text-[#110829] align-top">{r.label}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{r.noir}</td>
                      <td className="px-4 py-3 text-[#6b7280] align-top">{r.cyberpunk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Want the full cinematic-world version?</h2>
            <p className="text-[17px] leading-relaxed">
              For a full six-image cyberpunk world set instead of a single still, see{" "}
              <Link to="/blog/2am-cyberpunk-city-ai-images" className="text-[#7A3BFF] hover:underline font-semibold">2AM in a Cyberpunk City</Link>.
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
