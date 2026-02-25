// src/lib/video-templates/templates.ts

export type VideoTemplate = {
  id: string;
  name: string;
  description: string;
  previewImage: string;
  category: "viral" | "brand" | "cinematic";
  basePrompt: string;

  defaultProvider?: string; // must match UI_MODEL_TO_TOOLKEY key
  defaultDuration?: string;
  defaultResolution?: string;
  defaultSize?: string;
};

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "cinematic-luxury",
    name: "Cinematic Luxury Ad",
    description: "High-end slow motion product commercial.",
    previewImage: "/templates/cinematic.jpg",
    category: "brand",
    basePrompt: `
Ultra cinematic luxury commercial.
Soft studio lighting, macro lens,
slow motion, premium shadows.
`,
    defaultProvider: "video:cinematic",
    defaultDuration: "5s",
    defaultResolution: "1080p",
    defaultSize: "16:9",
  },

  {
    id: "viral-anime",
    name: "Anime Power Reveal",
    description: "High-energy anime transformation scene.",
    previewImage: "/templates/anime.jpg",
    category: "viral",
    basePrompt: `
Anime transformation scene.
Glowing aura, wind burst,
dramatic camera zoom.
`,
    defaultProvider: "video:klingaist",
    defaultDuration: "5s",
    defaultResolution: "720p",
    defaultSize: "9:16",
  },
];