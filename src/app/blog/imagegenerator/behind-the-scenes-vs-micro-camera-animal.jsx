import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is the \"Behind the Scenes\" AI Video Trend?",
    description: "Why the format works and how to make your first episode.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-trend-explained",
  },
  {
    title: "Behind the Scenes vs Clay Rescue: Which Miniature AI Video Format Should You Try?",
    description: "Two formats built on the same scale-contrast trick, opposite endings.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-vs-clay-rescue",
  },
  {
    title: "Viral Animal Bodycam Videos: Why Tiny Creatures Are Taking Over TikTok",
    description: "What makes the micro-camera format so watchable, and how to make your own.",
    date: "16.08.2026",
    slug: "/blog/viral-animal-bodycam-videos",
  },
];

export default function BehindTheScenesVsMicroCameraAnimal() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Behind the Scenes</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Comparison
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Behind the Scenes vs Micro Camera Animal: Documentary-Style AI Video Compared
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Both formats build a video around scale and perspective. One puts a disaster next to a miniature model. The other shrinks the camera down to an insect's-eye view. The feeling they create is nothing alike.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 5 min read · Comparison</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/bts-vs-micro-camera-hero.png"
              alt="A giant realistic explosion hitting a handcrafted miniature city model with a full-size special-effects crew visible operating rigs for scale, practical movie-set style"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/blog-assets/bts-vs-micro-camera-scale.png"
              alt="An abstract glowing comparison of a massive building silhouette next to a tiny insect silhouette"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Both Are Built on Perspective Tricks</h2>
            <p className="text-[16px] leading-relaxed">
              Every video in both formats depends on making the viewer recalculate scale within the first second. That's the only thing they share — the direction each one takes the trick is completely different.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Behind the Scenes: A Disaster, Filmed Like It's Real</h2>
            <p className="text-[16px] leading-relaxed">
              A practical disaster — a wave, an eruption, a giant creature — hits a handcrafted miniature city while a full-size effects crew works the rig beside it, styled like leaked movie-set footage. The scale contrast is the miniature model against real-size humans.{" "}
              <Link to="/blog/behind-the-scenes-trend-explained" className="text-lime-200 hover:underline font-semibold">
                See how the format works
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Micro Camera Animal: A Bodycam on a Tiny Creature</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              Instead of showing something tiny next to something huge, this format shrinks the camera itself down to insect scale — following an ant, a beetle, a spider, or a mole through their actual environment as if it were wearing a bodycam. There's no crew, no rig, no visible production — it plays as pure documentary immersion rather than spectacle.
            </p>
            <Link to="/micro-camera-animal-maker" className="text-lime-200 hover:underline font-semibold text-[15px]">
              Explore Micro Camera Animal →
            </Link>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Which One Fits Your Niche</h2>
            <p className="text-[16px] leading-relaxed">
              If your audience responds to tension, destruction, and dramatic payoffs, Behind the Scenes lands harder. If they respond better to calm, immersive, nature-documentary curiosity, Micro Camera Animal is the better fit. Both run on the same underlying scale-contrast instinct, aimed at opposite moods.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try Either — or Both</h2>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Link
                to="/behind-the-scenes-video-maker"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
              >
                Explore Behind the Scenes
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/micro-camera-animal-maker"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-[14px] font-black text-white transition hover:bg-white/5"
              >
                Explore Micro Camera Animal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
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
