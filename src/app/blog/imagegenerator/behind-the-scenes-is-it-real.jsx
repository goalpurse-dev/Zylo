import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "Why AI \"Movie Set\" Miniature Disaster Videos Look So Real",
    description: "The scale-contrast trick, the locked style bible, and why practical framing sells the illusion.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-how-its-made",
  },
  {
    title: "Why \"Imperfect\" AI Videos Are Beating Polished Content Right Now",
    description: "The authenticity trick behind the biggest AI video formats of 2026.",
    date: "16.08.2026",
    slug: "/blog/imperfect-ai-videos-winning",
  },
  {
    title: "What Is the \"Behind the Scenes\" AI Video Trend?",
    description: "Why the format works and how to make your first episode.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-trend-explained",
  },
];

const SIGNALS = [
  { title: "Real footage doesn't stay this consistent", desc: "Genuine behind-the-scenes footage varies in lighting, framing, and quality between clips. AI-generated sets lock a consistent style bible across every scene — which is a giveaway once you know to look for it." },
  { title: "The scale is a little too perfect", desc: "Real miniature models have visible seams, dust, and imperfect proportions. AI-generated miniatures tend to look slightly too clean and geometrically precise." },
  { title: "The crew is doing generically plausible things", desc: "Real film crews are doing specific, technical tasks tied to an actual shoot. AI-generated crew members are performing gesture — holding equipment, gesturing at the set — without a specific technical purpose." },
  { title: "It's intentionally styled to be ambiguous", desc: "The format is deliberately built to sit right at the edge of believable — that ambiguity, not a deception, is the actual source of its appeal." },
];

export default function BehindTheScenesIsItReal() {
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
            Explained
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Is Behind the Scenes Real? How AI Movie-Set Videos Fool Millions of Viewers
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            None of it is real footage — every image and video is AI-generated. Here's exactly why it convinces so many people anyway, and the tells that give it away.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 6 min read · Explained</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-is-it-real-hero.png"
            alt="A close-up of a director's hand adjusting a small building on a miniature movie-set city model with blurred crew in the background"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <p className="text-[16px] leading-relaxed">
              To be direct: Behind the Scenes generates original, fan-made AI content styled to look like practical-effects filmmaking. It's not real footage, and it isn't affiliated with any studio or production. What's genuinely interesting is why it still convinces so many viewers at a glance.
            </p>
          </section>

          <section>
            <div className="space-y-4">
              {SIGNALS.map((s) => (
                <div key={s.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                  <p className="text-[15px] font-bold text-white mb-1.5">{s.title}</p>
                  <p className="text-[14px] text-white/55 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[24px] font-black text-white mb-4 tracking-[-0.01em]">Why the ambiguity is the actual appeal</h2>
            <p className="text-[16px] leading-relaxed">
              A video that's obviously fake doesn't hold attention the same way one does that makes a viewer pause and genuinely wonder. See{" "}
              <Link to="/blog/imperfect-ai-videos-winning" className="text-lime-200 hover:underline font-semibold">why imperfect AI videos are winning</Link>{" "}
              for the broader pattern behind this across every viral AI format right now.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">See How It's Actually Made</h2>
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
