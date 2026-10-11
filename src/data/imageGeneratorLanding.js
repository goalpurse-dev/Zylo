// Content of /image-generator (src/pages/landing/ImageGeneratorLanding.jsx) and
// of its JSON-LD (structuredData.js). Plain JS: Node build scripts import it.
//
// Every picture was made with Zyvo's own image models, from the owner's
// Creations (picked 2026-10-11) or generated for this page with the tool: no real people, no franchise characters.
// The files are WebP at two widths in public/lp/image-generator/
// (<file>.w480.webp and <file>.w960.webp); `size` is the original's
// width x height, used for the aspect ratio so nothing shifts while loading.
import { STICKMAN_PRICING } from "./stickmanLandingPages.js";

export const IMAGE_GENERATOR_PATH = "/image-generator";
export const IMAGE_TOOL_PATH = "/workspace/image-generator";
export const IMAGE_ASSETS = "/lp/image-generator";

export const IMAGE_GENERATOR_SEO = {
  title: "AI Image Generator – Start With 5 Free Images | Zyvo",
  description: "Turn a text prompt into cinematic, anime, realistic and 3D images for TikTok, YouTube thumbnails, product photos and ads. Start with 5 free generations.",
  h1: "AI Image Generator",
  cta: "Start with 5 free image generations",
};

export const IMAGE_HERO = { file: "glowing-skeleton-colosseum", size: [1376, 768], alt: "A glowing translucent skeleton walking through a torch-lit Roman colosseum at golden hour, a cinematic 3D render made with Zyvo" };

// Style gallery: grouped by the look of the picture. Twelve come from the owner's Creations;
// the anime, product and 2AM-style ones were generated for this page on 2026-10-11 with the
// tool itself (Nano Banana 2, 16:9), from prompts that name no franchise and no person.
export const IMAGE_GALLERY = [
  {
    id: "cinematic",
    title: "Cinematic and realistic",
    items: [
      { file: "glowing-skeleton-colosseum", size: [1376, 768], alt: "Cinematic 3D render of a glowing skeleton walking through a Roman colosseum lit by torches" },
      { file: "chef-plating", size: [1376, 768], alt: "Realistic close-up of a chef's hands plating a colorful dish with steam rising, warm side lighting" },
      { file: "miniature-mountain-city", size: [1536, 2752], alt: "Realistic photo of a handbuilt miniature mountain city model hit by a snow avalanche on a film set" },
      { file: "neon-grid", size: [1376, 768], alt: "Dark background with a thin purple neon perspective grid fading toward the horizon" },
    ],
  },
  {
    id: "anime",
    title: "Anime",
    items: [
      { file: "anime-rainy-street", size: [5504, 3072], alt: "Anime-style rainy side street at night with a glowing vending machine and neon signs reflected in puddles" },
      { file: "anime-fox-spirit", size: [5504, 3072], alt: "Anime illustration of a white fox spirit with glowing tails on a mossy stone path in a bamboo forest" },
      { file: "anime-lighthouse-cat", size: [5504, 3072], alt: "Anime illustration of a cat on a lighthouse windowsill beside a lantern, above a stormy sea at dusk" },
    ],
  },
  {
    id: "product",
    title: "Product shots",
    items: [
      { file: "product-headphones", size: [5504, 3072], alt: "Studio product photo of matte black over-ear headphones on a marble pedestal against a beige background" },
      { file: "product-sneakers", size: [5504, 3072], alt: "Product photo of plain white sneakers floating above a pastel blue background with a soft shadow" },
    ],
  },
  {
    id: "night-worlds",
    title: "2AM-style worlds",
    items: [
      { file: "2am-floating-islands", size: [5504, 3072], alt: "A town on floating islands at night, joined by lantern-lit wooden bridges under a sky full of stars" },
      { file: "2am-underwater-station", size: [5504, 3072], alt: "An empty underwater train station at night, a glass tunnel with fish outside and one glowing vending machine" },
      { file: "2am-desert-city", size: [5504, 3072], alt: "A sleeping desert city of sandstone towers in blue moonlight with one tea stall lit by a warm lamp" },
    ],
  },
  {
    id: "illustration",
    title: "Illustration",
    items: [
      { file: "black-hole", size: [1280, 720], alt: "Illustration of a black hole with a bright orange ring of gas bending around it" },
      { file: "space-telescope", size: [1280, 720], alt: "Illustration of a space telescope in orbit above Earth with two spiral galaxies behind it" },
      { file: "aurora-arctic", size: [1280, 720], alt: "Illustration of green and pink northern lights over snowy Arctic mountains" },
      { file: "bioluminescent-deep-sea", size: [1280, 720], alt: "Illustration of glowing deep-sea fish and jellyfish in dark water" },
      { file: "coral-reef", size: [1280, 720], alt: "Illustration of a whale swimming over a bright coral reef with glowing fish" },
      { file: "glowing-forest-path", size: [1536, 1024], alt: "Illustration of a dark forest with a glowing green path winding between the trees" },
      { file: "great-wall", size: [1536, 1024], alt: "Illustration of the Great Wall winding across green mountain ridges" },
      { file: "sunken-city", size: [1536, 1024], alt: "Illustration of a sunken city with towers under blue water and fish swimming past" },
    ],
  },
];

