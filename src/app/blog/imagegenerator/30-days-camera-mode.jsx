import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "How 30 Days Keeps Your Characters Looking the Same in Every Scene",
    description: "The persistent reference system explained, and why a caught companion shouldn't randomly change design.",
    date: "28.08.2026",
    slug: "/blog/30-days-character-consistency",
  },
  {
    title: "Why Every 30 Days Series Episode Flows as One Continuous Scene",
    description: "The continuity chain that makes each scene pick up exactly where the last one ended.",
    date: "28.08.2026",
    slug: "/blog/30-days-scene-continuity",
  },
  {
    title: "How to Write a Viral 30 Days Premise (Formula + Examples)",
    description: "The premise structure that gives the planner enough to work with.",
    date: "26.08.2026",
    slug: "/blog/30-days-premise-formula",
  },
];

const PRINCIPLES = [
  { title: "You don't pick it from a menu — the planner decides", desc: "There's no first-person/third-person toggle in the builder. Every generation is planned by AI first, and picking the camera mode is one of its first decisions, based on what your premise actually needs." },
  { title: "First-person leans into immersion", desc: "If the planner goes first-person, every scene is strict POV — your own hands and body only, never seeing yourself from outside. It's built for premises where being IN the moment matters more than seeing your character react to it." },
  { title: "Third-person leans into presence", desc: "This is the default, and it's what gets picked whenever your character's appearance, outfit, companions, or relationships are part of the story — you can't show a caught creature bonding with you if the camera never shows you." },
  { title: "Third-person doesn't mean one repeated shot", desc: "Inside a 30 Days Series episode, the planner deliberately mixes shot types scene to scene — wide action, over-the-shoulder, close-up, tracking — with true POV used only occasionally for impact, so seven scenes don't read as the same camera setup seven times." },
];

export default function ThirtyDaysCameraMode() {
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
            Craft
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            First-Person or Third-Person? How 30 Days Decides Your Story's Camera Angle
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            There's no camera setting to fiddle with — the planner reads your premise and picks the angle that actually serves the story, then varies the shots inside it so nothing repeats.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 28, 2026 · 4 min read · Craft</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/30-days-camera-mode-hero.png"
            alt="Two overlapping glowing green viewfinder frames floating in dark space, one offset behind the other"
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
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">How to nudge it toward what you want</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              You can't force a camera mode directly, but your premise is the actual input the planner reasons from. A premise built around a physical threat closing in on you tends to read as a first-person moment. A premise built around a relationship, a transformation, or a companion tends to read as third-person, because the story needs to actually see you in it.
            </p>
            <p className="text-[16px] leading-relaxed mb-6">
              If your <Link to="/blog/30-days-premise-formula" className="text-lime-300 hover:underline font-semibold">premise is specific about what changes and who's affected</Link>, the planner has more to work with when it makes that call — for both a single video and every episode of a Series.
            </p>
            <Link
              to="/30-days-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-7 py-3.5 text-[14px] font-black text-[#111509] transition hover:bg-lime-200"
            >
              Start a 30 Days story
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
