import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is a Cartoon Drive-By Video? (And How to Make One)",
    description: "Why the format works, what makes the motion feel real, and how to generate one in Zyvo.",
    date: "11.08.2026",
    slug: "/blog/cartoon-drive-by-explained",
  },
  {
    title: "6 Mistakes Killing Your Cartoon Drive-By Video Views",
    description: "The most common reasons results come back generic, and the fix for each one.",
    date: "21.08.2026",
    slug: "/blog/cartoon-drive-by-mistakes",
  },
];

const IDEAS = [
  {
    n: "01",
    vehicle: "Car",
    title: "A lantern-lit village at dusk",
    prompt: "A cobbled fantasy village with lantern-lit rooftops passing by outside a car window at dusk, warm glowing windows, misty streets, cinematic magical-realism style.",
  },
  {
    n: "02",
    vehicle: "Plane",
    title: "A floating island city at sunset",
    prompt: "A distant floating island city with glowing towers seen through an airplane window at golden hour, soft clouds drifting below, dreamy cinematic lighting.",
  },
  {
    n: "03",
    vehicle: "Train",
    title: "A neon cyberpunk skyline",
    prompt: "A dense neon-lit futuristic city skyline gliding past a train window at night, rain streaks on the glass, glowing signs and flying vehicles in the distance.",
  },
  {
    n: "04",
    vehicle: "Bus",
    title: "A candy-colored dessert town",
    prompt: "A whimsical town built from oversized candy and pastry architecture passing by a bus window in soft daylight, pastel colors, playful cartoon style.",
  },
  {
    n: "05",
    vehicle: "Car",
    title: "A foggy horror-movie town",
    prompt: "An eerie fog-covered small town with flickering streetlights passing by a car window at night, abandoned storefronts, muted color palette, unsettling mood.",
  },
  {
    n: "06",
    vehicle: "Plane",
    title: "A pixel-art retro game world",
    prompt: "A blocky retro pixel-art landscape with mountains and villages seen through an airplane window, bright saturated colors, nostalgic 16-bit game aesthetic.",
  },
  {
    n: "07",
    vehicle: "Train",
    title: "An underwater glass tunnel city",
    prompt: "A city built inside a glass tunnel beneath the ocean, glowing coral and sea creatures passing by a train window, blue bioluminescent light, futuristic architecture.",
  },
  {
    n: "08",
    vehicle: "Car",
    title: "A giant treehouse forest kingdom",
    prompt: "An enormous treehouse kingdom built into ancient glowing trees passing by a car window at twilight, rope bridges, warm firefly light, fantasy illustration style.",
  },
  {
    n: "09",
    vehicle: "Bus",
    title: "A desert canyon trading outpost",
    prompt: "A sunbaked desert trading outpost built into red canyon walls passing by a bus window at midday, market stalls, dusty streets, warm cinematic light.",
  },
  {
    n: "10",
    vehicle: "Plane",
    title: "A cloud kingdom above the mountains",
    prompt: "A sprawling kingdom built on clouds above snow-capped mountains seen through an airplane window at dawn, soft pink sky, floating stone towers.",
  },
  {
    n: "11",
    vehicle: "Car",
    title: "A summer seaside boardwalk town",
    prompt: "A cheerful cartoon seaside boardwalk town with a ferris wheel passing by a car window in late afternoon sun, arcade lights, pastel buildings, nostalgic summer mood.",
  },
  {
    n: "12",
    vehicle: "Train",
    title: "A steampunk clockwork city",
    prompt: "A steampunk city of brass gears and steam vents passing by a train window at dusk, glowing clock towers, orange industrial light, intricate mechanical architecture.",
  },
  {
    n: "13",
    vehicle: "Bus",
    title: "A snowy mountain ski village",
    prompt: "A cozy snow-covered ski village with glowing cabin windows passing by a bus window at night, falling snow, warm firelight, cartoon winter illustration style.",
  },
  {
    n: "14",
    vehicle: "Car",
    title: "A jungle ruins temple road",
    prompt: "An overgrown jungle road winding past ancient stone temple ruins outside a car window at midday, dense green canopy, dappled sunlight, adventure film mood.",
  },
  {
    n: "15",
    vehicle: "Plane",
    title: "A moonlit space colony dome",
    prompt: "A glowing dome-covered space colony on an alien moon surface seen through a plane window, starfield sky, soft blue and violet lighting, retro-futurist style.",
  },
];

function IdeaCard({ idea }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[22px] font-black text-white/15 leading-none">{idea.n}</span>
        <span className="rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-lime-200">
          {idea.vehicle}
        </span>
      </div>
      <h3 className="text-[16px] font-bold text-white mb-3">{idea.title}</h3>
      <p className="text-[13px] leading-relaxed text-white/50 italic">{idea.prompt}</p>
    </div>
  );
}

export default function CartoonDriveByVideoIdeas() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Cartoon Drive-By</span>
        </nav>

        <header className="mb-14 max-w-4xl">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Prompt Ideas
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            15 Cartoon Drive-By Video Ideas (With Prompts You Can Copy)
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Fifteen fictional destinations across every viewpoint the tool supports — car, train, bus, and plane. Copy any prompt below into Zyvo's Cartoon Drive-By generator and adjust the mood, lighting, or vehicle to make it your own.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 11, 2026 · 6 min read · Prompt Ideas</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/cartoon-drive-by-video-ideas-hero.png"
            alt="View through an airplane window of a distant floating island city glowing at sunset"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
          {IDEAS.map((idea) => (
            <IdeaCard key={idea.n} idea={idea} />
          ))}
        </div>

        <section className="mt-16 max-w-3xl">
          <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Picking the Right Vehicle</h2>
          <p className="text-[16px] leading-relaxed text-white/68 mb-4">
            The vehicle changes more than the framing — it sets the pacing and mood. Cars keep the destination close and intimate, good for cozy or eerie scenes. Planes push it distant and dreamlike, best for grand or otherworldly places. Trains add a steady horizontal glide suited to sprawling skylines. Buses sit in between, useful for daytime, ground-level towns.
          </p>
          <p className="text-[16px] leading-relaxed text-white/68">
            Start with any prompt above, then swap the destination details — architecture style, lighting, weather — while keeping the same structure: [vehicle viewpoint], [destination], [time of day], [mood/lighting details].
          </p>
        </section>

        <section className="mt-14 max-w-3xl">
          <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Generate Your Own</h2>
          <p className="text-[16px] leading-relaxed text-white/68 mb-6">
            Pick a prompt above, or describe your own fictional destination, then let Zyvo build and animate the drive-by shot.
          </p>
          <Link
            to="/workspace/cartoon-drive-by"
            className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
          >
            Create a Cartoon Drive-By
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <div className="mt-20 -mx-6 rounded-[24px] bg-[#F7F5FA] py-10 sm:mx-0">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
