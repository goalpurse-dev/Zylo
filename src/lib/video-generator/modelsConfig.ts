const LOGOS = {
  cinematic: "/images/logos/cinematic.webp",
  fast: "/images/logos/fast.webp",
  kling: "/assets/logos/kling.webp",
};

export const MODELS = {
  "video:cinematic": {
    label: "Cinematic v1",
    description: "Balanced cinematic motion with clean lighting.",
    credits: 10, // base price
    logo: LOGOS.cinematic,
    traits: ["Cinematic", "Balanced", "Studio Lighting"],
    supportedSizes: ["16:9", "9:16", "1:1"],
    supportedDurations: ["3s", "5s", "8s", "10s"],
    supportedResolutions: ["auto", "480p", "720p", "1080p"],
    maxReferenceImages: 4,   // 🔥 ADD THIS
  },

   "video:klingaist": {
    label: "KlingAI Video 3.0 Standard",
    description: "strong output quality.",
    credits: 20, // base price
    logo: LOGOS.kling,
    traits: ["Cinematic", "Quality", "Studio Lighting"],
    supportedSizes: ["16:9", "9:16",],
    supportedDurations: ["3s", "5s", "8s", "10s", "15s"],
    supportedResolutions: ["720p", "1080p"],
    maxReferenceImages: 4,   // 🔥 ADD THIS
  },

  "video:fast": {
    label: "Fast Motion",
    description: "Fast video generation with lower cost.",
    credits: 6,
    logo: LOGOS.fast,
    traits: ["Fast", "Budget", "Quick Rendering"],
    supportedSizes: ["16:9", "1:1"],
    supportedDurations: ["3s", "5s"],
    supportedResolutions: ["auto", "480p", "720p"],
    maxReferenceImages: 4,   // 🔥 ADD THIS
  },
};
