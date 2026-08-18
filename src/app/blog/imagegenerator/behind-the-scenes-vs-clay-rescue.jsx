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
    title: "10 Mistakes Killing Your Behind the Scenes Video Views",
    description: "The ten most common structural mistakes, with a fix for each.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-mistakes",
  },
];

export default function BehindTheScenesVsClayRescue() {
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
            Behind the Scenes vs Clay Rescue: Which Miniature AI Video Format Should You Try?
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Both Zyvo formats build a video around a tiny miniature and something oversized standing next to it. The similarity ends there — they're built for opposite moods and opposite endings.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 16, 2026 · 5 min read · Comparison</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-vs-clay-rescue-hero.png"
            alt="A wire-rigged miniature helicopter flown on practical cables sweeping over a miniature town model on a film soundstage"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">The Shared Trick: Scale Contrast</h2>
            <p className="text-[16px] leading-relaxed">
              Both formats work for the same underlying reason — putting something enormous right next to something tiny is one of the most reliable visual hooks there is. That's where the similarity stops. What happens next in each format is almost the opposite of the other.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Behind the Scenes: Destruction, Filmed Like It's Real</h2>
            <p className="text-[16px] leading-relaxed">
              A practical disaster — a wave, an eruption, a giant creature — hits a handcrafted miniature city while a full-size effects crew works the rig beside it. The video is styled to look like leaked movie-set footage: visible cables, an amateur handheld frame, real sound design. The arc is destruction, and the payoff is the impact itself.{" "}
              <Link to="/blog/behind-the-scenes-trend-explained" className="text-lime-200 hover:underline font-semibold">
                See how the format works
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Clay Rescue: A Tiny Disaster, and a Rescue</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              Clay Rescue flips the arc. It starts with a small clay-world disaster, then a giant hand reaches in to fix it — the payoff is resolution and relief, not impact. It's a satisfying, feel-good format built for high rewatch value rather than shock.
            </p>
            <Link to="/clay-rescue-maker" className="text-lime-200 hover:underline font-semibold text-[15px]">
              Explore Clay Rescue →
            </Link>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Which One Fits Your Niche</h2>
            <p className="text-[16px] leading-relaxed">
              If your audience responds to tension, scale, and dramatic payoffs, start with Behind the Scenes. If they respond better to satisfying, wholesome resolutions, Clay Rescue will land harder. Plenty of creators run both — the two formats don't compete for the same view, they cover different moods in the same feed.
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
                to="/clay-rescue-maker"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-[14px] font-black text-white transition hover:bg-white/5"
              >
                Explore Clay Rescue
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
