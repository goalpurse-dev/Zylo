import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import { SITE_URL } from "../../data/seoLandingPages.js";
import { getSeoBlogPost } from "../../data/seoBlogPosts.js";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import { useSEO } from "../../hooks/useSEO.js";
import MarkdownArticle from "./MarkdownArticle.jsx";
import { extractFaqs, extractRelatedLinks } from "./markdownBlogUtils.js";
import aiWorldGeneratorGuide from "./content/ai-world-generator-guide.md?raw";
import aiWorldGeneratorPrompts from "./content/ai-world-generator-prompts.md?raw";
import aiNostalgiaVideos from "./content/how-to-make-ai-nostalgia-videos.md?raw";
import aiWorldsAt2amIdeas from "./content/ai-worlds-at-2am-ideas.md?raw";
import howToGoViralTikTokAiWorlds from "./content/how-to-go-viral-tiktok-ai-worlds.md?raw";
import liminalSpaceAiGenerator from "./content/liminal-space-ai-generator.md?raw";
import howToCreate2amAnime from "./content/how-to-create-2am-anime-ai-images.md?raw";
import howToCreate2amNaruto from "./content/how-to-create-2am-naruto-ai-images.md?raw";
import twoAmMinecraft from "./content/2am-minecraft-ai-images.md?raw";
import twoAmGta from "./content/2am-gta-ai-images.md?raw";
import twoAmOnePiece from "./content/2am-one-piece-ai-images.md?raw";
import twoAmStudioGhibli from "./content/2am-studio-ghibli-ai-images.md?raw";
import twoAmFortnite from "./content/2am-fortnite-ai-images.md?raw";
import twoAmHogwarts from "./content/2am-in-hogwarts-ai-images.md?raw";
import twoAmBikiniBottom from "./content/2am-in-bikini-bottom-ai-images.md?raw";
import twoAmCyberpunkCity from "./content/2am-cyberpunk-city-ai-images.md?raw";
import twoAmWorldsTierList from "./content/2am-worlds-tier-list.md?raw";

const PREVIEW = (name) => `/template/2am-world/${name}`;

