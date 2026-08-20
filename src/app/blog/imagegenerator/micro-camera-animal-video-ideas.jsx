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

const ANIMALS = [
  { animal: "Ant", ideas: ["Follow a worker ant from the surface into a crowded main tunnel", "Enter a nursery chamber filled with eggs, larvae, and pupae", "Reach a food storage chamber lined with seed fragments", "Go all the way to the deepest colony core"] },
  { animal: "Earthworm", ideas: ["Push through dark, moist organic soil near the surface", "Navigate a dense root network underground", "Move through a layer of decomposed leaf matter", "Reach the deepest mineral soil layer"] },
  { animal: "Ground Beetle", ideas: ["Enter a burrow from a sandy surface entrance", "Pass through a compact underground passage", "Find an egg chamber lined with organic matter", "Reach a hidden food cache deep in the burrow"] },
  { animal: "Termite", ideas: ["Enter a nest through cellulose fiber walls", "Move through a busy worker passage", "Explore a chamber deep inside the colony"] },
  { animal: "Spider", ideas: ["Follow a spider into its silk-lined burrow", "Explore a hidden underground retreat"] },
  { animal: "Cricket", ideas: ["Enter a burrow from a grassy surface opening", "Move through an underground shelter passage"] },
  { animal: "Mole", ideas: ["Follow a mole into a fresh surface tunnel", "Navigate a deep underground tunnel network"] },
];

export default function MicroCameraAnimalVideoIdeas() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Micro Camera Animal Video Ideas</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Video Ideas
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            15 Micro Camera Animal Video Ideas You Can Generate Right Now
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Seven real animals, each with its own underground world — ideas for every one, from a first surface entrance to the deepest chamber.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 20, 2026 · 6 min read · Video Ideas</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/micro-camera-animal-ideas-hero.png"
              alt="A small mole emerging from an underground burrow entrance in soft morning light"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/micro-camera-animal-beetle.png"
              alt="A ground beetle on dry sandy soil beside a small burrow entrance"
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
              Every animal in Zyvo's Micro Camera Animal generator has its own underground world with a real, distinct visual identity — soil composition, tunnel structure, and chamber types all differ by species. Here's a starting idea list for each one.
            </p>
          </section>

          <section>
            <div className="space-y-5">
              {ANIMALS.map((a) => (
                <div key={a.animal} className="rounded-2xl border border-[#E5E0F5] bg-white p-6">
                  <h3 className="text-[17px] font-bold text-[#110829] mb-3">{a.animal}</h3>
                  <ul className="space-y-2">
                    {a.ideas.map((idea) => (
                      <li key={idea} className="flex items-start gap-2 text-[14px] text-[#4A4A55] leading-relaxed">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#7A3BFF] shrink-0" />
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Which animal should you start with?</h2>
            <p className="text-[17px] leading-relaxed">
              Ant and mole tend to produce the most immediately readable results — both have visually distinct underground structures (a busy colony, a clean tunnel network) that read clearly even to viewers unfamiliar with the format. Spider and cricket are good picks once you want to expand into less-covered territory.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Generate Your First Sequence</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick an animal and an idea from the list above, then generate it directly in{" "}
              <Link to="/micro-camera-animal-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's Micro Camera Animal tool</Link>. New to the format? Start with{" "}
              <Link to="/blog/what-is-micro-camera-animal" className="text-[#7A3BFF] hover:underline font-semibold">the complete guide</Link>.
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
