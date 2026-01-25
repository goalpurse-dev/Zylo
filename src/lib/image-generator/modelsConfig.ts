// imports at top

import ZyloSparkImg from "../../assets/blog/productphoto/example5.png";
import ZyloPrimeImg from "../../assets/blog/productphoto/example5.png";
import NanoBanana from "../../assets/logos/google.png";


export const MODELS = {
  nanoBanana: {
    label: "Nano Banana",
    description: "Fast, lightweight image generation",
    img: NanoBanana,
    credits: 2,
    supportedSizes: ["1:1", "16:9", "9:16"],
    supportedStyles: ["Cinematic", "Dynamic", "Minimal"],
    maxReferenceImages: 4,
  },

  zyloSpark: {
    label: "Zylo Spark",
    description: "Balanced quality and speed",
    img: ZyloSparkImg,
    credits: 2,
    supportedSizes: ["1:1", "16:9", "9:16", "2:3"],
    supportedStyles: ["Dynamic", "Minimal"],
    maxReferenceImages: 6,
  },

  zyloPrime: {
    label: "Zylo Prime",
    description: "Highest fidelity & control",
    img: ZyloPrimeImg,
    credits: 4,
    supportedSizes: ["1:1", "16:9", "9:16", "2:3", "4:5"],
    supportedStyles: ["Cinematic", "Dynamic", "Minimal"],
    maxReferenceImages: 8,
  },
};
