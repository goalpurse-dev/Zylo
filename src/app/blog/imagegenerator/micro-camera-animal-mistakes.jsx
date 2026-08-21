import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is Micro Camera Animal? The Viral Insect's-Eye-View AI Trend",
    description: "What the format is, how it's made, and why it works as a content format.",
    date: "20.08.2026",
    slug: "/blog/what-is-micro-camera-animal",
  },
  {
    title: "15 Micro Camera Animal Video Ideas You Can Generate Right Now",
    description: "Seven real animals, each with its own underground world, with ideas for every one.",
    date: "20.08.2026",
    slug: "/blog/micro-camera-animal-video-ideas",
  },
  {
    title: "How to Turn One Micro Camera Animal Video Into a Series",
    description: "Four pillars of a season, and a simple way to structure a progressive-depth story arc.",
    date: "21.08.2026",
    slug: "/blog/micro-camera-animal-series",
  },
];

const MISTAKES = [
  { n: "01", title: "Skipping the attachment scene", problem: "Cutting straight to the underground POV without the researcher attaching the camera loses the setup that makes the whole premise make sense.", fix: "Always open with the attachment scene — it's what tells the viewer what they're about to watch." },
  { n: "02", title: "Not naming a specific animal", problem: "A vague request forces the generator to default to a generic interpretation instead of a specific, distinct underground world.", fix: "Always name one of the seven real animals — ant, earthworm, beetle, termite, spider, cricket, or mole." },
  { n: "03", title: "Staying too shallow", problem: "Stopping at the surface entrance skips the payoff — the deeper chambers are where the format's curiosity hook actually pays off.", fix: "Let the sequence progress through multiple depths, ending in the deepest chamber or colony core." },
  { n: "04", title: "Breaking visual consistency between scenes", problem: "If the soil texture, lighting, or camera angle shifts unnaturally between scenes, it stops reading as one continuous POV journey.", fix: "Keep the same camera style and mounting position consistent — the same animal, same camera, same POV, throughout." },
  { n: "05", title: "Ignoring the animal's real environment", problem: "Giving a mole a spider's silk-lined burrow, or an ant a mole's open tunnel, breaks the documentary realism that sells the format.", fix: "Match the environment to the real animal — soil tunnels for ants and moles, silk-lined burrows for spiders." },
  { n: "06", title: "Posting only one animal repeatedly", problem: "A channel that only ever shows the same animal loses the variety that makes the format interesting to follow.", fix: "Rotate across the seven available animals — each one has a genuinely distinct underground world worth showing." },
  { n: "07", title: "Underselling the documentary style", problem: "A style that looks too cartoonish or stylized undercuts the 'real research footage' illusion that makes this format work.", fix: "Keep the visual style ultra-realistic and scientific — that's the entire premise the format depends on." },
  { n: "08", title: "No sense of scale", problem: "Without visual cues showing just how small the animal and camera are, the miniature-world illusion doesn't land.", fix: "Let root threads, soil particles, and tunnel walls appear appropriately massive relative to the animal for a convincing scale." },
];

export default function MicroCameraAnimalMistakes() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Micro Camera Animal Mistakes</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Content Strategy
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            8 Mistakes Killing Your Micro Camera Animal Video Views
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The most common structural mistakes in Micro Camera Animal videos, with a specific fix for each one.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 6 min read · Content Strategy</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/micro-camera-animal-mistakes-hero.png"
              alt="A tiny camera loosely and poorly attached to a beetle at an awkward crooked angle"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/micro-camera-animal-mistakes-fixed.png"
              alt="A tiny camera perfectly and securely mounted on a spider facing forward"
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
              Micro Camera Animal has a strict internal logic — a specific animal, a real environment, a consistent POV, progressive depth. Almost every underperforming video breaks one part of it. Here's what to check.
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
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Fix Your Next Generation</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Check your next generation against this list, or start from a proven idea in{" "}
              <Link to="/blog/micro-camera-animal-video-ideas" className="text-[#7A3BFF] hover:underline font-semibold">15 Micro Camera Animal video ideas</Link>.
            </p>
            <Link
              to="/micro-camera-animal-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Micro Camera Animal →
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
