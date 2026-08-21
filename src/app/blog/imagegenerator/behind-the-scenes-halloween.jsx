import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "8 Behind the Scenes Disaster Types Explained",
    description: "What each of the eight original disaster modules feels like, and which places suit each one best.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-disaster-types",
  },
  {
    title: "12 Extended Behind the Scenes Modules: Kaiju, Robots, and Full Movie-Shoot Chaos",
    description: "Beyond the 8 elemental disasters — giant creatures, aircraft chases, and more.",
    date: "16.08.2026",
    slug: "/blog/behind-the-scenes-extended-modules",
  },
  {
    title: "2AM Worlds Halloween Special: 10 Spooky World Ideas",
    description: "Ten Halloween-themed 2AM World ideas, ready to generate.",
    date: "21.08.2026",
    slug: "/blog/2am-worlds-halloween-special",
  },
];

const IDEAS = [
  { title: "The fog-shrouded kaiju reveal", desc: "A giant monster silhouette looms out of thick fog over a miniature haunted town — the reveal does the work, no full creature shot needed at first." },
  { title: "The haunted house set collapse", desc: "A miniature Victorian haunted house crumbles as something unseen moves inside it, crew visible working the rig just off to the side." },
  { title: "The graveyard fog rollout", desc: "Fog machines flood a miniature cemetery set as the crew adjusts lighting for an eerie low-visibility shot." },
  { title: "The jack-o'-lantern street disaster", desc: "A miniature Halloween street lined with glowing pumpkins gets hit by something oversized — the warm pumpkin light against the chaos is the visual hook." },
  { title: "The werewolf transformation set piece", desc: "A miniature town square set dressed for a werewolf reveal, practical fog and orange lighting, crew adjusting a rig just out of frame." },
  { title: "The corn maze creature chase", desc: "A miniature corn maze at night with something large moving through the rows, crew tracking the shot with a handheld rig." },
  { title: "The abandoned carnival collapse", desc: "A miniature Ferris wheel and carnival set partially collapsing under something unseen, string lights flickering." },
  { title: "The witching-hour storm set", desc: "A miniature village hit by an unnatural purple-lit storm at midnight, crew working under umbrellas and rain rigs." },
  { title: "The pumpkin patch monster emergence", desc: "Something enormous rises out of a miniature pumpkin patch set as the crew scrambles to reposition cameras." },
  { title: "The haunted lighthouse beam", desc: "A miniature lighthouse set sweeps its beam across fog to briefly reveal something massive standing offshore." },
];

export default function BehindTheScenesHalloween() {
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
            Seasonal
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            Behind the Scenes Halloween Special: 10 Horror Movie-Set Disaster Ideas
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            The miniature-model-plus-crew trick was already built for spectacle. Fog, jack-o'-lanterns, and a fog-shrouded monster silhouette push it fully into horror-movie-set territory.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 21, 2026 · 6 min read · Seasonal</p>
        </header>

        <figure className="mb-16 overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <img
            src="/blog-assets/behind-the-scenes-halloween-hero.png"
            alt="A miniature haunted movie-set town at night with a fog-shrouded monster silhouette looming over it and a special-effects crew operating rigs nearby"
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
              Every idea below still follows the format's core rule: a full-size crew visibly working the rig, framed like leaked movie-set footage — the horror elements are set dressing, not a departure from the format.
            </p>
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {IDEAS.map((idea, i) => (
                <div key={idea.title} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-black text-white/25">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-[14px] font-bold text-white">{idea.title}</p>
                  </div>
                  <p className="text-[13px] text-white/55 leading-relaxed">{idea.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Generate Your Halloween Special</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Pick an idea above and generate it in Zyvo's Behind the Scenes maker. For the full disaster catalog, see{" "}
              <Link to="/blog/behind-the-scenes-extended-modules" className="text-lime-200 hover:underline font-semibold">all 12 extended modules</Link>.
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
