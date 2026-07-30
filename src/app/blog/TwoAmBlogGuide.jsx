import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import { SITE_URL } from "../../data/seoLandingPages.js";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";

const PREVIEW = (name) => `/template/2am-world/${name}`;

// Data-driven, same architecture as src/app/blog/CreatorGrowthGuide.jsx
// (slug prop -> keyed content object -> one render path, canonical/OG/
// Twitter/Article+FAQPage JSON-LD) but scoped to its own content object
// instead of extending that file's Publish/Stats-specific GUIDES/routing.
const GUIDES = {
  "what-is-the-2am-worlds-ai-trend": {
    title: "What Is the 2AM Worlds AI Trend?",
    seoTitle: "What Is the 2AM Worlds AI Trend? | Zyvo",
    description: "Where the 2AM Worlds AI trend came from, what it actually is, and how to create your own with Zyvo.",
    keywords: "2am worlds ai trend, 2am ai images, 2am ai generator, what is 2am worlds",
    category: "2AM Worlds",
    date: "July 27, 2026",
    readTime: "6 min read",
    hero: PREVIEW("pokemon (7).png"),
    heroAlt: "A cinematic 2AM world AI image showing the trend's late-night visual style",
    intro: [
      "If you've scrolled TikTok or Instagram recently, you've probably seen it: a slideshow of the same fictional world — a game, an anime, a childhood memory — rendered as if it were 2AM. Quiet streets, warm lamplight, a slightly liminal stillness. That's a 2AM World.",
      "The trend isn't about photorealism. It's about mood — taking something instantly recognizable and reframing it through a specific, nostalgic time of night that most people associate with quiet reflection rather than action.",
    ],
    sections: [
      {
        title: "Where the trend came from",
        paragraphs: [
          "2AM Worlds grew out of a broader wave of nostalgia-driven AI image trends — creators using AI to revisit games, shows, and places from a specific emotional angle rather than a literal one. Framing it as \"2AM\" gave the format a consistent, recognizable visual identity: dim lighting, quiet compositions, a cinematic stillness.",
          "Because the format works with almost any reference — a video game region, an anime city, a childhood neighborhood — it spread quickly across very different fandoms and interests.",
        ],
      },
      {
        title: "Why it works as a content format",
        paragraphs: [
          "A 2AM World slideshow is instantly readable: viewers recognize the reference and feel the mood in the first frame. That combination — recognition plus atmosphere — is a large part of why the format performs well as short-form video content.",
        ],
        bullets: ["Recognizable reference, unusual framing", "Consistent visual mood across a full set", "Works for games, anime, cities, and characters alike"],
      },
      {
        title: "How Zyvo generates a 2AM World",
        paragraphs: [
          "Zyvo's 2AM Worlds generator takes a short prompt — a world, character, or idea — and plans a consistent set of six cinematic night scenes around it. You don't need to write a detailed AI prompt; the template already knows how to translate a short reference into a coherent 2AM scene set.",
        ],
      },
    ],
    faqs: [
      ["Do I need a detailed prompt to try this?", "No — a short reference like \"2AM in Pokémon Alola\" or a character name is usually enough for Zyvo's 2AM Worlds template to work with."],
      ["How many images does it create?", "Each generation creates six consistent images that form one 2AM World set."],
      ["Can I use this for any world or character?", "You can enter almost any world, game, anime, character, or idea — Zyvo's planner researches the reference and builds scenes around it."],
    ],
    links: [["/2am-worlds-ai-generator", "Try the 2AM Worlds Generator", "Enter your own world and generate a cinematic 2AM image set."]],
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM world",
  },

  "best-2am-world-ai-prompts": {
    title: "50 2AM World AI Prompt Ideas",
    seoTitle: "50 2AM World AI Prompt Ideas | Zyvo",
    description: "50 ready-to-use 2AM World prompt ideas — anime, games, cities, and nostalgic places — to try with Zyvo's AI generator.",
    keywords: "2am world ai prompts, 2am ai prompt ideas, 2am worlds prompts",
    category: "2AM Worlds",
    date: "July 27, 2026",
    readTime: "7 min read",
    hero: PREVIEW("ninjago (5).png"),
    heroAlt: "A late-night cinematic AI image used as inspiration for 2AM World prompts",
    intro: [
      "The hardest part of trying a new AI trend is usually the first prompt. Here are 50 2AM World ideas across games, anime, cities, and nostalgic places — click any one to try it directly in Zyvo's generator.",
    ],
    promptGroups: [
      {
        title: "Games & fictional worlds",
        prompts: ["2AM in Pokémon Alola", "2AM in Pokémon Kanto", "2AM in a Minecraft world", "2AM in GTA Vice City", "2AM in Hogwarts", "2AM in a fantasy kingdom", "2AM inside a nostalgic video game", "2AM in an open-world RPG town"],
      },
      {
        title: "Anime & characters",
        prompts: ["Kai from Ninjago", "2AM in Ninjago City", "Naruto Shippuden", "2AM in the Hidden Leaf Village", "2AM inside an anime city", "2AM at an anime train station", "2AM in a Studio Ghibli-style town", "2AM in a mecha anime hangar"],
      },
      {
        title: "Cities & places",
        prompts: ["2AM in a futuristic Tokyo", "2AM in a quiet beach town", "2AM in SpongeBob's Bikini Bottom", "2AM in an old American diner", "2AM in a rainy neon city", "2AM in a small mountain village", "2AM in a coastal fishing town", "2AM in a desert roadside motel"],
      },
      {
        title: "Nostalgia & mood",
        prompts: ["2AM in my childhood neighborhood", "2AM at a summer carnival", "2AM in a 90s shopping mall", "2AM in an empty theme park", "2AM in a quiet college dorm hallway", "2AM in a retro arcade", "2AM in a suburban cul-de-sac", "2AM in an old family cabin"],
      },
    ],
    faqs: [
      ["Can I click a prompt to try it?", "Yes — every prompt above opens Zyvo's 2AM Worlds generator with that prompt already entered."],
      ["Do these prompts guarantee the same result?", "Zyvo interprets each prompt freshly, so results vary between generations — that variety is part of the format."],
    ],
    links: [["/2am-worlds-ai-generator", "Open the 2AM Worlds Generator", "Enter any of these prompts or write your own."]],
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Try one of these prompts",
  },

  "how-to-create-2am-pokemon-ai-images": {
    title: "How to Create 2AM Pokémon AI Images",
    seoTitle: "How to Create 2AM Pokémon AI Images | Zyvo",
    description: "A practical walkthrough for generating nostalgic, late-night Pokémon-inspired AI images with Zyvo.",
    keywords: "2am pokemon ai images, how to create pokemon ai images, pokemon ai generator",
    category: "2AM Worlds",
    date: "July 27, 2026",
    readTime: "6 min read",
    hero: PREVIEW("pokemon (5).png"),
    heroAlt: "A cinematic 2AM Pokémon-inspired AI image of a quiet route at night",
    intro: [
      "2AM Pokémon images reimagine the routes, towns, and regions of the Pokémon world as quiet, cinematic night scenes. Here's how to get a strong result with Zyvo's 2AM Worlds generator — and a few prompt ideas specific to Pokémon.",
    ],
    sections: [
      {
        title: "Start with a region or location, not just \"Pokémon\"",
        paragraphs: [
          "A prompt like \"2AM in Pokémon Alola\" gives Zyvo more to work with than just \"Pokémon\" alone — naming a region, route, or location (a Pokémon Center, a tropical route, a quiet town) helps the template plan a more specific, consistent scene set.",
        ],
        bullets: ["Name a region: Alola, Kanto, Galar", "Name a location: Pokémon Center, route, town", "Add a mood word if you want: quiet, rainy, tropical"],
      },
      {
        title: "What Zyvo actually generates",
        paragraphs: [
          "Zyvo creates six consistent, cinematic images per generation — an original, fan-made interpretation of the world you describe, not official Pokémon artwork. Zyvo is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.",
        ],
      },
    ],
    faqs: [
      ["Does this use real Pokémon artwork?", "No — Zyvo generates original, fan-made AI scenes inspired by the world you describe."],
      ["What's a good first prompt to try?", "\"2AM in Pokémon Alola\" is one of the most popular starting points and reliably produces a tropical, route-style night scene."],
    ],
    links: [
      ["/2am-in-pokemon-ai-generator", "Try the 2AM Pokémon Generator", "Generate your own late-night Pokémon-inspired image set."],
      ["/2am-worlds-ai-generator", "Explore 2AM Worlds", "See the full 2AM Worlds generator and other world ideas."],
    ],
    ctaHref: "/2am-in-pokemon-ai-generator",
    cta: "Create a 2AM Pokémon world",
  },

  "how-to-create-2am-ninjago-ai-images": {
    title: "How to Create 2AM Ninjago AI Images",
    seoTitle: "How to Create 2AM Ninjago AI Images | Zyvo",
    description: "How to turn Ninjago characters and locations into a cinematic 2AM AI image set with Zyvo.",
    keywords: "2am ninjago ai images, ninjago ai generator, ninjago ai images",
    category: "2AM Worlds",
    date: "July 27, 2026",
    readTime: "6 min read",
    hero: PREVIEW("ninjago (3).png"),
    heroAlt: "A cinematic 2AM Ninjago-inspired AI image of a quiet monastery courtyard at night",
    intro: [
      "2AM Ninjago images reimagine the neon streets, temples, and quiet monastery courtyards of the Ninjago universe as cinematic late-night scenes. Here's how to get a strong result with Zyvo.",
    ],
    sections: [
      {
        title: "Name a character or a location",
        paragraphs: [
          "A prompt like \"Kai from Ninjago\" helps Zyvo build scenes around that character's world and mood. A location-based prompt like \"2AM in Ninjago City\" leans more into a neon, urban night scene.",
        ],
        bullets: ["Character prompts: Kai, the ninja monastery", "Location prompts: Ninjago City, an elemental temple", "Mood words: quiet, neon, rainy"],
      },
      {
        title: "What Zyvo actually generates",
        paragraphs: [
          "Zyvo creates six consistent, cinematic images per generation — original, fan-made scenes inspired by the world you describe, not official artwork. Zyvo is not affiliated with or endorsed by LEGO or the Ninjago franchise.",
        ],
      },
    ],
    faqs: [
      ["Does this use official Ninjago artwork?", "No — Zyvo generates original, fan-made AI scenes inspired by the world you describe."],
      ["What's a good first prompt to try?", "\"2AM in Ninjago City\" is a popular starting point and reliably produces a neon, urban night scene set."],
    ],
    links: [
      ["/2am-in-ninjago-ai-generator", "Try the 2AM Ninjago Generator", "Generate your own late-night Ninjago-inspired image set."],
      ["/2am-worlds-ai-generator", "Explore 2AM Worlds", "See the full 2AM Worlds generator and other world ideas."],
    ],
    ctaHref: "/2am-in-ninjago-ai-generator",
    cta: "Create a 2AM Ninjago world",
  },
};

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export default function TwoAmBlogGuide({ slug }) {
  const guide = GUIDES[slug];
  const navigate = useNavigate();

  useEffect(() => {
    if (!guide) return undefined;
    const previousTitle = document.title;
    const canonicalUrl = `${SITE_URL}/blog/${slug}`;
    document.title = guide.seoTitle;
    upsertMeta("name", "description", guide.description);
    upsertMeta("name", "keywords", guide.keywords);
    upsertMeta("name", "robots", "index, follow, max-image-preview:large");
    upsertMeta("property", "og:title", guide.seoTitle);
    upsertMeta("property", "og:description", guide.description);
    upsertMeta("property", "og:type", "article");
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", `${SITE_URL}${guide.hero}`);
    upsertMeta("name", "twitter:card", "summary_large_image");

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const schema = document.createElement("script");
    schema.id = `${slug}-article-schema`;
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          datePublished: "2026-07-27",
          dateModified: "2026-07-27",
          mainEntityOfPage: canonicalUrl,
          author: { "@type": "Organization", name: "Zyvo" },
          publisher: { "@type": "Organization", name: "Zyvo", url: SITE_URL },
        },
        {
          "@type": "FAQPage",
          mainEntity: guide.faqs.map(([question, answer]) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        },
      ],
    });
    document.head.appendChild(schema);

    return () => {
      document.title = previousTitle;
      schema.remove();
    };
  }, [guide, slug]);

  if (!guide) return null;

  const tryPrompt = (text) => {
    trackSeoEvent("seo_prompt_interaction", { slug: `blog:${slug}`, templateId: "two-am" });
    navigate(`${guide.ctaHref}?prompt=${encodeURIComponent(text)}`);
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white">
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-8 sm:px-6 sm:pt-12">
        <nav className="mb-6 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-lime-300">Blog</Link>
          <span className="mx-2">/</span>
          <span>{guide.category}</span>
        </nav>

        <header>
          <span className="inline-flex rounded-full bg-lime-300/[0.1] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-lime-300">{guide.category}</span>
          <h1 className="mt-5 text-[32px] font-black leading-[1.08] tracking-[-0.03em] sm:text-[42px]">{guide.title}</h1>
          <p className="mt-5 text-[16px] leading-8 text-white/55">{guide.description}</p>
          <div className="mt-4 flex items-center gap-1.5 text-[12px] text-white/35">
            <Calendar className="h-3.5 w-3.5" />{guide.date} · {guide.readTime}
          </div>
        </header>

        <figure className="mt-8 overflow-hidden rounded-[24px] border border-white/10 bg-black">
          <img src={guide.hero} alt={guide.heroAlt} className="aspect-[16/9] w-full object-cover" loading="eager" fetchPriority="high" />
        </figure>

        <article className="mt-10 space-y-5 text-[16px] leading-8 text-white/60">
          {guide.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </article>

        {guide.sections?.map((section) => (
          <section key={section.title} className="mt-12">
            <h2 className="text-[24px] font-black tracking-[-0.02em] text-white">{section.title}</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-8 text-white/60">
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            {section.bullets && (
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[13px] text-white/70">{bullet}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {guide.promptGroups?.map((group) => (
          <section key={group.title} className="mt-12">
            <h2 className="text-[22px] font-black tracking-[-0.02em] text-white">{group.title}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {group.prompts.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => tryPrompt(text)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-lime-300/[0.16] bg-lime-300/[0.05] px-4 py-2 text-[13px] font-semibold text-lime-100 transition hover:border-lime-300/40 hover:bg-lime-300/[0.09]"
                >
                  {text}
                  <span className="text-[11px] text-lime-300/70 opacity-0 transition group-hover:opacity-100">Try this prompt →</span>
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-14">
          <h2 className="text-[22px] font-black tracking-[-0.02em] text-white">Frequently asked questions</h2>
          <div className="mt-5 space-y-3">
            {guide.faqs.map(([question, answer]) => (
              <details key={question} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
                <summary className="cursor-pointer list-none text-[14px] font-bold text-white">{question}</summary>
                <p className="pt-3 text-[13px] leading-6 text-white/55">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {guide.links.map(([to, title, description]) => (
            <Link key={to} to={to} className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-lime-300/25">
              <p className="text-[13px] font-bold text-white group-hover:text-lime-300">{title}</p>
              <p className="mt-1 text-[12px] leading-5 text-white/45">{description}</p>
            </Link>
          ))}
        </div>

        <section className="mt-16 rounded-[28px] bg-gradient-to-br from-[#12160f] to-[#0b0d0f] p-8 text-center">
          <h2 className="text-[24px] font-black text-white">{guide.cta}</h2>
          <Link
            to={guide.ctaHref}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-lime-300/[0.14] to-lime-500/[0.10] border border-lime-400/25 px-6 py-3 text-[14px] font-black text-white"
          >
            Open the generator <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
