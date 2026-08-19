import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "6 Real AI Fruit Story Examples You Can Recreate in Minutes",
    description: "Real preset screenshots from the generator, with the exact opening lines used in each.",
    date: "18.08.2026",
    slug: "/blog/ai-fruit-story-examples",
  },
  {
    title: "Best AI Image Generator for Social Media Content",
    description: "How to choose the best AI image generator for social media in 2026.",
    date: "11.02.2026",
    slug: "/blog/best-ai-image-generator-for-social-media",
  },
  {
    title: "Which AI Image Style Works Best?",
    description: "Anime, 3D, or realistic — use only the best AI image styles and learn to control them.",
    date: "12.03.2026",
    slug: "/blog/which-ai-image-style-works-best",
  },
  {
    title: "AI Image Generator Examples: 8 Real Styles You Can Create Right Now",
    description: "Real output across Zyvo's cinematic, 3D, and realistic styles, and what each one is actually good at.",
    date: "19.08.2026",
    slug: "/blog/ai-image-generator-examples",
  },
];

const FORMULA = [
  { n: "1", part: "Subject", desc: "What's actually in the frame — a person, object, scene, or character.", example: "\"a lone astronaut\"" },
  { n: "2", part: "Style", desc: "The rendering approach — cinematic, 3D, anime, realistic, or product.", example: "\"cinematic lighting\"" },
  { n: "3", part: "Setting", desc: "Where the subject is, and what's around it.", example: "\"standing on a red desert dune\"" },
  { n: "4", part: "Lighting", desc: "The light source and mood it creates.", example: "\"golden hour backlight\"" },
  { n: "5", part: "Composition", desc: "Framing and camera angle — close-up, wide shot, low angle.", example: "\"wide shot, low angle\"" },
  { n: "6", part: "Detail level", desc: "How much texture and finish to render.", example: "\"sharp focus, high detail\"" },
];

const EXAMPLES = [
  {
    weak: "\"astronaut on mars\"",
    strong: "\"A lone astronaut standing on a red desert dune, cinematic lighting, golden hour backlight, wide shot, low angle, sharp focus, high detail.\"",
    why: "The weak version leaves every creative decision to chance. The strong version tells the generator exactly what style, light, and framing to commit to — which is why it comes back looking intentional instead of generic.",
  },
  {
    weak: "\"cool product photo\"",
    strong: "\"A skincare bottle on a clean marble surface, product photography style, soft studio lighting, straight-on composition, sharp focus, high detail, clean background.\"",
    why: "\"Cool\" means nothing to a generator. Naming the actual style (product photography), the light setup, and the composition removes the guesswork entirely.",
  },
  {
    weak: "\"anime girl\"",
    strong: "\"A samurai warrior standing in a bamboo forest, anime style, clean line work, dramatic rim lighting, close-up composition, sharp focus, high detail.\"",
    why: "Naming a specific subject and setting gives the generator something to actually compose around, instead of defaulting to the most generic version of the request.",
  },
];

export default function AIImageGeneratorPromptFormula() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>AI Image Generator Prompt Formula</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            AI Image Generator
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How to Write the Perfect AI Image Generator Prompt (Formula + Examples)
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A repeatable 6-part formula for writing prompts that come back looking intentional instead of generic — with weak-vs-strong examples for cinematic, product, and anime styles.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 19, 2026 · 7 min read · AI Image Generator</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-image-generator-prompt-formula-hero.png"
            alt="An abstract burst of glowing purple and blue light representing a prompt transforming into a finished AI image"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <p className="text-[17px] leading-relaxed">
              Most disappointing AI images aren't a generator problem — they're a prompt problem. A vague request forces the model to guess at style, lighting, and composition, and it usually guesses generic. Here's the exact 6-part structure that removes the guesswork.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">The 6-part formula</h2>
            <div className="space-y-3">
              {FORMULA.map((f) => (
                <div key={f.n} className="rounded-xl border border-[#E5E0F5] bg-white p-5 flex gap-4">
                  <span className="text-[20px] font-black text-[#D8CFF0] leading-none shrink-0">{f.n}</span>
                  <div>
                    <p className="text-[15px] font-bold text-[#110829] mb-1">{f.part}</p>
                    <p className="text-[13px] text-[#6b7280] leading-relaxed mb-1.5">{f.desc}</p>
                    <p className="text-[13px] text-[#7A3BFF] italic">{f.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Weak vs strong, side by side</h2>
            <div className="space-y-5">
              {EXAMPLES.map((ex, i) => (
                <div key={i} className="rounded-2xl border border-[#E5E0F5] bg-white p-6">
                  <div className="mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#EF4444] mb-1">Weak</p>
                    <p className="text-[14px] text-[#6b7280] italic">{ex.weak}</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#22C55E] mb-1">Strong</p>
                    <p className="text-[15px] font-semibold text-[#110829] italic leading-relaxed">{ex.strong}</p>
                  </div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed"><span className="font-bold text-[#110829]">Why it works: </span>{ex.why}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">You don't need all six every time</h2>
            <p className="text-[17px] leading-relaxed">
              Subject and style carry most of the weight — if you only have time for two parts, start there. Setting, lighting, composition, and detail level are what separate a good image from one that looks deliberately art-directed, so add them once you're generating regularly.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try the Formula Now</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a style — cinematic, 3D, anime, realistic, or product — and write one prompt using all six parts. Then generate it in{" "}
              <Link to="/image-generator" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI image generator</Link>.
            </p>
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
