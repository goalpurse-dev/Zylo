// Registry of 2AM Worlds blog posts, kept in sync with the content object in
// src/app/blog/TwoAmBlogGuide.jsx. Used by BlogIndex, the sitemap generator,
// and related-articles rendering so the post list lives in one place.

export const seoBlogPosts = [
  {
    slug: "what-is-the-2am-worlds-ai-trend",
    title: "What Is the 2AM Worlds AI Trend?",
    desc: "Where the 2AM Worlds trend came from and how Zyvo's AI generator recreates it.",
    date: "Jul 27, 2026",
    category: "2AM Worlds",
    landingPageSlug: "2am-worlds-ai-generator",
  },
  {
    slug: "best-2am-world-ai-prompts",
    title: "50 2AM World AI Prompt Ideas",
    desc: "Fifty ready-to-use 2AM World prompts, from anime cities to quiet beach towns.",
    date: "Jul 27, 2026",
    category: "2AM Worlds",
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