// Data-driven, same architecture as src/app/blog/CreatorGrowthGuide.jsx
// (slug prop -> keyed content object -> one render path, canonical/OG/
// Twitter/Article+FAQPage JSON-LD) but scoped to its own content object
// instead of extending that file's Publish/Stats-specific GUIDES/routing.
const GUIDES = {
  "ai-world-generator-guide": {
    title: "How to Create Cinematic Worlds With an AI World Generator",
    seoTitle: "AI World Generator: Create Cinematic Worlds in 2026",
    description: "Learn how to turn one idea into a consistent sequence of cinematic world images with AI, including a reusable prompt formula and real examples.",
    keywords: "ai world generator, cinematic AI worlds, AI world prompts, AI image sequence",
    category: "2AM Worlds",
    date: "August 3, 2026",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    author: "Zyvo Team",
    readTime: "9 min read",
    hero: "/blog-assets/ai-world-generator-guide-2026.webp",
    heroWidth: 1600,
    heroHeight: 900,
    heroAlt: "Six cinematic AI-generated world scenes arranged as a visual story after midnight",
    markdown: aiWorldGeneratorGuide,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your cinematic world",
  },
  "ai-world-generator-prompts": {
    title: "50 AI World Generator Prompts for Worlds People Want to Explore",
    seoTitle: "50 AI World Generator Prompts for Cinematic Images",
    description: "Copy 50 detailed AI world prompts for nostalgic nights, fantasy kingdoms, sci-fi cities, cozy scenes, liminal places, and visual stories.",
    keywords: "AI world generator prompts, cinematic AI prompts, fantasy world prompts, sci-fi AI prompts",
    category: "2AM Worlds",
    date: "August 3, 2026",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    author: "Zyvo Team",
    readTime: "12 min read",
    hero: "/blog-assets/50-ai-world-generator-prompts.webp",
    heroWidth: 1600,
    heroHeight: 900,
    heroAlt: "A grid of original fantasy, science-fiction, nostalgic and cozy AI-generated worlds",
    markdown: aiWorldGeneratorPrompts,
    promptCards: true,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Turn a prompt into six scenes",
  },
  "how-to-make-ai-nostalgia-videos": {
    title: "How to Make AI Nostalgia Videos for TikTok, Reels and Shorts",
    seoTitle: "How to Make AI Nostalgia Videos in 2026",
    description: "Create an emotional AI nostalgia video from six connected images with this step-by-step workflow for prompts, motion, sound, captions, and posting.",
    keywords: "AI nostalgia video, make AI nostalgia videos, TikTok nostalgia video, AI video workflow",
    category: "2AM Worlds",
    date: "August 3, 2026",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    author: "Zyvo Team",
    readTime: "10 min read",
    hero: "/blog-assets/how-to-make-ai-nostalgia-videos-2026.webp",
    heroWidth: 1600,
    heroHeight: 900,
    heroAlt: "A vertical AI nostalgia video storyboard showing six connected late-night scenes",
    markdown: aiNostalgiaVideos,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Build your six-scene nostalgia story",
  },
  "ai-worlds-at-2am-ideas": {
    title: "25 Incredible AI Worlds at 2AM You Can Create With AI",
    seoTitle: "25 Incredible AI Worlds at 2AM (Prompts Included)",
    description: "Explore 25 cinematic worlds after midnight, from cozy fantasy villages to nostalgic malls and space colonies, with a copyable prompt for every idea.",
    keywords: "AI worlds at 2AM, 2AM world ideas, AI world prompts, cinematic AI worlds",
    category: "2AM Worlds",
    date: "August 3, 2026",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    author: "Zyvo Team",
    readTime: "11 min read",
    hero: "/blog-assets/25-ai-worlds-at-2am-ideas.webp",
    heroWidth: 1600,
    heroHeight: 900,
    heroAlt: "A cinematic collage of cozy, nostalgic, fantasy and science-fiction worlds at 2AM",
    markdown: aiWorldsAt2amIdeas,
    promptCards: true,
    sectionImages: {
      "1. A coastal town at the end of summer": { src: "/blog-assets/coastal-town-at-2am.webp", width: 1200, height: 1800, alt: "A quiet coastal town and closed arcade after midnight at the end of summer" },
      "2. An original magical academy after curfew": { src: "/blog-assets/magical-academy-at-2am.webp", width: 1200, height: 1800, alt: "Students crossing a moonlit magical academy after curfew" },
      "3. A working-class city above Earth": { src: "/blog-assets/orbital-city-at-2am.webp", width: 1200, height: 1800, alt: "A maintenance worker in an orbital city above Earth after midnight" },
      "4. An empty shopping mall in 2004": { src: "/blog-assets/early-2000s-mall-at-2am.webp", width: 1200, height: 1800, alt: "An empty early-2000s shopping mall with one glowing vending machine" },
      "5. A library beneath a dark lake": { src: "/blog-assets/underwater-library-at-2am.webp", width: 1200, height: 1800, alt: "A candlelit underwater library beneath a dark mountain lake" },
      "6. The last train through a snowstorm": { src: "/blog-assets/snowy-train-at-2am.webp", width: 1200, height: 1800, alt: "The warm interior of the last train traveling through a snowstorm" },
      "7. A hotel where morning never arrives": { src: "/blog-assets/liminal-hotel-at-2am.webp", width: 1200, height: 1800, alt: "An elegant liminal hotel corridor where every clock reads 2:14AM" },
    },
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your world after midnight",
  },
  "how-to-go-viral-tiktok-ai-worlds": {
    title: "How to Go Viral on TikTok With AI World Slideshows",
    seoTitle: "How to Go Viral on TikTok With AI World Slideshows (2026)",
    description: "Learn the hook, pacing, caption, and posting-cadence strategy behind AI world slideshows that get watched to the end and pushed further on TikTok.",
    keywords: "how to go viral tiktok ai images, viral ai slideshow ideas, ai tiktok image trend, ai slideshow generator, ai world slideshow tiktok",
    category: "2AM Worlds",
    date: "August 8, 2026",
    datePublished: "2026-08-08",
    dateModified: "2026-08-08",
    author: "Zyvo Team",
    readTime: "10 min read",
    hero: "/blog-assets/tiktok-ai-world-slideshow-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A smartphone glowing in a dark room displaying a dreamy AI-generated night world slideshow",
    markdown: howToGoViralTikTokAiWorlds,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Build tomorrow's world in minutes",
  },
  "liminal-space-ai-generator": {
    title: "Liminal Space AI Generator: Create Eerie 2AM Liminal Worlds",
    seoTitle: "Liminal Space AI Generator: Create Eerie 2AM Liminal Worlds",
    description: "What makes a space feel liminal, a repeatable prompt formula, ten ready-to-use prompts, and how liminal spaces differ from the Backrooms.",
    keywords: "liminal space ai generator, ai liminal space images, backrooms ai generator, dreamcore ai generator, liminal space prompts",
    category: "2AM Worlds",
    date: "August 8, 2026",
    datePublished: "2026-08-08",
    dateModified: "2026-08-08",
    author: "Zyvo Team",
    readTime: "9 min read",
    hero: "/blog-assets/liminal-space-dedicated-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "An empty fluorescent-lit office floor at 2AM with no one in sight, an example of the liminal space aesthetic",
    markdown: liminalSpaceAiGenerator,
    promptCards: true,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own eerie 2AM liminal world",
  },
  "how-to-create-2am-anime-ai-images": {
    title: "How to Create 2AM Anime AI Images",
    seoTitle: "How to Create 2AM Anime AI Images | Zyvo",
    description: "How to prompt strong 2AM anime AI scenes, including five anime sub-styles, a repeatable prompt formula, and ready-to-use prompts.",
    keywords: "2am in anime, 2am anime ai, anime night ai generator, anime ai image generator, late night anime ai images",
    category: "2AM Worlds",
    date: "August 9, 2026",
    datePublished: "2026-08-09",
    dateModified: "2026-08-09",
    author: "Zyvo Team",
    readTime: "8 min read",
    hero: "/blog-assets/2am-anime-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A lone figure sitting on a rooftop under a moonlit sky, 2AM anime-style AI image with clean line work",
    markdown: howToCreate2amAnime,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your 2AM anime world",
  },
  "how-to-create-2am-naruto-ai-images": {
    title: "How to Create 2AM Naruto AI Images",
    seoTitle: "How to Create 2AM Naruto AI Images | Zyvo",
    description: "How to prompt 2AM Naruto-inspired AI scenes by location and character, with ready-to-use prompts for the Hidden Leaf Village at night.",
    keywords: "2am in naruto, naruto ai generator, naruto ai images, naruto world ai",
    category: "2AM Worlds",
    date: "August 9, 2026",
    datePublished: "2026-08-09",
    dateModified: "2026-08-09",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-naruto-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A quiet ninja village at 2AM with a Hokage-style monument under a full moon, fan-made AI image",
    markdown: howToCreate2amNaruto,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your 2AM Naruto-inspired world",
  },
  "2am-minecraft-ai-images": {
    title: "2AM in Minecraft: The Viral AI World Every Player Will Recognize",
    seoTitle: "2AM Minecraft AI Images: Create the Viral Late-Night World",
    description: "Turn the 'still playing at 2AM' Minecraft feeling into a blocky, moonlit AI image set — with a prompt formula and three ready-to-use prompts.",
    keywords: "2am minecraft, minecraft ai generator, 2am minecraft ai images, blocky world ai generator, voxel ai images",
    category: "2AM Worlds",
    date: "August 10, 2026",
    datePublished: "2026-08-10",
    dateModified: "2026-08-10",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-minecraft-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A half-built blocky voxel-style house at 2AM with torches lining the unfinished walls under a starry sky",
    markdown: twoAmMinecraft,
    sectionImages: {
      "Why \"2AM Minecraft\" hits differently": { src: "/blog-assets/2am-minecraft-village.png", width: 1200, height: 675, alt: "A blocky voxel-style village at night with windows lit one by one under a full moon" },
      "The 2AM blocky-world prompt formula": { src: "/blog-assets/2am-minecraft-cave.png", width: 1200, height: 675, alt: "A blocky voxel-style mining tunnel entrance at 2AM with torches bolted along stone walls" },
    },
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM blocky world",
  },
  "2am-gta-ai-images": {
    title: "2AM in GTA: The Viral Open-World Vice City AI World",
    seoTitle: "2AM GTA AI Images: Create a Viral Neon Vice City World",
    description: "Turn a neon, palm-tree-lined open-world city into a cinematic 2AM AI image set — with a prompt formula and three ready-to-use prompts.",
    keywords: "2am gta, gta ai generator, gta vice city ai images, gta ai images, open world ai generator",
    category: "2AM Worlds",
    date: "August 10, 2026",
    datePublished: "2026-08-10",
    dateModified: "2026-08-10",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-gta-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A neon-lit open-world city boardwalk at 2AM with palm trees and wet reflective pavement",
    markdown: twoAmGta,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM open-world city",
  },
  "2am-one-piece-ai-images": {
    title: "2AM in One Piece: The Straw Hat Crew's Late-Night AI World",
    seoTitle: "2AM One Piece AI Images: Create a Viral Pirate-Crew World",
    description: "Turn a moonlit pirate-ship deck into a cinematic 2AM AI image set — with a prompt formula and three ready-to-use prompts.",
    keywords: "2am one piece, one piece ai generator, one piece ai images, pirate ship ai generator",
    category: "2AM Worlds",
    date: "August 10, 2026",
    datePublished: "2026-08-10",
    dateModified: "2026-08-10",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-one-piece-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A wooden pirate ship deck at 2AM anchored under a full moon with lanterns swaying",
    markdown: twoAmOnePiece,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM pirate-crew world",
  },
  "2am-studio-ghibli-ai-images": {
    title: "2AM in Studio Ghibli: The Viral Painterly AI World Trend",
    seoTitle: "2AM Ghibli AI Images: Create a Viral Painterly World",
    description: "Turn a painterly, lantern-lit countryside town into a cinematic 2AM AI image set — with a prompt formula and three ready-to-use prompts.",
    keywords: "2am ghibli, ghibli ai generator, studio ghibli ai art, ghibli style ai images, painterly ai generator",
    category: "2AM Worlds",
    date: "August 11, 2026",
    datePublished: "2026-08-11",
    dateModified: "2026-08-11",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-ghibli-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A painterly countryside town at 2AM with one lantern-lit window still open, Studio Ghibli-inspired style",
    markdown: twoAmStudioGhibli,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM painterly world",
  },
  "2am-fortnite-ai-images": {
    title: "2AM in Fortnite: The Viral Battle Royale AI World",
    seoTitle: "2AM Fortnite AI Images: Create a Viral Battle Royale World",
    description: "Turn a colorful abandoned battle-royale island into a cinematic 2AM AI image set — with a prompt formula and three ready-to-use prompts.",
    keywords: "2am fortnite, fortnite ai generator, fortnite ai images, battle royale ai generator",
    category: "2AM Worlds",
    date: "August 11, 2026",
    datePublished: "2026-08-11",
    dateModified: "2026-08-11",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-fortnite-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A colorful abandoned battle-royale town square at 2AM with string lights still glowing over empty market stalls",
    markdown: twoAmFortnite,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM battle-royale world",
  },
  "2am-in-hogwarts-ai-images": {
    title: "2AM in Hogwarts: The Viral Wizarding World AI Trend",
    seoTitle: "2AM Hogwarts AI Images: Create a Viral Wizarding School World",
    description: "Turn a torchlit magical school courtyard into a cinematic 2AM AI image set — with a prompt formula and three ready-to-use prompts.",
    keywords: "2am hogwarts, hogwarts ai generator, hogwarts ai images, wizarding school ai generator, magical school ai images",
    category: "2AM Worlds",
    date: "August 19, 2026",
    datePublished: "2026-08-19",
    dateModified: "2026-08-19",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-hogwarts-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A torchlit Gothic castle-school courtyard at 2AM under a starry sky with one tower window glowing",
    markdown: twoAmHogwarts,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM wizarding school",
  },
  "2am-in-bikini-bottom-ai-images": {
    title: "2AM in SpongeBob's Bikini Bottom: The Viral Underwater AI World",
    seoTitle: "2AM Bikini Bottom AI Images: Create a Viral Underwater Town World",
    description: "Turn a colorful underwater cartoon town into a cinematic 2AM AI image set — with a prompt formula and three ready-to-use prompts.",
    keywords: "2am bikini bottom, bikini bottom ai generator, underwater town ai images, spongebob ai generator",
    category: "2AM Worlds",
    date: "August 19, 2026",
    datePublished: "2026-08-19",
    dateModified: "2026-08-19",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-bikini-bottom-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A colorful underwater cartoon town at 2AM with round coral houses and one window glowing under a full moon",
    markdown: twoAmBikiniBottom,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM underwater town",
  },
  "2am-cyberpunk-city-ai-images": {
    title: "2AM in a Cyberpunk City: The Neon-Lit AI World Trend",
    seoTitle: "2AM Cyberpunk City AI Images: Create a Viral Neon-Lit World",
    description: "Turn an empty, rain-slicked neon-lit street into a cinematic 2AM AI image set — with a prompt formula and three ready-to-use prompts.",
    keywords: "2am cyberpunk city, cyberpunk ai generator, cyberpunk ai images, neon city ai generator",
    category: "2AM Worlds",
    date: "August 19, 2026",
    datePublished: "2026-08-19",
    dateModified: "2026-08-19",
    author: "Zyvo Team",
    readTime: "7 min read",
    hero: "/blog-assets/2am-cyberpunk-city-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "An empty neon-lit cyberpunk city street at 2AM with rain-slicked pavement reflecting pink and blue light",
    markdown: twoAmCyberpunkCity,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Create your own 2AM cyberpunk city",
  },
  "2am-worlds-tier-list": {
    title: "2AM Worlds Tier List: Ranking Every World We've Tried",
    seoTitle: "2AM Worlds Tier List: Every World Ranked | Zyvo",
    description: "Twelve 2AM Worlds, ranked by visual contrast and recognizability — from the sharpest S-tier reframes to the moodiest C-tier atmosphere picks.",
    keywords: "2am worlds tier list, best 2am worlds, 2am worlds ranked, 2am ai world ideas",
    category: "2AM Worlds",
    date: "August 19, 2026",
    datePublished: "2026-08-19",
    dateModified: "2026-08-19",
    author: "Zyvo Team",
    readTime: "8 min read",
    hero: "/blog-assets/2am-worlds-tier-list-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A golden trophy podium at night with glowing miniature worlds arranged around it under a starry sky",
    markdown: twoAmWorldsTierList,
    ctaHref: "/2am-worlds-ai-generator",
    cta: "Try an S-tier world for yourself",
  },
  "what-is-the-2am-worlds-ai-trend": {
    title: "What Is the 2AM Worlds AI Trend?",
    seoTitle: "What Is the 2AM Worlds AI Trend? | Zyvo",
    description: "Where the 2AM Worlds AI trend came from, what it actually is, and how to create your own with Zyvo.",
    keywords: "2am worlds ai trend, 2am ai images, 2am ai generator, what is 2am worlds",
    category: "2AM Worlds",
    date: "July 27, 2026",
    readTime: "6 min read",
    hero: "/blog-assets/2am-worlds-trend-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A phone and printed polaroid photos of different dreamy AI-generated worlds on a bed at 2AM",
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
    links: [
      ["/2am-worlds-ai-generator", "Try the 2AM Worlds Generator", "Enter your own world and generate a cinematic 2AM image set."],
      ["/blog/how-to-create-2am-anime-ai-images", "How to Create 2AM Anime AI Images", "Five anime sub-styles and a repeatable prompt formula."],
      ["/blog/how-to-create-2am-naruto-ai-images", "How to Create 2AM Naruto AI Images", "Prompt the Hidden Leaf Village at 2AM by location or character."],
      ["/blog/2am-minecraft-ai-images", "2AM in Minecraft", "The viral blocky-world AI image trend every player will recognize."],
      ["/blog/2am-in-hogwarts-ai-images", "2AM in Hogwarts", "A torchlit magical school courtyard, reimagined at 2AM."],
      ["/blog/2am-in-bikini-bottom-ai-images", "2AM in Bikini Bottom", "A colorful underwater cartoon town, reimagined at 2AM."],
      ["/blog/2am-worlds-tier-list", "2AM Worlds Tier List", "Every world in the catalog, ranked by contrast and recognizability."],
    ],
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
    hero: "/blog-assets/2am-world-prompts-hero.png",
    heroWidth: 1024,
    heroHeight: 576,
    heroAlt: "A notebook of handwritten prompts beside a laptop showing a dreamy AI-generated world at 2AM",
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
    links: [
      ["/2am-worlds-ai-generator", "Open the 2AM Worlds Generator", "Enter any of these prompts or write your own."],
      ["/blog/how-to-create-2am-anime-ai-images", "How to Create 2AM Anime AI Images", "Five anime sub-styles and a repeatable prompt formula."],
      ["/blog/how-to-create-2am-naruto-ai-images", "How to Create 2AM Naruto AI Images", "Prompt the Hidden Leaf Village at 2AM by location or character."],
    ],
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
      ["/blog/how-to-create-2am-anime-ai-images", "How to Create 2AM Anime AI Images", "Five anime sub-styles and a repeatable prompt formula."],
      ["/blog/how-to-create-2am-naruto-ai-images", "How to Create 2AM Naruto AI Images", "Prompt the Hidden Leaf Village at 2AM by location or character."],
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
      ["/blog/how-to-create-2am-anime-ai-images", "How to Create 2AM Anime AI Images", "Five anime sub-styles and a repeatable prompt formula."],
      ["/blog/how-to-create-2am-naruto-ai-images", "How to Create 2AM Naruto AI Images", "Prompt the Hidden Leaf Village at 2AM by location or character."],
    ],
    ctaHref: "/2am-in-ninjago-ai-generator",
    cta: "Create a 2AM Ninjago world",
  },
};

