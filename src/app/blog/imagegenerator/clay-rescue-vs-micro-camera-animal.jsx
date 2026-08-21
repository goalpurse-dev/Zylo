import { ArrowRight } from "lucide-react";
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
    title: "What Is Micro Camera Animal? The Viral Insect's-Eye-View AI Trend",
    description: "A tiny research-style camera follows a real animal's POV through its own underground world.",
    date: "20.08.2026",
    slug: "/blog/what-is-micro-camera-animal",
  },
  {
    title: "Every Zyvo AI Video Format Compared: Which One Should You Try Next?",
    description: "Six format-specific AI video tools, side by side.",
    date: "21.08.2026",
    slug: "/blog/every-zyvo-video-format-compared",
  },
];

export default function ClayRescueVsMicroCameraAnimal() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Comparison</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Comparison
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Clay Rescue vs Micro Camera Animal: Wholesome Rescue or Quiet Documentary?
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Both formats work in miniature. One is a gentle problem-solving story with a giant hand as the hero. The other has no hero at all — just quiet curiosity about a hidden world.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 5 min read · Comparison</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/clay-rescue-vs-micro-camera-hero.png"
            alt="A split image: a giant hand reaching toward tiny clay figures on the left, a small research camera resting on soil beside an ant on the right"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Clay Rescue: A Hero, a Crisis, a Fix</h2>
            <p className="text-[16px] leading-relaxed">
              A tiny claymation disaster hits, and a giant realistic hand solves it indirectly with a simple tool — never touching the clay people directly. The arc is crisis, fix, celebration, every time.{" "}
              <Link to="/blog/what-is-clay-rescue" className="text-lime-200 hover:underline font-semibold">See how the format works</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Micro Camera Animal: No Hero, Just Curiosity</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              A tiny research-style camera follows a real animal's POV through its own hidden underground world — no crisis, no rescue, no narrative arc at all. The appeal is pure documentary curiosity about a scale of the world most people never see.
            </p>
            <Link to="/micro-camera-animal-maker" className="text-lime-200 hover:underline font-semibold text-[15px]">
              Explore Micro Camera Animal →
            </Link>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Which One Fits Your Niche</h2>
            <p className="text-[16px] leading-relaxed">
              If your audience likes a satisfying story with a clear payoff, Clay Rescue lands harder. If they respond better to calm, exploratory curiosity, Micro Camera Animal fits better. Both are built around the same small-scale visual world, just pointed at opposite kinds of satisfaction.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try Either — or Both</h2>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Link
                to="/clay-rescue-maker"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
              >
                Explore Clay Rescue
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
