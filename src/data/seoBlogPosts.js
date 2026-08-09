// Registry of 2AM Worlds blog posts, kept in sync with the content object in
// src/app/blog/TwoAmBlogGuide.jsx. Used by BlogIndex, the sitemap generator,
// and related-articles rendering so the post list lives in one place.

export const seoBlogPosts = [
  {
    slug: "ai-world-generator-guide",
    published: true,
    title: "How to Create Cinematic Worlds With an AI World Generator",
    desc: "Turn one idea into a consistent sequence of cinematic world images with a reusable prompt formula.",
    date: "Aug 3, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/ai-world-generator-guide-2026.webp",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "ai-world-generator-prompts",
    published: true,
    title: "50 AI World Generator Prompts for Cinematic Images",
    desc: "Copy detailed prompts for nostalgic, fantasy, science-fiction, cozy and liminal worlds.",
    date: "Aug 3, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/50-ai-world-generator-prompts.webp",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "how-to-make-ai-nostalgia-videos",
    published: true,
    title: "How to Make AI Nostalgia Videos in 2026",
    desc: "Build an emotional short-form nostalgia video from six connected AI images.",
    date: "Aug 3, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/how-to-make-ai-nostalgia-videos-2026.webp",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "ai-worlds-at-2am-ideas",
    published: true,
    title: "25 Incredible AI Worlds at 2AM",
    desc: "Explore 25 cinematic worlds after midnight with a copyable prompt for every idea.",
    date: "Aug 3, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/25-ai-worlds-at-2am-ideas.webp",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "how-to-go-viral-tiktok-ai-worlds",
    published: true,
    title: "How to Go Viral on TikTok With AI World Slideshows",
    desc: "The hook, pacing, caption, and posting-cadence strategy behind AI world slideshows that get watched to the end.",
    date: "Aug 8, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/tiktok-ai-world-slideshow-hero.png",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "liminal-space-ai-generator",
    published: true,
    title: "Liminal Space AI Generator: Create Eerie 2AM Liminal Worlds",
    desc: "What makes a space feel liminal, a repeatable prompt formula, and ten ready-to-use prompts.",
    date: "Aug 8, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/liminal-space-dedicated-hero.png",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "how-to-create-2am-anime-ai-images",
    published: true,
    title: "How to Create 2AM Anime AI Images",
    desc: "Five anime sub-styles, a repeatable prompt formula, and ready-to-use 2AM anime prompts.",
    date: "Aug 9, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/2am-anime-hero.png",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "how-to-create-2am-naruto-ai-images",
    published: true,
    title: "How to Create 2AM Naruto AI Images",
    desc: "How to prompt 2AM Naruto-inspired scenes by location and character, with ready-to-use prompts.",
    date: "Aug 9, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/2am-naruto-hero.png",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "what-is-the-2am-worlds-ai-trend",
    title: "What Is the 2AM Worlds AI Trend?",
    desc: "Where the 2AM Worlds trend came from and how Zyvo's AI generator recreates it.",
    date: "Jul 27, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/2am-worlds-trend-hero.png",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "best-2am-world-ai-prompts",
    title: "50 2AM World AI Prompt Ideas",
    desc: "Fifty ready-to-use 2AM World prompts, from anime cities to quiet beach towns.",
    date: "Jul 27, 2026",
    category: "2AM Worlds",
    image: "/blog-assets/2am-world-prompts-hero.png",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "how-to-create-2am-pokemon-ai-images",
    title: "How to Create 2AM Pokémon AI Images",
    desc: "A practical walkthrough for generating nostalgic, late-night Pokémon-inspired AI scenes.",
    date: "Jul 27, 2026",
    category: "2AM Worlds",
    landingPageSlug: "2am-in-pokemon-ai-generator",
  },
  {
    slug: "how-to-create-2am-ninjago-ai-images",
    title: "How to Create 2AM Ninjago AI Images",
    desc: "How to turn Ninjago characters and locations into a cinematic 2AM AI image set.",
    date: "Jul 27, 2026",
    category: "2AM Worlds",
    landingPageSlug: "2am-in-ninjago-ai-generator",
  },
];

export function getSeoBlogPost(slug) {
  return seoBlogPosts.find((post) => post.slug === slug) || null;
}

export function getPublishedSeoBlogPosts() {
  return seoBlogPosts.filter((post) => post.published !== false);
}