export const IMAGE_STEPS = [
  { title: "Describe the picture", text: "Type what you want to see in plain words: the subject, the place, the light, the mood. One or two sentences is enough." },
  { title: "Pick a style and a size", text: "Choose a look such as Cinematic, Realistic, Anime, Cartoon, Comic, Clay, Cyberpunk, Pixel art or Noir, and a size: square, 16:9 or vertical 9:16." },
  { title: "Generate and download", text: "The image appears in your workspace in seconds. Download it, or make another version with a changed prompt." },
];

export const IMAGE_USE_CASES = [
  { title: "TikTok and Reels", text: "Vertical 9:16 pictures for slideshows, covers and backgrounds, in one look across a whole series." },
  { title: "YouTube thumbnails", text: "16:9 pictures with one clear subject and strong contrast, so they still read at small sizes." },
  { title: "Product photos", text: "Clean backgrounds and styled scenes for a product, without booking a studio." },
  { title: "Ads", text: "Several versions of one idea in square, vertical and landscape, ready to test against each other." },
];

// Real prompts and the image each one made. `prompt` is what is handed to the
// tool when the button is clicked (location state, never a ?prompt= URL).
export const IMAGE_PROMPTS = [
  {
    file: "glowing-skeleton-colosseum", size: [1376, 768], style: "Cinematic 3D",
    alt: "Result: a glowing skeleton walking through a torch-lit Roman colosseum",
    prompt: "A glowing, translucent anatomical skeleton casually walking through the ancient Roman Colosseum at golden hour, torches flickering along the stone arches, dust motes drifting in warm backlight, cinematic 3D render, dramatic rim lighting, shallow depth of field",
  },
  {
    file: "anime-rainy-street", size: [5504, 3072], style: "Anime",
    alt: "Result: an anime-style rainy street at night with a glowing vending machine",
    prompt: "Anime-style rainy city side street at night seen from under a shop awning, glowing vending machine, neon signs reflected in puddles, bicycles parked by the wall, cel-shaded, cinematic wide shot, no people, no readable text",
  },
  {
    file: "product-headphones", size: [5504, 3072], style: "Product shot",
    alt: "Result: black headphones on a marble pedestal against a beige background",
    prompt: "Studio product photo of matte black wireless over-ear headphones resting on a small marble pedestal, soft beige gradient background, softbox lighting from the left, gentle shadow, sharp focus, no logo, no text",
  },
  {
    file: "2am-floating-islands", size: [5504, 3072], style: "2AM-style world",
    alt: "Result: a town on floating islands at night under a starry sky",
    prompt: "A quiet town built on floating islands at 2 AM, lantern-lit wooden bridges between the islands, deep indigo sky full of stars, one window glowing warm, mist far below, nostalgic cinematic illustration, wide shot, no people, no text",
  },
];

