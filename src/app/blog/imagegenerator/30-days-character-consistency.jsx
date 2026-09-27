import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How 30 Days Series Mode Remembers Your Story",
    description: "World bible, persistent cast, and spoiler-gated planning explained.",
    date: "26.08.2026",
    slug: "/blog/30-days-series-world-bible-explained",
  },
  {
    title: "Why Every 30 Days Series Episode Flows as One Continuous Scene",
    description: "The continuity chain that makes each scene pick up exactly where the last one ended.",
    date: "28.08.2026",
    slug: "/blog/30-days-scene-continuity",
  },
  {
    title: "50 30 Days Universe Ideas: What World Should You Spend 30 Days In?",
    description: "Universe ideas to get you started.",
    date: "12.08.2026",
    slug: "/blog/30-days-universe-ideas",
  },
];

const PRINCIPLES = [
  { title: "Every recurring face gets a real reference photo", desc: "You, any named character, and any recurring creature or object each get one actual generated reference image — not just a text description — the moment they're introduced." },
  { title: "That photo gets reused, not redescribed", desc: "Every later scene that needs that character feeds its actual reference photo into the image generator alongside the scene prompt, so the model has something concrete to match instead of reinterpreting a description from scratch each time." },
  { title: "A shared reference can still be scoped to one scene", desc: "If several characters share one reference image (a cast photo, a group shot), the planner can mark exactly which of them belong in a given scene, so the others don't leak in when they shouldn't be there." },
  { title: "Drift usually means a scene skipped its reference", desc: "When a recurring character's design visibly changes between scenes, it's almost always because that scene's plan didn't actually carry the reference forward — not a random reinterpretation of an identical instruction." },
];

export default function ThirtyDaysCharacterConsistency() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-300">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">30 Days</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-200 mb-6">
            Mechanics
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            How 30 Days Keeps Your Characters Looking the Same in Every Scene
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            The thing that keeps a recurring character on-model isn't a longer text prompt — it's a real reference photo the image generator actually looks at.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 28, 2026 · 5 min read · Mechanics</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-character-consistency-hero.png"
            alt="A single glowing green rounded frame with a faint identical outline locked directly behind it"
            width={1200}
            height={896}
            className="aspect-[4/3] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-4 text-white/68">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <p className="text-[15px] font-bold text-white mb-1.5">{p.title}</p>
              <p className="text-[14px] leading-relaxed text-white/55">{p.desc}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why this matters more in a Series</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              In a single 30 Days video, references are generated once and reused across every scene in that one story — you'll never see yourself change outfits mid-video for no reason. In <Link to="/blog/what-is-30-days-series-mode" className="text-lime-300 hover:underline font-semibold">Series mode</Link>, the same idea extends across episodes: a companion you introduced in episode one is still the same reference in episode six, weeks of story later.
            </p>
            <p className="text-[16px] leading-relaxed mb-6">
              If a character does genuinely change — an outfit upgrade, an evolution, a scar from a fight — that's treated as a real story beat with its own moment on screen, not something that quietly happens between two unrelated scenes.
            </p>
            <Link
              to="/30-days-series-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Start a 30 Days Series
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
