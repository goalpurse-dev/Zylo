import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is Clay Rescue? The Viral Giant-Hand Rescue AI Trend Explained",
    description: "How a giant hand rescues tiny clay people from everyday disasters, without ever touching them.",
    date: "20.08.2026",
    slug: "/blog/what-is-clay-rescue",
  },
  {
    title: "10 Mistakes Killing Your Clay Rescue Video Views",
    description: "The ten most common structural mistakes, with a specific fix for each one.",
    date: "21.08.2026",
    slug: "/blog/clay-rescue-mistakes",
  },
  {
    title: "Why Giant Hand Rescue Videos Go Viral on TikTok in 2026",
    description: "The retention psychology behind miniature disasters and celebration payoffs.",
    date: "01.06.2026",
    slug: "/blog/why-giant-hand-rescue-videos-go-viral",
  },
];

const IDEAS = [
  { crisis: "Giant hole in the road", fix: "A sticker patch pressed flat over the pothole" },
  { crisis: "Train stuck under a fallen rock", fix: "Two fingers lift the rock straight off the track" },
  { crisis: "Village drowning in soap bubbles", fix: "A pin pops the bubble pile in a chain reaction" },
  { crisis: "Giant watermelon blocking the street", fix: "A spoon scoops it away piece by piece" },
  { crisis: "Boat spinning in a whirlpool", fix: "A straw redirects the current away" },
  { crisis: "Bees swarming the village square", fix: "The flower pot they're circling gets moved away" },
  { crisis: "Village bridge snapped in half", fix: "A popsicle stick laid across the gap" },
  { crisis: "Boulder rolling toward houses", fix: "One fingertip stops it instantly" },
  { crisis: "Fountain overflowing, flooding the plaza", fix: "A sponge dropped in to absorb the water" },
  { crisis: "Pizza slice fallen onto parked cars", fix: "A fork slides underneath and lifts it away" },
  { crisis: "Honey spill trapping the marketplace", fix: "A paper towel wipes it up in one sweep" },
  { crisis: "Candle flame threatening the town", fix: "A single visible gust of breath blows it out" },
  { crisis: "Apple rolling downhill toward market stalls", fix: "A fingertip gently stops it in place" },
  { crisis: "Sandstorm burying a desert village", fix: "A small brush sweeps the sand away" },
  { crisis: "Giant book blocking the town gate", fix: "The hand lifts one corner and slides it aside" },
  { crisis: "People stranded across a puddle", fix: "A ruler placed down as a bridge" },
  { crisis: "Hailstones smashing a tiny farm", fix: "A bowl flipped over as a protective dome" },
  { crisis: "Giant noodle tangled around traffic", fix: "Chopsticks pinch and lift the whole strand away" },
  { crisis: "Dam crack spraying water at the village", fix: "A strip of tape pressed over the leak" },
  { crisis: "Popcorn avalanche tumbling toward town", fix: "A bowl placed at the base catches it all" },
];

export default function ClayRescueVideoIdeas() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Clay Rescue Video Ideas</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Video Ideas
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            20 Clay Rescue Video Ideas You Can Generate Right Now
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Twenty real crisis-and-fix pairs — from a puddle stranding, to a popcorn avalanche, to a bee swarm — ready to generate today.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 7 min read · Video Ideas</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/clay-rescue-ideas-honey.png"
              alt="A tiny clay figure behind a honey spill while a giant hand presses a paper towel onto it"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/clay-rescue-ideas-popcorn.png"
              alt="A popcorn avalanche tumbling toward a tiny clay village while a giant hand places a bowl to catch it"
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
              Every idea below follows Clay Rescue's real three-beat structure: a clear crisis, an indirect fix using a simple tool, and a celebration only once the danger is fully gone. Pick any pairing and generate it directly.
            </p>
          </section>

          <section>
            <div className="grid gap-3 sm:grid-cols-2">
              {IDEAS.map((idea, i) => (
                <div key={idea.crisis} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-black text-[#D8CFF0]">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-[13px] font-bold text-[#110829]">{idea.crisis}</p>
                  </div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed"><span className="font-semibold text-[#7A3BFF]">Fix: </span>{idea.fix}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Why the fix matters more than the crisis</h2>
            <p className="text-[17px] leading-relaxed">
              Any of these crises could resolve with the hand simply picking everyone up — the reason it doesn't is what makes the format work. An indirect fix using a household object (a ruler, a sponge, a fork) is the clever, memorable part of the video; the crisis itself is just the setup.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Generate Your First Rescue</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a crisis-and-fix pairing above and generate it in{" "}
              <Link to="/clay-rescue-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's Clay Rescue tool</Link>. New to the format? Start with{" "}
              <Link to="/blog/what-is-clay-rescue" className="text-[#7A3BFF] hover:underline font-semibold">the complete guide</Link>.
            </p>
            <Link
              to="/clay-rescue-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open Clay Rescue →
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
