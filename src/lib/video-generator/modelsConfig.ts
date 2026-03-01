const LOGOS = {
  cinematic: "/images/logos/cinematic.webp",
  fast: "/images/logos/fast.webp",
  kling: "/assets/logos/kling.webp",
};

export const MODELS = {


   "video:klingaist": {
    label: "KlingAI Video 3.0 Standard",
    description: "strong output quality.",
    credits: 20, // base price
    logo: LOGOS.kling,
    traits: ["Cinematic", "Quality", "Studio Lighting"],
    supportedSizes: ["16:9", "9:16",],
    supportedDurations: ["3s", "5s", "8s", "10s", "15s"],
    supportedResolutions: ["720p"],
    maxReferenceImages: 4,   // 🔥 ADD THIS
  },

 
};