export const IMAGE_FAQ = [
  { q: "Is the AI image generator free?", a: "It is free to start. A free Zyvo account gets 5 image generations every 30 days, with no card needed. Images saved on the free plan carry a small \"Made with Zyvo AI\" mark; paid plans save without it and add monthly credits for more images and for the video tools." },
  { q: "Can I use the images commercially?", a: "Yes. You can use the images you make in your own posts, thumbnails, ads and product listings. You are responsible for what you ask for: do not put real people or other companies' characters and logos in a prompt without the right to use them." },
  { q: "Which styles can I generate?", a: "Cinematic, Realistic, Anime, Cartoon, Comic, Clay, Cyberpunk, Low poly, Pixel art, Noir and Vintage portrait are built in as presets. You can also describe any other look in the prompt itself." },
  { q: "Which sizes can I choose?", a: "Square 1:1, landscape 16:9 and vertical 9:16, so one idea fits a feed post, a YouTube thumbnail and a TikTok or Reels cover." },
  { q: "Do I need design skills?", a: "No. You type a description, pick a style and a size, and the image is made for you. A clearer description gives a better picture, and the guides below show how to write one." },
];

// The blog's best guides on AI images.
export const IMAGE_GUIDES = [
  { to: "/blog/ai-image-generator-prompt-formula", title: "How to write the perfect AI image prompt", text: "A formula with examples: subject, setting, light, style." },
  { to: "/blog/ai-image-generator-examples", title: "8 real styles you can create right now", text: "What each style looks like and when to use it." },
  { to: "/blog/ai-image-generator-beginners-guide-2026", title: "AI image generator: the beginner's guide", text: "From your first prompt to a picture you can post." },
  { to: "/blog/which-ai-image-style-works-best", title: "Anime, 3D or realistic: which style works best", text: "How the main styles compare for social content." },
  { to: "/blog/ai-image-generator-mistakes", title: "10 AI image mistakes to avoid", text: "The common reasons a picture comes out wrong, and the fix for each." },
  { to: "/blog/how-to-create-movie-style-visuals", title: "Cinematic AI images", text: "How to get movie-style light, framing and mood." },
];

export const imageSrc = (file, width) => `${IMAGE_ASSETS}/${file}.w${width}.webp`;

/** Every picture file the page shows, once each. */
export function imageGeneratorFiles() {
  return [...new Set([IMAGE_HERO.file, ...IMAGE_GALLERY.flatMap((group) => group.items.map((item) => item.file)), ...IMAGE_PROMPTS.map((item) => item.file)])];
}

// JSON-LD: the tool with its real prices (the free allowance and the three
// monthly plans, the same numbers /pricing shows), and the FAQ as printed.
export function imageGeneratorStructuredData(canonical, siteUrl) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Zyvo AI Image Generator",
        description: IMAGE_GENERATOR_SEO.description,
        url: canonical,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        image: `${siteUrl}${imageSrc(IMAGE_HERO.file, 960)}`,
        offers: [
          { "@type": "Offer", name: "Free", price: "0", priceCurrency: STICKMAN_PRICING.currency, description: "5 image generations every 30 days", url: `${siteUrl}/pricing` },
          ...STICKMAN_PRICING.plans.map((plan) => ({ "@type": "Offer", name: `${plan.name} plan, monthly`, price: String(plan.price), priceCurrency: STICKMAN_PRICING.currency, description: `${plan.credits} credits a month`, url: `${siteUrl}/pricing` })),
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: IMAGE_GENERATOR_SEO.h1, item: canonical },
        ],
      },
      { "@type": "FAQPage", mainEntity: IMAGE_FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
}
