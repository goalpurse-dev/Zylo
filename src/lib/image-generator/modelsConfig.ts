const LOGOS = {
  nano: "/images/logos/google.webp",
  hidream: "/images/logos/hidream.webp",
  juggernaut: "/images/logos/juggernaut.webp",
  openai: "/images/logos/gpt.webp",
  seedance: "/images/logos/seedance.webp",
};




export const MODELS = {

   "image:nano-pro": {
    label: "Nano Banana Pro",
    description: "Our most advanced image model — built for maximum detail, photorealism, and studio-grade output across any style..",
    img: LOGOS.nano,
    credits: 15,
    traits: ["Ultra Detail", "Max Precision", "Studio Quality"],
    supportedSizes: ["1:1", "16:9", "9:16"],
    maxReferenceImages: 8,
  },


  
    "image:openai": {
    label: "OpenAI Image",
    description: "Best quality general-purpose image generation.",
    img: LOGOS.openai,
    credits: 10, // TEMP – fixed price
    traits: ["Highest quality", "Best", "General purpose"],
    supportedSizes: ["1:1", "3:2", "2:3"],
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
    credits: 3,
    traits: ["Quality", "Fast processing", "Low cost"],
    supportedSizes: ["1:1", "16:9", "9:16", "4:3","21:9"],
    maxReferenceImages: 14,
  },



  "image:nano": {
    label: "Nano Banana",
    description: "Fast, lightweight image generation with low latency.",
    img: LOGOS.nano,
    credits: 4,
    traits: ["Fast", "Low cost", "General use"],
    supportedSizes: ["1:1", "16:9", "9:16"],
    maxReferenceImages: 3,
  },

  "image:juggernaut": {
    label: "Juggernaut",
    description:
      "High-impact cinematic realism with dramatic lighting and bold contrast.",
    img: LOGOS.juggernaut,
    credits: 2,
    traits: ["Cinematic lighting", "High contrast", "Photorealistic", "Cars & portraits"],
    supportedSizes: ["1:1", "16:9", "9:16", "21:9", "2:3"],
    maxReferenceImages: 0,
  },

     "image:flux.max": {
    label: "Flux Max",
    description:
      "Best Flux, super-quality image generation with clean composition.",
    img: LOGOS.juggernaut,
    credits: 7,
    traits: ["Fast", "Super quality", "Clean composition", "Advanced thinking"],
    supportedSizes: ["1:1", "16:9", "9:16", "21:9", "2:3"],
    maxReferenceImages: 8,
  },

    "image:flux.base": {
    label: "Flux Base",
    description:
      "Fastest, medium-quality image generation with clean composition.",
     img: LOGOS.juggernaut,
    credits: 1,
    traits: ["Fast", "Medium quality", "Clean composition", "Concept generation"],
    supportedSizes: ["1:1", "16:9", "9:16", "21:9", "2:3"],
    maxReferenceImages: 4,
  },

  "image:hidream": {
    label: "HiDream-l1 Fast",
    description:
      "Ultra-fast realistic image generation with clean composition.",
    img: LOGOS.hidream,
    credits: 1,
    traits: ["Very fast", "Clean realism", "Low cost", "Concept generation"],
    supportedSizes: ["1:1", "21:9", "4:3", "16:9", "9:16","2:3"],
    maxReferenceImages: 0,
  },

  

};

