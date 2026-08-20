import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "15 Micro Camera Animal Video Ideas You Can Generate Right Now",
    description: "Seven real animals, each with its own underground world — with ideas for every one.",
    date: "20.08.2026",
    slug: "/blog/micro-camera-animal-video-ideas",
  },
  {
    title: "What Is Clay Rescue? The Viral Giant-Hand Rescue AI Trend Explained",
    description: "How a giant hand rescues tiny clay people from everyday disasters, without ever touching them.",
    date: "20.08.2026",
    slug: "/blog/what-is-clay-rescue",
  },
  {
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
];

const FAQS = [
  {
    q: "What is Micro Camera Animal?",
    a: "Micro Camera Animal is an AI video format that shows a tiny research-style camera mounted on a real animal — an ant, earthworm, beetle, termite, spider, cricket, or mole — then follows that animal's POV as it travels through its own underground world.",
  },
  {
    q: "Is this real footage?",
    a: "No. Every image and video is AI-generated. It's styled to look like ultra-realistic wildlife research documentation, but no real animal is filmed or fitted with any camera.",
  },
  {
    q: "Which animals can I choose from?",
    a: "Seven animals are available: ant, earthworm, ground beetle, termite, spider, cricket, and mole — each with its own underground world and camera-mounting style.",
  },
  {
    q: "What does one generation actually include?",
    a: "A consistent scene sequence: a researcher attaching the micro-camera to the animal, followed by a POV journey through progressively deeper parts of that animal's underground environment.",
  },
];

export default function WhatIsMicroCameraAnimal() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>What Is Micro Camera Animal</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What Is Micro Camera Animal? The Viral Insect's-Eye-View AI Trend
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A tiny camera, strapped to a real animal, following it into a world humans never see. Here's exactly what the format is, how it's made, and how to generate your own.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 20, 2026 · 7 min read · Complete Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-micro-camera-animal-hero.png"
              alt="A researcher's fingers carefully securing a tiny micro-camera onto the back of an ant using a miniature harness"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/micro-camera-animal-tunnel.png"
              alt="A first-person view down an underground tunnel lined with soil and root threads, lit by a small light source"
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The short answer</h2>
            <p className="text-[17px] leading-relaxed">
              Micro Camera Animal is an AI video format built around one idea: what if a real animal had a tiny research camera strapped to it, and you could follow along as it disappeared underground? Every scene is AI-generated, styled to look like ultra-realistic wildlife research footage — a field researcher attaching the camera, then a POV sequence through the animal's own hidden world.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How it actually works</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              You pick one of seven real animals — ant, earthworm, ground beetle, termite, spider, cricket, or mole — and Zyvo generates a consistent scene sequence:
            </p>
            <div className="space-y-3">
              {[
                { n: "1", title: "The attachment scene", desc: "A field researcher carefully secures a tiny micro-camera onto the animal using a miniature visible harness — the setup shot that establishes the premise." },
                { n: "2", title: "Entering the underground world", desc: "The POV cuts to the camera's perspective as the animal enters its tunnel, burrow, or nest." },
                { n: "3", title: "Progressively deeper scenes", desc: "Each following scene goes deeper — a main passage, a nursery or storage chamber, and finally the deepest part of the colony or burrow." },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-[#E5E0F5] bg-white p-5 flex gap-4">
                  <span className="text-[20px] font-black text-[#D8CFF0] leading-none shrink-0">{s.n}</span>
                  <div>
                    <p className="text-[15px] font-bold text-[#110829] mb-1">{s.title}</p>
                    <p className="text-[14px] text-[#6b7280] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why it works as a content format</h2>
            <p className="text-[17px] leading-relaxed">
              It borrows the curiosity hook of real wildlife documentaries — a perspective humans can't normally access — without needing a research budget, real equipment, or actual animals. The ultra-realistic, scientific-documentary visual style is what sells the premise; viewers respond to it the same way they respond to genuine nature footage, even knowing it's AI-generated.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try It Yourself</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick an animal and generate your first sequence — see{" "}
              <Link to="/blog/micro-camera-animal-video-ideas" className="text-[#7A3BFF] hover:underline font-semibold">15 video ideas</Link>{" "}
              across all seven animals for inspiration.
            </p>
            <Link
              to="/micro-camera-animal-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Micro Camera Animal →
            </Link>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <div key={f.q} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-2">{f.q}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
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
