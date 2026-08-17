import { ArrowRight, Camera, Clapperboard, Sparkles, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../components/workspace/footer.jsx";

const STEPS = [
  {
    icon: Sparkles,
    title: "Pick a place",
    text: "Describe the miniature city, town, or set — a neon harbor, a mountain village, a desert outpost. Anything.",
  },
  {
    icon: Clapperboard,
    title: "Pick a disaster",
    text: "Choose from 30 practical-effects modules — giant waves, eruptions, tornadoes, kaiju, giant robots, aircraft chases, structural collapse, and more.",
  },
  {
    icon: Camera,
    title: "Zyvo builds and animates the shot",
    text: "A photorealistic movie-set image is generated first, then animated into an 8-second video with full practical sound — crew chatter, rig noise, impact.",
  },
];

const DISASTER_HIGHLIGHTS = [
  { icon: "🌊", label: "Giant Wave" },
  { icon: "🌋", label: "Eruption" },
  { icon: "💥", label: "Explosion" },
  { icon: "🌪️", label: "Tornado" },
  { icon: "☄️", label: "Meteor" },
  { icon: "🦖", label: "Giant Creature" },
  { icon: "🤖", label: "Giant Robot" },
  { icon: "🚁", label: "Aircraft Chase" },
  { icon: "🏢", label: "Structural Collapse" },
  { icon: "🛸", label: "Alien Craft" },
  { icon: "🏔️", label: "Avalanche" },
  { icon: "⚡", label: "Superstorm" },
];

const VANTAGES = [
  { label: "Tank Edge", sublabel: "Closest to the chaos", text: "Ground level, right beside the FX tank — cables and rigging crossing the foreground." },
  { label: "Gantry", sublabel: "Full scale reveal", text: "Elevated, looking down over the entire miniature set from the catwalk." },
  { label: "Crane Follow", sublabel: "Most cinematic", text: "A sweeping camera crane move over the miniature during the impact." },
];

const FEATURES = [
  "30 practical-effects disaster modules",
  "3 camera vantages per shot",
  "Full sound design — crew, rigs, impact",
  "Up to 4K image, 1080p video",
  "8-second animated video per episode",
  "\"Surprise Me\" for instant new episodes",
];

const FAQS = [
  {
    q: "What is Behind the Scenes?",
    a: "It's a format that recreates the look of amateur phone footage shot on a real blockbuster movie set — a handcrafted miniature city, a full-size effects crew, and a giant practical disaster hitting the model. Every image and video is AI-generated.",
  },
  {
    q: "Is this real footage from an actual movie set?",
    a: "No. Behind the Scenes generates original, fan-made AI content styled to look like practical-effects filmmaking. It is not real footage, not affiliated with any studio or production, and not a depiction of an actual film shoot.",
  },
  {
    q: "How many disaster types can I choose from?",
    a: "30 — 8 elemental disasters (wave, eruption, explosion, tornado, flood, meteor, firestorm, blizzard) plus 12 extended modules covering giant creatures, aircraft chases, vehicle chases, structural collapse, and more.",
  },
  {
    q: "What do I actually get from one generation?",
    a: "A photorealistic movie-set still image, then an 8-second animated video built from it — always with sound: crew chatter, rig and machine noise, and the disaster's impact.",
  },
  {
    q: "Can I build a series?",
    a: "Yes. Trending episode ideas and a \"Surprise Me\" shortcut make it easy to generate the next episode — same format, new place or disaster each time.",
  },
];

export default function BehindTheScenesLanding() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080A0E] text-white">
      <main>
        <section className="relative border-b border-white/[0.07]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(190,242,100,0.13),transparent_34%),radial-gradient(circle_at_80%_35%,rgba(122,59,255,0.15),transparent_38%)]" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.08fr_0.72fr] lg:gap-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-lime-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                New in Zyvo
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Behind the
                <span className="block bg-gradient-to-r from-lime-200 via-white to-violet-300 bg-clip-text text-transparent">
                  Scenes
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
                A giant practical disaster hits a handcrafted miniature city. A full-size effects crew works the rig beside it. It looks like leaked phone footage from a real blockbuster set — and it's entirely AI-generated, in seconds.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/workspace/behind-the-scenes"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-6 py-3 text-sm font-black text-[#111509] transition hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0E]"
                >
                  Create Your Episode
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <span className="text-sm text-white/38">Image + 8s video · full sound</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[300px]">
              <div className="absolute -inset-8 rounded-full bg-lime-300/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.65)]">
                <img
                  src="/behind-the-scenes/poster.webp"
                  alt="A giant snow cannon blasting a handcrafted miniature alpine village while a special effects crew operates the rig beside a towering blue chroma wall"
                  width="620"
                  height="1112"
                  loading="eager"
                  fetchPriority="high"
                  className="aspect-[9/16] w-full rounded-[27px] object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200">How it works</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">From one place idea to a full episode</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime-300/10 text-lime-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-black text-white/20">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/48">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0D1015]">
          <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
            <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[28px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.5)]">
              <video
                src="/behind-the-scenes/example-1.mp4"
                poster="/behind-the-scenes/poster.webp"
                className="aspect-[9/16] w-full rounded-[22px] object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
            <p className="mt-6 text-center text-sm text-white/40">A real Behind the Scenes generation — image and video, straight out of Zyvo.</p>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200">30 disaster modules</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Pick your chaos</h2>
            <p className="mt-4 text-white/48">Every module is a fully rigged practical effect — never CGI in the concept, always sold through visible crew, cables, and set gear.</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {DISASTER_HIGHLIGHTS.map((d) => (
              <div key={d.label} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                <span className="text-2xl" aria-hidden="true">{d.icon}</span>
                <span className="text-sm font-bold text-white/85">{d.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/35">Plus 18 more — kaiju, alien craft, vehicle chases, avalanches, sandstorms, and full combo disasters.</p>
        </section>

        <section className="border-y border-white/[0.07] bg-[#0D1015]">
          <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200">Camera vantage</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Choose where the crew is standing</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {VANTAGES.map((v) => (
                <div key={v.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6">
                  <h3 className="text-lg font-bold">{v.label}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-lime-200/70">{v.sublabel}</p>
                  <p className="mt-3 text-sm leading-6 text-white/48">{v.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div>
            <Volume2 className="h-8 w-8 text-violet-300" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-black tracking-[-0.035em]">Built to feel real</h2>
            <p className="mt-4 max-w-2xl leading-7 text-white/50">
              Every episode locks the same practical-effects style — weathered miniature materials, a towering blue chroma wall, tracking crosses on the floor, full-size crew for scale — so the format stays consistent no matter what disaster or place you pick.
            </p>
          </div>
          <ul className="mt-8 grid gap-3 text-sm text-white/64 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map((item) => (
              <li key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">{item}</li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200 mb-4">Guides</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["What Is the \"Behind the Scenes\" Trend?", "Why the format works and how to make your first episode.", "/blog/behind-the-scenes-trend-explained"],
              ["Why It Looks So Real", "The five locked ingredients that sell the illusion.", "/blog/behind-the-scenes-how-its-made"],
              ["30 Video Ideas", "Curated place-and-disaster combos, ready to copy.", "/blog/behind-the-scenes-video-ideas"],
              ["Choosing a Camera Angle", "Tank Edge, Gantry, or Crane Follow — when to use each.", "/blog/behind-the-scenes-camera-vantage"],
              ["Build a Series", "Four pillars of a consistent season.", "/blog/behind-the-scenes-series"],
            ].map(([title, text, href]) => (
              <Link key={href} to={href} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-lime-300/30">
                <h3 className="text-base font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-center text-3xl font-black tracking-[-0.035em]">Behind the Scenes FAQs</h2>
          <div className="mt-9 space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <summary className="cursor-pointer list-none pr-6 text-base font-bold marker:hidden">{item.q}</summary>
                <p className="mt-3 text-sm leading-6 text-white/50">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-[1000px] rounded-[28px] border border-lime-200/15 bg-[linear-gradient(135deg,rgba(190,242,100,0.12),rgba(122,59,255,0.15))] px-6 py-12 text-center sm:px-10">
            <h2 className="text-3xl font-black tracking-[-0.035em]">Your movie set is waiting</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/52">Pick a place, pick a disaster, and let Zyvo build and animate the shot.</p>
            <Link to="/workspace/behind-the-scenes" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200">
              Open Behind the Scenes
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
