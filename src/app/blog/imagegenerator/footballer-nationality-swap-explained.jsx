import { ArrowRight, IdCard, Mic, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "5 Tips for the Most Believable Footballer Nationality Swap Video",
    description: "Background style, expression, jersey contrast, and spoken-line length — five details that make the clip land.",
    date: "13.08.2026",
    slug: "/blog/footballer-nationality-swap-tips",
  },
  {
    title: "15 Footballer Nationality Swap Video Ideas You Can Try",
    description: "Fifteen structural concepts, from rival-nation swaps to full world-tour sequences.",
    date: "21.08.2026",
    slug: "/blog/footballer-nationality-swap-ideas",
  },
  {
    title: "10 Mistakes Killing Your Footballer Nationality Swap Video Views",
    description: "The structural choices that quietly hold results back, with a fix for each.",
    date: "21.08.2026",
    slug: "/blog/footballer-nationality-swap-mistakes",
  },
  {
    title: "AI Fruit Story vs Footballer Nationality Swap: Scripted Drama or One-Line Cameo?",
    description: "Both formats build content around a talking character, at opposite paces.",
    date: "21.08.2026",
    slug: "/blog/fruit-story-vs-footballer-nationality-swap",
  },
];

const STEPS = [
  {
    icon: Sparkles,
    title: "Name a footballer and a nationality",
    text: "Enter any footballer's name and choose the nation you want to picture them representing instead.",
  },
  {
    icon: IdCard,
    title: "Zyvo builds the media-day photo",
    text: "A photorealistic 'media day' portrait is generated in that nation's jersey, holding a name card with a localized name.",
  },
  {
    icon: Mic,
    title: "Animate the talking introduction",
    text: "The photo is animated into a short talking clip with lip-synced audio in the appropriate language and accent.",
  },
];

export default function FootballerNationalitySwapExplained() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-amber-200">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Nationality Swap</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-amber-200 mb-6">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            New Format
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            What Is Footballer Nationality Swap? (And How It Works)
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            A new football content format is spreading fast: a photorealistic "media day" clip that pictures a footballer representing a different nation entirely — new jersey, new name, a few words in a new language. Here's what makes it work and how to generate one.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 13, 2026 · 6 min read · Content Format</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/footballer-nationality-swap-explained-hero.png"
            alt="Close-up of hands holding a blank card while wearing a national-team football jersey in a stadium tunnel"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[19px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-10 text-white/68">

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why This Format Works</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              Football content lives on a very specific kind of surprise: a familiar face in an unfamiliar context. Nationality Swap delivers that in a single frame — a player everyone recognizes, dressed for a country they've never played for, introducing themselves like it's the most normal thing in the world.
            </p>
            <p className="text-[16px] leading-relaxed">
              It also borrows the exact visual language of a real media day: studio-quality lighting, a name card held at chest height, a blurred stadium tunnel behind them. That format familiarity is what sells the joke — it looks like it could almost be real, which is exactly the point of a good parody clip.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">What Actually Gets Generated</h2>
            <p className="text-[16px] leading-relaxed mb-4">
              Each scene produces two things: a still "media day" photo, and a 6-second animated clip built from it. The photo keeps the same face, build, and hairstyle while swapping in an authentic-looking national-team jersey and a name card with a localized version of the name. The video then animates that photo into a natural talking introduction, with lip-synced audio delivered in the appropriate language and accent for the chosen nation.
            </p>
            <p className="text-[16px] leading-relaxed">
              You can generate 3 to 5 scenes in one run and stitch them into a single continuous video — useful for a short "world tour" format cycling through several nations.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">How to Generate One in Zyvo</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/10 text-amber-200">
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
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">It's Entertainment, Not Endorsement</h2>
            <p className="text-[16px] leading-relaxed">
              Nationality Swap generates original, fan-made AI content for entertainment purposes only. It is not affiliated with, endorsed by, or produced in partnership with any footballer, club, or national football federation — the format is a parody of the media-day photo op, not a claim about anyone's actual nationality or team.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Try It Yourself</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Name a player, pick a nation, and let Zyvo build and animate the introduction.
            </p>
            <Link
              to="/workspace/footballer-nationality-swap"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-7 py-3.5 text-[14px] font-black text-[#150F02] transition hover:bg-amber-200"
            >
              Create a Nationality Swap
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
