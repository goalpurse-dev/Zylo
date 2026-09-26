const LOGOS = {
  nano: "/images/logos/google.webp",
  hidream: "/images/logos/hidream.webp",
  juggernaut: "/images/logos/juggernaut.webp",
  openai: "/images/logos/gpt.webp",
  seedance: "/images/logos/seedance.webp",
  flux: "/images/logos/flux.webp",
};




// Prices are not kept here: the server prices every job (public.tool_prices)
// and the UI shows its quote (src/lib/image-generator/pricing.ts).
export const MODELS = {





 "image:nano.2": {
  label: "Nano Banana 2",
  description:
    "Next-generation image engine built for ultra-realistic detail, cinematic lighting, and flawless composition. Designed for creators who want maximum visual impact and viral-ready outputs.",

  img: LOGOS.nano,


  traits: [
    "4K Ultra Detail",
    "Photoreal Precision",
    "Cinematic Lighting",
    "Perfect Composition",
    "High Texture Fidelity",
    "Pro-Level Output",
  ],

  // 🔥 IMPORTANT: keep ONLY ratios here (NOT sizes)
  supportedSizes: ["1:1", "16:9", "9:16"],

  maxReferenceImages: 8,

  // 🔥 NEW: enable resolution system
  supportsResolutions: true,

  resolutions: [
    {
      key: "1k",
      label: "1K",
      description: "Fast generation",
      scale: "small",
    },
    {
      key: "2k",
      label: "2K",
      description: "Balanced quality",
      scale: "medium",
    },
    {
      key: "4k",
      label: "4K",
      description: "Maximum detail",
      scale: "large",
    },
  ],
},

   "image:nano-pro": {
    label: "Nano Banana Pro",
    description: "advanced image model — built for maximum detail, photorealism, and studio-grade output across any style..",
    img: LOGOS.nano,
    traits: ["Ultra Detail", "Max Precision", "Studio Quality"],
    supportedSizes: ["1:1-4k", "16:9-4k", "9:16-4k"],
    maxReferenceImages: 8,
  },


  
    "image:openai": {
    label: "OpenAI Image",
    description: "Best quality general-purpose image generation.",
    img: LOGOS.openai,
    traits: ["Highest quality", "Best", "General purpose"],
    supportedSizes: ["1:1",],
    maxReferenceImages: 6,
    defaultQuality: "high",

    // 🔥 NEW (provider-specific)
    providerSettings: {
      openai: {
        quality: "high", // locked for now
      },
    },
  },

   "image:seedream4.0": {
    label: "Seedream 4.0",
    description: "High-quality image generation with fast processing and low cost.",
    img: LOGOS.seedance,
    traits: ["Quality", "Fast processing", "Low cost"],
    supportedSizes: ["1:1", "16:9", "9:16", ],
    maxReferenceImages: 14,
  },



  "image:nano": {
    label: "Nano Banana",
    description: "Fast, lightweight image generation with low latency.",
    img: LOGOS.nano,
    traits: ["Fast", "Low cost", "General use"],
    supportedSizes: ["1:1", "16:9", "9:16"],
    maxReferenceImages: 3,
  },

  "image:juggernaut": {
    label: "Juggernaut",
    description:
      "High-impact cinematic realism with dramatic lighting and bold contrast.",
    img: LOGOS.juggernaut,
    traits: ["Cinematic lighting", "High contrast", "Photorealistic", "Cars & portraits"],
    supportedSizes: ["1:1", "16:9", "9:16", ],
    maxReferenceImages: 0,
  },

     "image:flux.max": {
    label: "Flux Max",
    description:
      "Best Flux, super-quality image generation with clean composition.",
    img: LOGOS.flux,
    traits: ["Fast", "Super quality", "Clean composition", "Advanced thinking"],
    supportedSizes: ["1:1", "16:9", "9:16", ],
    maxReferenceImages: 8,
  },

    "image:flux.base": {
    label: "Flux Base",
    description:
      "Fastest, medium-quality image generation with clean composition.",
     img: LOGOS.flux,
    traits: ["Fast", "Medium quality", "Clean composition", "Concept generation"],
    supportedSizes: ["1:1", "16:9", "9:16", ],
    maxReferenceImages: 4,
  },

  "image:hidream": {
    label: "HiDream-l1 Fast",
    description:
      "Ultra-fast realistic image generation with clean composition.",
    img: LOGOS.hidream,
    traits: ["Very fast", "Clean realism", "Low cost", "Concept generation"],
    supportedSizes: ["1:1",  "16:9", "9:16"],
    maxReferenceImages: 0,
  },

  

};

