
import NanoBanana from "../../assets/logos/google.png";
import HiDream from "../../assets/logos/hidream.png";
import Juggernaut from "../../assets/logos/juggernaut.png";
import OpenAI from "../../assets/logos/gpt.png";



export const MODELS = {
  "image:nano": {
    label: "Nano Banana",
    description: "Fast, lightweight image generation with low latency.",
    img: NanoBanana,
    credits: 4,
    traits: ["Fast", "Low cost", "General use"],
    supportedSizes: ["1:1", "16:9", "9:16"],
    maxReferenceImages: 4,
  },
    "image:openai": {
    label: "OpenAI Image",
    description: "Best quality general-purpose image generation.",
    img: OpenAI,
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

  "image:juggernaut": {
    label: "Juggernaut",
    description:
      "High-impact cinematic realism with dramatic lighting and bold contrast.",
    img: Juggernaut,
    credits: 2,
    traits: ["Cinematic lighting", "High contrast", "Photorealistic", "Cars & portraits"],
    supportedSizes: ["1:1", "16:9", "9:16", "21:9", "2:3"],
    maxReferenceImages: 0,
  },

     "image:flux.max": {
    label: "Flux Max",
    description:
      "Best Flux, super-quality image generation with clean composition.",
    img: Juggernaut,
    credits: 7,
    traits: ["Fast", "Super quality", "Clean composition", "Advanced thinking"],
    supportedSizes: ["1:1", "16:9", "9:16", "21:9", "2:3"],
    maxReferenceImages: 8,
  },

    "image:flux.base": {
    label: "Flux Base",
    description:
      "Fastest, medium-quality image generation with clean composition.",
    img: Juggernaut,
    credits: 1,
    traits: ["Fast", "Medium quality", "Clean composition", "Concept generation"],
    supportedSizes: ["1:1", "16:9", "9:16", "21:9", "2:3"],
    maxReferenceImages: 4,
  },

  "image:hidream": {
    label: "HiDream-l1 Fast",
    description:
      "Ultra-fast realistic image generation with clean composition.",
    img: HiDream,
    credits: 1,
    traits: ["Very fast", "Clean realism", "Low cost", "Concept generation"],
    supportedSizes: ["1:1", "21:9", "4:3", "16:9", "9:16", "21:9", "2:3"],
    maxReferenceImages: 0,
  },

  

};

