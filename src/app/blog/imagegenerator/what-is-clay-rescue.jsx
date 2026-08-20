import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "20 Clay Rescue Video Ideas You Can Generate Right Now",
    description: "Twenty real crisis-and-fix pairs, ready to generate today.",
    date: "21.08.2026",
    slug: "/blog/clay-rescue-video-ideas",
  },
  {
    title: "10 Mistakes Killing Your Clay Rescue Video Views",
    description: "The ten most common structural mistakes, with a specific fix for each one.",
    date: "21.08.2026",
    slug: "/blog/clay-rescue-mistakes",
  },
  {
    title: "Why Giant Hand Rescue Videos Go Viral on TikTok in 2026",
    description: "The retention psychology behind miniature disasters, visible fixes, and celebration payoffs.",
    date: "01.06.2026",
    slug: "/blog/why-giant-hand-rescue-videos-go-viral",
  },
  {
    title: "What Is Zyvo? The AI Content Creation Platform Explained",
    description: "Every Zyvo tool in one place, and how they fit together.",
    date: "20.08.2026",
    slug: "/blog/what-is-zyvo",
  },
];

const SCENARIOS = [
  { name: "The Puddle", desc: "Tiny clay people stranded on one side of a puddle that looks like a lake to them." },
  { name: "The Honey Spill", desc: "A slow-moving honey spill threatens to trap the tiny clay town." },
  { name: "The Popcorn Avalanche", desc: "A cascade of popcorn kernels buries the street in an instant." },
  { name: "The Ice Cube Street", desc: "A melting ice cube floods the tiny town's only road." },
  { name: "The Rolling Boulder", desc: "A marble rolls toward the clay village like an unstoppable boulder." },
];

const FAQS = [
  {
    q: "What is Clay Rescue?",
    a: "Clay Rescue is an AI video format where a giant, realistic human hand rescues tiny stop-motion-style clay people from an everyday household object turned disaster — a puddle, spilled honey, a rolling marble — using a simple tool, never touching the clay people directly.",
  },
  {
    q: "Is this real stop-motion animation?",
    a: "No. Every scene is AI-generated, styled to look like claymation, but no physical clay figures or stop-motion filming are involved.",
  },
  {
    q: "Why doesn't the hand ever touch the clay people?",
    a: "It's a deliberate rule in how the format is built — the hand solves the problem indirectly (a ruler as a bridge, a sponge to soak up a spill), which keeps the tone gentle and makes the rescue feel like genuine problem-solving rather than the hand simply picking everyone up.",
  },
  {
    q: "What happens after the rescue?",
    a: "Every scenario ends the same way: only once the danger is fully gone do the clay people react — cheering, celebrating, relieved. That structure — crisis, fix, celebration — is consistent across every generation.",
  },
];

export default function WhatIsClayRescue() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>What Is Clay Rescue</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Complete Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            What Is Clay Rescue? The Viral Giant-Hand Rescue AI Trend Explained
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A tiny clay town, an everyday object turned disaster, and a giant hand that fixes it without ever touching anyone. Here's exactly what the format is and how to make your own.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 20, 2026 · 6 min read · Complete Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/what-is-clay-rescue-hero.png"
              alt="A tiny stop-motion-style clay figure standing in a puddle while a giant human hand lowers a ruler as a bridge"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/clay-rescue-celebration.png"
              alt="A group of tiny clay figures cheering with raised arms on a rescued dry path as a giant hand withdraws"
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
              Clay Rescue is an AI video format where an ordinary household situation — a puddle, a spill, a rolling marble — becomes a genuine crisis for a tiny clay-figure town, and a giant, realistic human hand steps in to fix it. The hand never touches the clay people directly; it solves the problem with a simple tool or gesture, and only once the danger is gone do the tiny figures react.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">The three-beat structure</h2>
            <div className="space-y-3">
              {[
                { n: "1", title: "The crisis", desc: "The disaster is shown clearly — clay people scared, pointing, freezing, or running. No smiles, no relief yet." },
                { n: "2", title: "The fix", desc: "The giant hand solves the problem indirectly — placing a ruler as a bridge, using a sponge to soak up a spill — without ever touching the clay people." },
                { n: "3", title: "The celebration", desc: "Only after the danger is completely gone do the clay people react — cheering, relieved, celebrating together." },
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
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Real scenarios you can generate</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {SCENARIOS.map((s) => (
                <div key={s.name} className="rounded-xl border border-[#E5E0F5] bg-white p-4">
                  <p className="text-[14px] font-bold text-[#110829] mb-1">{s.name}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why the "no touching" rule matters</h2>
            <p className="text-[17px] leading-relaxed">
              A hand that simply picks the clay people up and moves them to safety would resolve the crisis faster, but it removes the ingenuity that makes the rescue satisfying to watch. Solving the problem indirectly — a ruler bridge instead of a lift, a sponge instead of a scoop — is what turns the fix into a small, clever moment instead of a shortcut.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try It Yourself</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a scenario above and generate your first rescue in{" "}
              <Link to="/clay-rescue-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's Clay Rescue tool</Link>.
            </p>
            <Link
              to="/clay-rescue-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Clay Rescue →
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
