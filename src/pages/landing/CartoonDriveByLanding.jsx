import { ArrowRight, CarFront, Film, Layers3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import cartoonDrivePreview from "../../assets/home/latest/image9.16-fast.webp";
import Footer from "../../components/workspace/footer.jsx";

const STEPS = [
  {
    icon: Sparkles,
    title: "Describe a fictional world",
    text: "Enter a recognizable cartoon- or game-inspired destination and choose the mood you want to capture.",
  },
  {
    icon: CarFront,
    title: "Choose the moving viewpoint",
    text: "Select a car, train, bus, or plane so the scene is framed from a believable passenger perspective.",
  },
  {
    icon: Film,
    title: "Generate and animate",
    text: "Zyvo builds the still first, then turns it into a continuous 10-second vertical drive-by with realistic parallax.",
  },
];

const FAQS = [
  {
    q: "What is a cartoon drive-by video?",
    a: "It is a fictional, stylized travel shot that passes a cartoon- or game-inspired destination from inside a moving vehicle. It is an entertainment format, not a depiction of violence.",
  },
  {
    q: "How long is the generated video?",
    a: "The current Cartoon Drive-By workflow creates a continuous 10-second video in a vertical 9:16 format.",
  },
  {
    q: "Which vehicles can I choose?",
    a: "The current tool supports car, train, bus, and plane viewpoints, with motion and framing adjusted for the selected vehicle.",
  },
  {
    q: "Can I create a video for TikTok or Reels?",
    a: "Yes. The tool is designed around a 9:16 vertical frame suitable for TikTok, Instagram Reels, and YouTube Shorts.",
  },
];

export default function CartoonDriveByLanding() {
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
                Cartoon Drive-By
                <span className="block bg-gradient-to-r from-lime-200 via-white to-violet-300 bg-clip-text text-transparent">
                  Video Maker
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
                Turn a fictional cartoon or game-inspired destination into a nostalgic vertical travel shot—seen through the window of a moving car, train, bus, or plane.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/workspace/cartoon-drive-by"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-6 py-3 text-sm font-black text-[#111509] transition hover:bg-lime-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0E]"
                >
                  Create a Cartoon Drive-By
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <span className="text-sm text-white/38">10 seconds · 9:16 vertical</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[330px]">
              <div className="absolute -inset-8 rounded-full bg-lime-300/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-[#111318] p-2 shadow-[0_36px_90px_rgba(0,0,0,0.65)]">
                <img
                  src={cartoonDrivePreview}
                  alt="A distant temple above the clouds viewed through an airplane window"
                  width="720"
                  height="1280"
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
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">From one place idea to a moving world</h2>
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
          <div className="mx-auto grid max-w-[1100px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div>
              <Layers3 className="h-8 w-8 text-violet-300" aria-hidden="true" />
              <h2 className="mt-5 text-3xl font-black tracking-[-0.035em]">Built for convincing motion</h2>
              <p className="mt-4 leading-7 text-white/50">
                The workflow keeps the destination distant while nearby scenery moves faster, helping the final shot feel like it was filmed from a real moving vehicle.
              </p>
            </div>
            <ul className="grid gap-3 text-sm text-white/64 sm:grid-cols-2">
              {["Realistic foreground motion blur", "Vehicle-specific framing", "Soft window reflections", "Atmospheric depth and haze", "One continuous camera move", "Vertical social composition"].map((item) => (
                <li key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-center text-3xl font-black tracking-[-0.035em]">Cartoon Drive-By FAQs</h2>
          <div className="mt-9 space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <summary className="cursor-pointer list-none pr-6 text-base font-bold marker:hidden">{item.q}</summary>
                <p className="mt-3 text-sm leading-6 text-white/50">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 pb-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200 mb-4">Guides</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/blog/cartoon-drive-by-explained" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-lime-300/30">
              <h3 className="text-base font-bold text-white">What Is a Cartoon Drive-By Video?</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">Why the format works and how to generate one.</p>
            </Link>
            <Link to="/blog/cartoon-drive-by-video-ideas" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-lime-300/30">
              <h3 className="text-base font-bold text-white">15 Cartoon Drive-By Video Ideas</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">Fifteen ready-to-use prompts across every vehicle viewpoint.</p>
            </Link>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-[1000px] rounded-[28px] border border-lime-200/15 bg-[linear-gradient(135deg,rgba(190,242,100,0.12),rgba(122,59,255,0.15))] px-6 py-12 text-center sm:px-10">
            <h2 className="text-3xl font-black tracking-[-0.035em]">Drive past a world you remember</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/52">Describe the destination, choose the vehicle and mood, then let Zyvo build and animate the shot.</p>
            <Link to="/workspace/cartoon-drive-by" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200">
              Open the Cartoon Drive-By Tool
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