export default function TwoAmBlogGuide({ slug }) {
  const guide = GUIDES[slug];
  const published = getSeoBlogPost(slug)?.published !== false;
  const faqs = useMemo(() => guide?.markdown ? extractFaqs(guide.markdown) : (guide?.faqs || []), [guide]);
  const relatedLinks = useMemo(() => guide?.markdown ? extractRelatedLinks(guide.markdown) : (guide?.links || []), [guide]);
  const canonicalUrl = `${SITE_URL}/blog/${slug}`;
  const absoluteHero = guide?.hero?.startsWith("http") ? guide.hero : `${SITE_URL}${guide?.hero || ""}`;
  const structuredData = useMemo(() => guide ? ({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: guide.title,
        description: guide.description,
        image: absoluteHero,
        datePublished: guide.datePublished || "2026-07-27",
        dateModified: guide.dateModified || guide.datePublished || "2026-07-27",
        mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
        author: { "@type": "Organization", name: guide.author || "Zyvo Team" },
        publisher: {
          "@type": "Organization",
          name: "Zyvo",
          url: SITE_URL,
          logo: { "@type": "ImageObject", url: `${SITE_URL}/og-image.png` },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/workspace/home` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: guide.category, item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 4, name: guide.title, item: canonicalUrl },
        ],
      },
      ...(faqs.length ? [{
        "@type": "FAQPage",
        mainEntity: faqs.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      }] : []),
    ],
  }) : null, [absoluteHero, canonicalUrl, faqs, guide]);

  useSEO({
    title: guide?.seoTitle,
    description: guide?.description,
    canonical: guide ? canonicalUrl : undefined,
    structuredData,
    ogImage: guide ? absoluteHero : undefined,
    ogType: "article",
    keywords: guide?.keywords,
    robots: published ? undefined : "noindex, nofollow",
  });

  if (!guide) return null;

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white">
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-8 sm:px-6 sm:pt-12">
        <nav className="mb-6 text-[13px] text-white/40">
          <Link to="/workspace/home" className="hover:text-lime-300">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-lime-300">Blog</Link>
          <span className="mx-2">/</span>
          <span>{guide.category}</span>
          <span className="mx-2">/</span>
          <span className="truncate text-white/55">{guide.title}</span>
        </nav>

        <header>
          <span className="inline-flex rounded-full bg-lime-300/[0.1] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-lime-300">{guide.category}</span>
          <h1 className="mt-5 text-[32px] font-black leading-[1.08] tracking-[-0.03em] sm:text-[42px]">{guide.title}</h1>
          <p className="mt-5 text-[16px] leading-8 text-white/55">{guide.description}</p>
          <div className="mt-4 flex items-center gap-1.5 text-[12px] text-white/35">
            <Calendar className="h-3.5 w-3.5" />{guide.date} · {guide.readTime} · {guide.author || "Zyvo Team"}
          </div>
        </header>

        {!published ? (
          <aside className="mt-8 flex aspect-[16/9] items-center justify-center rounded-[24px] border border-dashed border-amber-300/25 bg-amber-300/[0.04] px-6 text-center text-[13px] text-amber-100/65">
            Editorial draft: approved Zyvo hero output required before publication.
          </aside>
        ) : (
          <figure className="mt-8 overflow-hidden rounded-[24px] border border-white/10 bg-black">
            <img
              src={guide.hero}
              alt={guide.heroAlt}
              width={guide.heroWidth || 1600}
              height={guide.heroHeight || 900}
              className="aspect-[16/9] w-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        )}

        {guide.markdown ? (
          <article className="mt-10">
            <MarkdownArticle markdown={guide.markdown} slug={slug} ctaHref={guide.ctaHref} promptCards={guide.promptCards} sectionImages={guide.sectionImages} />
          </article>
        ) : (
          <article className="mt-10 space-y-5 text-[16px] leading-8 text-white/60">
            {guide.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </article>
        )}

        {!guide.markdown && guide.sections?.map((section) => (
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

        {!guide.markdown && guide.promptGroups?.map((group) => (
          <section key={group.title} className="mt-12">
            <h2 className="text-[22px] font-black tracking-[-0.02em] text-white">{group.title}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {group.prompts.map((text) => (
                <Link
                  key={text}
                  to={`${guide.ctaHref}?prompt=${encodeURIComponent(text)}`}
                  onClick={() => trackSeoEvent("seo_prompt_interaction", { slug: `blog:${slug}`, templateId: "two-am" })}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-lime-300/[0.16] bg-lime-300/[0.05] px-4 py-2 text-[13px] font-semibold text-lime-100 transition hover:border-lime-300/40 hover:bg-lime-300/[0.09]"
                >
                  {text}
                  <span className="text-[11px] text-lime-300/70 opacity-0 transition group-hover:opacity-100">Try this prompt →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-14">
          <h2 className="text-[22px] font-black tracking-[-0.02em] text-white">Frequently asked questions</h2>
          <div className="mt-5 space-y-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
                <summary className="cursor-pointer list-none text-[14px] font-bold text-white">{question}</summary>
                <p className="pt-3 text-[13px] leading-6 text-white/55">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {relatedLinks.map(([to, title, description]) => (
            <Link key={to} to={to} className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-lime-300/25">
              <p className="text-[13px] font-bold text-white group-hover:text-lime-300">{title}</p>
              <p className="mt-1 text-[12px] leading-5 text-white/45">{description}</p>
            </Link>
          ))}
        </div>

        {!guide.markdown && <section className="mt-16 rounded-[28px] bg-gradient-to-br from-[#12160f] to-[#0b0d0f] p-8 text-center">
          <h2 className="text-[24px] font-black text-white">{guide.cta}</h2>
          <Link
            to={guide.ctaHref}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-lime-300/[0.14] to-lime-500/[0.10] border border-lime-400/25 px-6 py-3 text-[14px] font-black text-white"
          >
            Open the generator <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>}
      </main>
      <Footer />
    </div>
  );
}
