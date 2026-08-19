import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How to Write the Perfect AI Image Generator Prompt (Formula + Examples)",
    description: "A repeatable 6-part prompt formula, with weak-vs-strong examples for cinematic, product, and anime styles.",
    date: "19.08.2026",
    slug: "/blog/ai-image-generator-prompt-formula",
  },
  {
    title: "AI Image Generator Examples: 8 Real Styles You Can Create Right Now",
    description: "Real output across Zyvo's cinematic, 3D, and realistic styles, and what each one is actually good at.",
    date: "19.08.2026",
    slug: "/blog/ai-image-generator-examples",
  },
  {
    title: "Which AI Image Style Works Best?",
    description: "Anime, 3D, or realistic — use only the best AI image styles and learn to control them.",
    date: "12.03.2026",
    slug: "/blog/which-ai-image-style-works-best",
  },
];

const MISTAKES = [
  { n: "01", title: "Writing a vague, one-word prompt", problem: "\"Cool image\" or \"astronaut\" gives the generator nothing to commit to, so it defaults to the most generic possible interpretation.", fix: "Use the 6-part formula — subject, style, setting, lighting, composition, detail level — even in a short prompt." },
  { n: "02", title: "Not naming a style", problem: "Without a named style, results swing unpredictably between cinematic, realistic, and stylized on every generation.", fix: "Always name one style explicitly: cinematic, 3D, anime, realistic, or product." },
  { n: "03", title: "Skipping the lighting description", problem: "Lighting does more to make an image look intentional than almost any other single word choice — leaving it out is the most common reason results look flat.", fix: "Name a light source and mood: golden hour backlight, soft studio lighting, dramatic rim lighting." },
  { n: "04", title: "Regenerating instead of refining", problem: "Starting over from scratch after a weak result throws away everything that was already working about the prompt.", fix: "Change one part of the formula at a time — swap only the lighting or only the composition — to isolate what's actually not working." },
  { n: "05", title: "Using the wrong style for the job", problem: "A product photo generated in anime style, or a portrait generated in product-photography style, fights the subject matter.", fix: "Match the style to the use case: product for ecommerce, realistic for portraits, cinematic for thumbnails and hero images." },
  { n: "06", title: "Ignoring composition and framing", problem: "Without a stated camera angle, most generations default to a generic centered, medium-distance shot.", fix: "Name a composition: wide shot, close-up, low angle — it's a small addition that changes the whole feel of the image." },
  { n: "07", title: "Overloading one prompt with too many ideas", problem: "Cramming multiple subjects or conflicting styles into one prompt forces the generator to compromise on all of them.", fix: "Keep one subject and one style per generation. Generate separate images rather than merging unrelated ideas into one prompt." },
  { n: "08", title: "Not specifying detail level", problem: "Leaving detail level unstated means texture and sharpness are inconsistent between generations of the same subject.", fix: "Add a detail cue like \"sharp focus, high detail\" for images meant to be viewed up close." },
];

export default function AIImageGeneratorMistakes() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>AI Image Generator Mistakes</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            AI Image Generator
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            10 AI Image Generator Mistakes to Avoid (And How to Fix Each One)
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The most common reasons AI-generated images come back looking generic — and the specific prompt change that fixes each one.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 19, 2026 · 7 min read · AI Image Generator</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-image-generator-mistakes-hero.png"
            alt="An abstract glowing image showing a fractured, glitching artwork dissolving into clean sharp light particles"
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
              Most disappointing AI images trace back to one of a small number of fixable prompt habits — not a limitation of the generator itself. Here are the eight most common ones, with the exact fix for each.
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

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">The pattern behind all of these</h2>
            <p className="text-[17px] leading-relaxed">
              Every mistake above comes down to the same root cause: leaving a decision unstated and letting the generator guess. The fix is almost always the same too — name the thing you actually want instead of describing what you don't want. See the{" "}
              <Link to="/blog/ai-image-generator-prompt-formula" className="text-[#7A3BFF] hover:underline font-semibold">full prompt formula</Link>{" "}
              for the complete structure.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Fix Your Next Prompt</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick one mistake above that sounds familiar, apply the fix, and generate it in{" "}
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
