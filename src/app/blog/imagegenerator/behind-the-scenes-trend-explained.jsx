import { ArrowRight, Camera, Clapperboard, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Behind the Scenes vs Micro Camera Animal: Documentary-Style AI Video Compared",
    description: "Both formats build a video around scale and perspective, but the feeling they create is nothing alike.",
    date: "21.08.2026",
    slug: "/blog/behind-the-scenes-vs-micro-camera-animal",
  },
  {
    title: "How Long Does a Behind the Scenes Video Take to Make?",
    description: "From picking a disaster module to a finished 8-second clip with sound.",
    date: "21.08.2026",
    slug: "/blog/behind-the-scenes-time",
  },
  {
    title: "Why AI 'Movie Set' Miniature Disaster Videos Look So Real",
    description: "The scale-contrast trick, the locked style bible, and why practical framing sells the illusion.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-how-its-made",
  },
  {
    title: "18 Behind the Scenes AI Video Ideas You Can Generate Right Now",
    description: "Curated place-and-disaster combos across every module, ready to copy into the generator.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-video-ideas",
  },
  {
    title: "8 Behind the Scenes Disaster Types Explained",
    description: "What each disaster module feels like, and which places suit it best.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-disaster-types",
  },
  {
    title: "Behind the Scenes vs Clay Rescue: Which Miniature AI Video Format Should You Try?",
    description: "Same scale-contrast trick, opposite emotional arc — how to pick.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-vs-clay-rescue",
  },
];

const STEPS = [
  { icon: Sparkles, title: "Pick a place", text: "Describe the miniature city or town — anything from a neon harbor to a mountain village." },
  { icon: Clapperboard, title: "Pick a disaster", text: "Choose from 20 practical-effects modules, from giant waves to giant robots." },
  { icon: Camera, title: "Zyvo builds the shot", text: "A movie-set image generates first, then animates into an 8-second video with full sound." },
];

export default function BehindTheScenesTrendExplained() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Behind the Scenes</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            New Format
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            What Is the "Behind the Scenes" AI Video Trend?
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A giant wave crashes into a handcrafted miniature city. A crew in "SPECIAL EFFECTS" jackets works the rig beside it, dwarfed by the towering blue chroma wall. It looks like a leaked clip from a real blockbuster set — and it's entirely AI-generated.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 6 min read · Content Format</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-trend-explained-hero.png"
            alt="A practical smoke effect rising behind a miniature town model on a film soundstage with visible crew and camera cranes"
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
              The trend works because it borrows the visual language of something everyone already recognizes — a real film production's practical-effects reveal — and applies it to a place that could never actually be filmed that way. The contrast between a tiny, obsessively detailed miniature and a full-size human crew standing right next to it is what sells the scale, and scale is what makes people stop scrolling.
            </p>
            <p className="text-[16px] leading-relaxed">
              It also reads as more "real" than most AI content, precisely because it leans into visible imperfection: handheld camera shake, exposed cables, a slightly blown-out blue screen. Polish would actually undercut the illusion.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">What You Actually Get</h2>
            <p className="text-[16px] leading-relaxed">
              Each generation produces a photorealistic movie-set still first, then animates it into an 8-second video — always with sound, since crew chatter and practical set noise are core to the concept. Pick a place, pick one of 20 disaster modules, pick a camera vantage, and Zyvo assembles the rest.
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
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Not Real Footage</h2>
            <p className="text-[16px] leading-relaxed">
              Every image and video is AI-generated. It's not real footage from an actual production, and it isn't affiliated with any studio. The format is a parody of the practical-effects reveal shot — see exactly{" "}
              <Link to="/blog/behind-the-scenes-how-its-made" className="text-lime-200 hover:underline font-semibold">
                why it looks so convincing
              </Link>{" "}
              for the details.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try It Yourself</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick a place, pick a disaster, and let Zyvo build and animate the shot. Or browse{" "}
              <Link to="/blog/behind-the-scenes-video-ideas" className="text-lime-200 hover:underline font-semibold">
                18 ready-to-use episode ideas
              </Link>{" "}
              first.
            </p>
            <Link
              to="/behind-the-scenes-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Explore Behind the Scenes
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
