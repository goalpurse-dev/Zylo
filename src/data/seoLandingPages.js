// Single source of truth for the 2AM Worlds SEO landing-page cluster.
// Adding page #4+ should mostly mean adding an entry here, not new components.
// `published: false` entries keep a config shell ready for later without a
// wired route, noindex meta, or a sitemap/BlogIndex entry.

export const SITE_URL = "https://www.tryzyvo.com";

const ASSET_BASE = "/template/2am-world";
const previewOf = (name) => `${ASSET_BASE}/${name}`;

const HUB_SLUG = "2am-worlds-ai-generator";

export const seoLandingPages = [
  {
    slug: HUB_SLUG,
    templateId: "two-am",
    published: true,
    parentSlug: null,
    seo: {
      title: "2AM Worlds AI Generator – Create Viral 2AM AI Images | Zyvo",
      description:
        "Create nostalgic 2AM worlds with AI. Enter any universe, character, game or anime and generate cinematic late-night images with Zyvo.",
      primaryKeyword: "2am worlds ai generator",
      secondaryKeywords: ["2am ai generator", "2am world ai", "2am ai images", "nostalgia ai image generator"],
      ogImage: previewOf("pokemon (7).png"),
    },
    hero: {
      eyebrow: "Viral AI Template",
      heading: "Create Your Own 2AM World",
      description:
        "Enter any world, anime, game, character or idea. Zyvo transforms it into a cinematic late-night world and creates a complete set of 2AM images.",
      promptPlaceholder: 'Try "2AM in Pokémon Alola..."',
    },
    assets: {
      hero: previewOf("pokemon (7).png"),
      previews: [
        previewOf("pokemon (2).png"),
        previewOf("ninjago (1).png"),
        previewOf("pokemon (5).png"),
        previewOf("ninjago (4).png"),
        previewOf("pokemon (7).png"),
        previewOf("ninjago (7).png"),
      ],
    },
    examplePrompts: [
      "2AM in Pokémon Alola",
      "Kai from Ninjago",
      "Naruto Shippuden",
      "2AM inside an anime city",
      "Hogwarts",
      "SpongeBob Bikini Bottom",
      "2AM in a quiet beach town",
      "GTA Vice City",
    ],
    sections: {
      intro:
        "A 2AM world is a nostalgic, atmospheric recreation of a place you already know — a game, an anime, a childhood memory, a fictional city — reimagined as if it were 2AM: quiet, cinematic, a little liminal, lit like a late-night memory instead of a daytime screenshot. The trend took off because it turns any reference, however specific, into a moody visual set that feels personal rather than generic. Zyvo's 2AM Worlds generator takes a short prompt — a world, a character, a series, even just a vibe — and researches enough of that reference to build six consistent, cinematic 2AM images around it. You don't need to write a detailed AI prompt or understand image-generation styles; the template already knows how to translate \"Pokémon Alola\" or \"Hogwarts\" into a coherent nighttime scene set. It's built for creators who want a finished, postable slideshow in minutes, not a prompt-engineering project.",
      howItWorks: [
        {
          title: "Enter your world",
          description: "Anime, games, characters, cities, or fictional universes — type any reference you want reimagined at 2AM.",
        },
        {
          title: "Zyvo understands the reference",
          description: "The 2AM Worlds template interprets the world or style you named and plans a consistent set of night scenes around it.",
        },
        {
          title: "Generate six images",
          description: "Zyvo creates a cinematic, consistent 2AM image set — ready to download or post as a slideshow.",
        },
      ],
      faq: [
        {
          q: "What is a 2AM World AI image?",
          a: "It's a cinematic, nostalgic recreation of a world, character, or place — styled as if you were experiencing it at 2AM. Zyvo generates a set of six consistent images per world.",
        },
        {
          q: "Can I enter any world?",
          a: "You can enter almost any world, game, anime, character, city, or idea. Zyvo's planner researches the reference and builds scenes around it; some very obscure or ambiguous references may produce a more general interpretation.",
        },
        {
          q: "How many images does Zyvo create?",
          a: "Each 2AM Worlds generation creates six images that form one consistent set.",
        },
        {
          q: "Can I use characters in my 2AM world?",
          a: "Yes — naming a specific character (like \"Kai from Ninjago\") helps Zyvo build scenes around that character's world and mood.",
        },
        {
          q: "Do I need to write a detailed AI prompt?",
          a: "No. The 2AM Worlds template handles most of the prompt engineering — a short reference is usually enough to get a strong result.",
        },
      ],
    },
    relatedLandingPages: ["2am-in-pokemon-ai-generator", "2am-in-ninjago-ai-generator"],
    relatedBlogPosts: [
      "what-is-the-2am-worlds-ai-trend",
      "best-2am-world-ai-prompts",
      "how-to-create-2am-pokemon-ai-images",
    ],
    breadcrumb: [{ label: "Home", to: "/workspace/home" }, { label: "2AM Worlds", to: `/${HUB_SLUG}` }],
  },

  {
    slug: "2am-in-pokemon-ai-generator",
    templateId: "two-am",
    published: true,
    parentSlug: HUB_SLUG,
    seo: {
      title: "2AM in Pokémon AI Generator – Create Late-Night Pokémon Worlds | Zyvo",
      description:
        "Create fan-made 2AM Pokémon worlds with AI. Turn tropical routes, quiet towns, and Pokémon Centers into a cinematic late-night AI image set.",
      primaryKeyword: "2am in pokemon",
      secondaryKeywords: ["pokemon ai generator", "pokemon ai images", "pokemon night ai", "2am pokemon ai"],
      ogImage: previewOf("pokemon (7).png"),
    },
    hero: {
      eyebrow: "2AM Worlds · Pokémon",
      heading: "Create a 2AM Pokémon World With AI",
      description:
        "Enter a region, route, or Pokémon-inspired idea and Zyvo turns it into a nostalgic, cinematic late-night image set — a quiet Pokémon Center, a tropical route at night, a town after the lights go down.",
      promptPlaceholder: 'Try "2AM in Pokémon Alola..."',
    },
    assets: {
      hero: previewOf("pokemon (7).png"),
      previews: [
        previewOf("pokemon (2).png"),
        previewOf("pokemon (3).png"),
        previewOf("pokemon (4).png"),
        previewOf("pokemon (5).png"),
        previewOf("pokemon (6).png"),
        previewOf("pokemon (7).png"),
      ],
    },
    examplePrompts: [
      "2AM in Pokémon Alola",
      "2AM at a quiet Pokémon Center",
      "2AM on a tropical Pokémon route",
      "2AM in Pokémon Kanto",
      "2AM in a Pokémon village at night",
      "2AM exploring a Pokémon forest route",
    ],
    sections: {
      intro:
        "2AM in Pokémon reimagines the routes, towns, and regions of the Pokémon world as quiet, cinematic night scenes — the kind of nostalgic atmosphere you get replaying an old region at 2AM instead of the daytime brightness of the games. Zyvo's 2AM Worlds template is built to take a short Pokémon-flavored prompt — a region like Alola, a location like a Pokémon Center, or just \"a tropical Pokémon route\" — and generate a consistent set of six late-night images around it. These are fan-made AI scenes inspired by the worlds players love, not official Pokémon artwork, and Zyvo has no affiliation with Nintendo, Game Freak, or The Pokémon Company. The goal is a moody, personal-feeling image set you can post as a slideshow, not a screenshot recreation.",
      howItWorks: [
        {
          title: "Enter a Pokémon world",
          description: "A region, route, town, or idea — like \"Pokémon Alola\" or \"a quiet Pokémon Center at night.\"",
        },
        {
          title: "Zyvo interprets the region",
          description: "The 2AM Worlds template reads the reference and plans a consistent set of tropical, route, or town-style night scenes.",
        },
        {
          title: "Generate six images",
          description: "Zyvo creates a cinematic, consistent 2AM Pokémon image set ready to download or post.",
        },
      ],
      faq: [
        {
          q: "Can I create a tropical Alola-style 2AM scene?",
          a: "Yes — \"2AM in Pokémon Alola\" is one of the most popular prompts for this template and reliably produces tropical, route-style night scenes.",
        },
        {
          q: "Does this use official Pokémon artwork or characters?",
          a: "No. Zyvo generates original, fan-made AI scenes inspired by the worlds you describe. Zyvo is not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.",
        },
        {
          q: "Can I request a specific region or route?",
          a: "Yes — name the region, route, or location you have in mind (e.g. \"Pokémon Kanto\" or \"a Pokémon village at night\") and Zyvo will build the scene set around it.",
        },
        {
          q: "How many images do I get?",
          a: "Each generation creates six consistent images in one 2AM Pokémon set.",
        },
      ],
    },
    relatedLandingPages: [HUB_SLUG, "2am-in-ninjago-ai-generator"],
    relatedBlogPosts: ["how-to-create-2am-pokemon-ai-images", "what-is-the-2am-worlds-ai-trend"],
    breadcrumb: [
      { label: "Home", to: "/workspace/home" },
      { label: "2AM Worlds", to: `/${HUB_SLUG}` },
      { label: "Pokémon", to: "/2am-in-pokemon-ai-generator" },
    ],
  },

  {
    slug: "2am-in-ninjago-ai-generator",
    templateId: "two-am",
    published: true,
    parentSlug: HUB_SLUG,
    seo: {
      title: "2AM in Ninjago AI Generator – Create Late-Night Ninjago Worlds | Zyvo",
      description:
        "Create fan-made 2AM Ninjago worlds with AI. Turn Ninjago City, the monastery, and elemental temples into a cinematic late-night AI image set.",
      primaryKeyword: "2am in ninjago",
      secondaryKeywords: ["ninjago ai generator", "ninjago ai images", "ninjago world ai"],
      ogImage: previewOf("ninjago (7).png"),
    },
    hero: {
      eyebrow: "2AM Worlds · Ninjago",
      heading: "Create a 2AM Ninjago World With AI",
      description:
        "Enter a character, location, or idea from the Ninjago universe and Zyvo turns it into a nostalgic, cinematic late-night image set — a quiet monastery courtyard, a neon Ninjago City street, an elemental temple after dark.",
      promptPlaceholder: 'Try "Kai from Ninjago..."',
    },
    assets: {
      hero: previewOf("ninjago (7).png"),
      previews: [
        previewOf("ninjago (1).png"),
        previewOf("ninjago (2).png"),
        previewOf("ninjago (3).png"),
        previewOf("ninjago (4).png"),
        previewOf("ninjago (5).png"),
        previewOf("ninjago (6).png"),
        previewOf("ninjago (7).png"),
      ],
    },
    examplePrompts: [
      "Kai from Ninjago",
      "2AM in Ninjago City",
      "2AM at the ninja monastery",
      "2AM in an elemental temple",
      "2AM on a quiet Ninjago rooftop",
      "2AM in Ninjago at night",
    ],
    sections: {
      intro:
        "2AM in Ninjago reimagines the neon streets, temples, and quiet monastery courtyards of the Ninjago universe as cinematic late-night scenes — nostalgic, a little liminal, and lit like a memory instead of a daytime frame. Zyvo's 2AM Worlds template turns a short Ninjago-flavored prompt — a character like Kai, a location like Ninjago City, or just \"a quiet ninja monastery at night\" — into a consistent set of six 2AM images. These are original, fan-made AI scenes inspired by the world players and viewers already love; Zyvo is not affiliated with or endorsed by LEGO or the Ninjago franchise. The result is a moody, personal-feeling slideshow you can post, not a frame-for-frame recreation.",
      howItWorks: [
        {
          title: "Enter a Ninjago world",
          description: "A character, location, or idea — like \"Kai from Ninjago\" or \"a quiet ninja monastery at night.\"",
        },
        {
          title: "Zyvo interprets the reference",
          description: "The 2AM Worlds template reads the reference and plans a consistent set of neon-city, temple, or monastery-style night scenes.",
        },
        {
          title: "Generate six images",
          description: "Zyvo creates a cinematic, consistent 2AM Ninjago image set ready to download or post.",
        },
      ],
      faq: [
        {
          q: "Can I generate a specific Ninjago character?",
          a: "Yes — naming a character like \"Kai from Ninjago\" helps Zyvo build scenes around that character's world and mood.",
        },
        {
          q: "Does this use official Ninjago artwork?",
          a: "No. Zyvo generates original, fan-made AI scenes inspired by the world you describe. Zyvo is not affiliated with or endorsed by LEGO or the Ninjago franchise.",
        },
        {
          q: "Can I request Ninjago City specifically?",
          a: "Yes — \"2AM in Ninjago City\" is a popular prompt and reliably produces a neon, urban night scene set.",
        },
        {
          q: "How many images do I get?",
          a: "Each generation creates six consistent images in one 2AM Ninjago set.",
        },
      ],
    },
    relatedLandingPages: [HUB_SLUG, "2am-in-pokemon-ai-generator"],
    relatedBlogPosts: ["how-to-create-2am-ninjago-ai-images", "what-is-the-2am-worlds-ai-trend"],
    breadcrumb: [
      { label: "Home", to: "/workspace/home" },
      { label: "2AM Worlds", to: `/${HUB_SLUG}` },
      { label: "Ninjago", to: "/2am-in-ninjago-ai-generator" },
    ],
  },

  // ---- Unpublished config stubs -------------------------------------------
  // No wired route yet. Each needs real, distinct preview assets and copy
  // before it should be marked published — see repo memory / plan notes.
  {
    slug: "2am-in-anime-ai-generator",
    templateId: "two-am",
    published: false,
    parentSlug: HUB_SLUG,
    seo: {
      title: "2AM in Anime AI Generator – Create Late-Night Anime Worlds | Zyvo",
      description: "Create fan-made 2AM anime worlds with AI — cinematic late-night anime city and character scenes.",
      primaryKeyword: "2am in anime",
      secondaryKeywords: ["anime ai generator", "anime night ai generator"],
      ogImage: previewOf("preview.png"),
    },
    hero: null,
    assets: { hero: previewOf("preview.png"), previews: [] },
    examplePrompts: ["2AM inside an anime city", "Naruto Shippuden"],
    sections: { intro: "", howItWorks: [], faq: [] },
    relatedLandingPages: [HUB_SLUG],
    relatedBlogPosts: [],
    breadcrumb: [],
  },
  {
    slug: "2am-in-naruto-ai-generator",
    templateId: "two-am",
    published: false,
    parentSlug: HUB_SLUG,
    seo: {
      title: "2AM in Naruto AI Generator – Create Late-Night Naruto Worlds | Zyvo",
      description: "Create fan-made 2AM Naruto worlds with AI — cinematic late-night Hidden Leaf Village scenes.",
      primaryKeyword: "2am in naruto",
      secondaryKeywords: ["naruto ai generator", "naruto ai images"],
      ogImage: previewOf("preview.png"),
    },
    hero: null,
    assets: { hero: previewOf("preview.png"), previews: [] },
    examplePrompts: ["Naruto Shippuden", "2AM in the Hidden Leaf Village"],
    sections: { intro: "", howItWorks: [], faq: [] },
    relatedLandingPages: [HUB_SLUG],
    relatedBlogPosts: [],
    breadcrumb: [],
  },
  {
    slug: "2am-in-pokemon-alola-ai-generator",
    templateId: "two-am",
    published: false,
    parentSlug: "2am-in-pokemon-ai-generator",
    seo: {
      title: "2AM in Pokémon Alola AI Generator | Zyvo",
      description: "Create a tropical, fan-made 2AM Pokémon Alola world with AI.",
      primaryKeyword: "2am in pokemon alola",
      secondaryKeywords: ["pokemon alola ai", "alola ai images"],
      ogImage: previewOf("pokemon (7).png"),
    },
    hero: null,
    assets: { hero: previewOf("pokemon (7).png"), previews: [] },
    examplePrompts: ["2AM in Pokémon Alola"],
    sections: { intro: "", howItWorks: [], faq: [] },
    relatedLandingPages: [HUB_SLUG, "2am-in-pokemon-ai-generator"],
    relatedBlogPosts: [],
    breadcrumb: [],
  },
  {
    slug: "2am-in-minecraft-ai-generator",
    templateId: "two-am",
    published: false,
    parentSlug: HUB_SLUG,
    seo: {
      title: "2AM in Minecraft AI Generator | Zyvo",
      description: "Create a fan-made 2AM Minecraft world with AI.",
      primaryKeyword: "2am in minecraft",
      secondaryKeywords: ["minecraft ai generator"],
      ogImage: previewOf("preview.png"),
    },
    hero: null,
    assets: { hero: previewOf("preview.png"), previews: [] },
    examplePrompts: ["2AM in a Minecraft world"],
    sections: { intro: "", howItWorks: [], faq: [] },
    relatedLandingPages: [HUB_SLUG],
    relatedBlogPosts: [],
    breadcrumb: [],
  },
];

export function getSeoLandingPage(slug) {
  return seoLandingPages.find((page) => page.slug === slug) || null;
}

export function getPublishedSeoLandingPages() {
  return seoLandingPages.filter((page) => page.published);
}

export function resolveRelatedLandingPages(config) {
  return (config.relatedLandingPages || [])
    .map((slug) => getSeoLandingPage(slug))
    .filter((page) => page && page.published);
}
