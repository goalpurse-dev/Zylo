import { ArrowRight, CarFront, Film, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "15 Cartoon Drive-By Video Ideas (With Prompts You Can Copy)",
    description: "Fifteen fictional destinations across car, train, bus, and plane viewpoints, each with a ready-to-use prompt.",
    date: "11.08.2026",
    slug: "/blog/cartoon-drive-by-video-ideas",
  },
];

const STEPS = [
  {
    icon: Sparkles,
    title: "Describe a fictional destination",
    text: "Pick a cartoon- or game-inspired place and describe its mood — lantern-lit village at dusk, neon city at night, sunlit coastal town.",
  },
  {
    icon: CarFront,
    title: "Choose the moving viewpoint",
    text: "Select a car, train, bus, or plane so the shot is framed from a believable passenger window.",
  },
  {
    icon: Film,
    title: "Generate and animate",
    text: "Zyvo builds the still first, then turns it into a continuous 10-second vertical drive-by with realistic parallax motion.",
  },
];

export default function CartoonDriveByExplained() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Cartoon Drive-By</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            New Format
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            What Is a Cartoon Drive-By Video? (And How to Make One)
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A quiet, nostalgic new short-form format is spreading across TikTok and Reels: a vertical clip that looks like you're passing a fictional cartoon or game world through the window of a moving car, train, bus, or plane. Here's what makes it work and how to generate one yourself.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 11, 2026 · 6 min read · Content Format</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/cartoon-drive-by-explained-hero.png"
            alt="View through a car window at dusk of a glowing fantasy village passing by"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why This Format Is Spreading</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              The drive-by shot borrows a very familiar feeling: staring out a car or plane window while a place slides past, half-noticed. Pairing that ordinary moment with an impossible, fictional destination — a floating island, a lantern-lit village, a neon-soaked city — creates an instant contrast that stops the scroll without needing a person, a voiceover, or an explanation.
            </p>
            <p className="text-[16px] leading-relaxed">
              It also works because it's a single continuous shot. There's no cutting, no editing rhythm to get right — just one believable moving frame, which makes it fast to produce and easy to watch on a loop.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">What Makes the Motion Feel Real</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              The illusion depends on parallax — nearby objects like trees, fences, and road signs moving faster across the frame than the distant destination itself, exactly like looking out a real vehicle window. Zyvo's Cartoon Drive-By workflow builds this in automatically: the still image is generated first, then animated into a continuous motion pass with foreground blur, window reflections, and depth-correct movement layered on top.
            </p>
            <p className="text-[16px] leading-relaxed">
              The vehicle you choose changes the framing entirely. A car keeps the destination close and grounded. A plane pulls it distant and dreamlike, seen through clouds. A train adds a steady horizontal glide. Matching the vehicle to the mood of the destination is most of the creative decision.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">How to Generate One in Zyvo</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-300/10 text-lime-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-[12px] font-black text-white/20">0{index + 1}</span>
                  </div>
                  <h3 className="text-[15px] font-bold text-white mb-2">{title}</h3>
                  <p className="text-[13px] leading-relaxed text-white/50">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Keep the World Original</h2>
            <p className="text-[16px] leading-relaxed">
              The strongest results come from describing an original fictional place inspired by a genre or mood — a cartoon countryside, a retro pixel town, a floating sky city — rather than naming a specific existing franchise. This gives you full creative control and keeps the video clearly your own fictional destination.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try It Yourself</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Describe a destination, pick a vehicle, and let Zyvo build and animate the shot.
            </p>
            <Link
              to="/workspace/cartoon-drive-by"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Create a Cartoon Drive-By
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

        </div>

        <div className="mt-20 -mx-6 rounded-[24px] bg-[#F7F5FA] py-10 sm:mx-0">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
