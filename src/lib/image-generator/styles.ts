const STYLE_THUMBS = {
  cinematic: "/images/styles/cinematic.webp",
  dynamic: "/images/styles/dynamic.webp",
  anime: "/images/thumbs/anime.webp",
  clay: "/images/thumbs/clay.webp",
  comic: "/images/thumbs/comic.webp",
  disney: "/images/thumbs/disney.webp",
  lego: "/images/thumbs/lego.webp",
  lowpoly: "/images/thumbs/lowpoly.webp",
  noir: "/images/thumbs/noir.webp",
  cartoon: "/images/thumbs/3dcartoon.webp",
  minecraft: "/images/thumbs/minecraft.webp",
  ghibli: "/images/thumbs/ghibli.webp",
  cyberpunk: "/images/thumbs/cyberpunk.webp",
  pixelart: "/images/thumbs/pixelart.webp",
  realistic: "/images/thumbs/realistic.webp",
  vintage: "/images/thumbs/vintage.webp",
    viralSkeleton: "/images/thumbs/viralskeleton.webp", // 👈 ADD THIS
};





export const IMAGE_STYLES = {
  Cinematic: {
    label: "Cinematic",
    promptHint: "cinematic lighting, dramatic composition, ultra-realistic",
    img: STYLE_THUMBS.cinematic,
    imageStrength: 0.55, // 🔥 more freedom
  },

  Dynamic: {
    label: "Dynamic",
    promptHint: "dynamic motion, energetic composition, sharp focus",
    img: STYLE_THUMBS.dynamic,
    imageStrength: 0.55, // 🔥 more freedom
  },

   Cartoon: {
    label: "3D Cartoon",
    promptHint: "smooth 3D cartoon style, soft lighting, rounded shapes",
    img: STYLE_THUMBS.cartoon,
    imageStrength: 0.65, // 🔥 more freedom
  },

  ViralSkeleton: {
  label: "Viral Skeleton",
promptHint: `
hyper-realistic human skeleton character,
transparent skull variation allowed,
glowing brain or glowing internal organs when relevant,
cinematic golden hour or dramatic medical lighting,
strong rim light outline glow,
high contrast shadows,
centered portrait composition,
vertical 9:16 framing,
ultra detailed bones texture,
photorealistic 3D render,
dramatic atmosphere,
viral TikTok "what if" science style,
8k ultra detail
No text on the screen
`,
  img: STYLE_THUMBS.viralSkeleton,
  imageStrength: 0.6
},

   VintagePortrait: {
    label: "Vintage Portrait",
    promptHint: `
analog film portrait, vintage editorial photography,
soft directional lighting, gentle shadows,
natural skin texture, subtle imperfections,
fine film grain, scanned photo texture,
low contrast blacks, smooth tonal range,
monochrome or warm sepia tones,
shallow depth of field, classic portrait composition,
timeless aesthetic, emotional expression,
shot on vintage film camera, archival quality
    `,
    img: STYLE_THUMBS.vintage,
  },


    Minecraft: {
    label: "Minecraft",
    promptHint: "Minecraft-style blocky, pixelated, low-poly aesthetic",
    img: STYLE_THUMBS.minecraft,
  },

  
   Realistic: {
    label: "Realistic",
    promptHint: "realistic style, high detail, photorealistic rendering",
    img: STYLE_THUMBS.realistic,
  },


  Anime: {
    label: "Anime",
    promptHint: "anime illustration style, expressive features, clean linework",
    img: STYLE_THUMBS.anime,
  },

  Clay: {
    label: "Clay",
    promptHint: "claymation style, handmade clay texture, soft studio lighting",
    img: STYLE_THUMBS.clay,
  },


  Comic: {
    label: "Comic",
    promptHint: "comic book style, bold outlines, high contrast colors",
    img: STYLE_THUMBS.comic,
  },

  Disney: {
    label: "Disney",
    promptHint: "Disney-inspired animation style, soft shading, friendly proportions",
    img: STYLE_THUMBS.disney,
  },

    Ghibli: {
    label: "Ghibli",
    promptHint: "Studio Ghibli-style animation, soft shading, whimsical aesthetic",
    img: STYLE_THUMBS.ghibli,
  },

  Lego: {
    label: "Lego",
    promptHint: "LEGO-style build, plastic bricks, toy-like proportions",
    img: STYLE_THUMBS.lego
  },

   Cyberpunk: {
    label: "Cyberpunk",
    promptHint: "cyberpunk aesthetic, neon lighting, futuristic elements",
    img: STYLE_THUMBS.cyberpunk,
  },

  Lowpoly: {
    label: "Lowpoly",
    promptHint: "low-poly 3D style, simple geometry, flat shading",
    img: STYLE_THUMBS.lowpoly,
  },

   PixelArt: {
    label: "Pixel Art",
    promptHint: "pixel art style, retro 8-bit aesthetic, low resolution",
    img: STYLE_THUMBS.pixelart,
  },


  Noir: {
    label: "Noir",
    promptHint: "film noir style, dramatic lighting, deep shadows, monochrome",
    img: STYLE_THUMBS.noir,
  },
} as const;

export type ImageStyleKey = keyof typeof IMAGE_STYLES;
