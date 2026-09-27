import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "2AM in Minecraft: The Viral AI World Every Player Will Recognize",
    description: "Turn the 'still playing at 2AM' Minecraft feeling into a blocky, moonlit AI image set.",
    date: "Aug 10, 2026",
    slug: "/blog/2am-minecraft-ai-images",
  },
  {
    title: "10 AI Image Styles You Didn't Know You Could Generate",
    description: "Six lesser-known Zyvo image styles most creators never try.",
    date: "23.08.2026",
    slug: "/blog/hidden-ai-image-styles",
  },
  {
    title: "How to Write the Perfect AI Image Generator Prompt (Formula + Examples)",
    description: "A repeatable prompt formula with weak-vs-strong examples.",
    date: "09.08.2026",
    slug: "/blog/ai-image-generator-prompt-formula",
  },
];

const IDEAS = [
  { title: "A cubic landscape scene", desc: "Blocky trees, terrain, and sky — the cleanest way to show off the style at a glance." },
  { title: "A blocky castle or structure", desc: "Complex builds translate surprisingly well into the voxel aesthetic, with each block clearly readable." },
  { title: "A blocky character portrait", desc: "A simple cubic character against a plain background reads instantly, even at a small thumbnail size." },
  { title: "A voxel-style everyday object", desc: "Turning something mundane — a room, a vehicle, a pet — into blocky form is a reliable novelty hook." },
];

export default function MinecraftStyleAiImages() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Minecraft-Style AI Photos</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Style Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Minecraft-Style AI Photos: Turn Any Prompt Into Blocky Art
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            A dedicated blocky, voxel-based image style — good for a lot more than just landscapes. Here's how it works and where it performs best.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 23, 2026 · 5 min read · Style Guide</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/minecraft-style-ai-hero.png"
              alt="A charming blocky voxel-style landscape with cubic trees, a cubic sun, and a small blocky character"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/minecraft-style-ai-castle.png"
              alt="A blocky voxel-style castle made of colorful cubic blocks under a bright blue sky"
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
              The blocky voxel style is one of Zyvo's named image styles — every generation comes back built from clean, cubic geometry rather than smooth or realistic surfaces, regardless of what the subject actually is.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">What to generate with it</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {IDEAS.map((idea) => (
                <div key={idea.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{idea.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{idea.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Beyond a still image</h2>
            <p className="text-[17px] leading-relaxed">
              If the blocky-world nostalgia angle is what draws you in, Zyvo's 2AM Worlds format takes the same feeling further into a full cinematic six-image set — see{" "}
              <Link to="/blog/2am-minecraft-ai-images" className="text-[#7A3BFF] hover:underline font-semibold">2AM in Minecraft</Link>.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Try the Blocky Style</h2>
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
