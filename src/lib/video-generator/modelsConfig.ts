const LOGOS = {
  hailou: "/assets/logos/hailou.webp",
  kling: "/assets/logos/kling.webp",
};

export const MODELS = {


   "video:klingaist": {
    label: "KlingAI Video 3.0 Standard",
    description: "A high-quality AI video model built for cinematic visuals and smooth motion. KlingAI 3.0 Standard delivers detailed scenes, strong realism, and stable generation—ideal for professional-looking content and storytelling videos.",
    credits: 20, // base price
    logo: LOGOS.kling,
    traits: ["Cinematic", "Quality", "Studio Lighting"],
    supportedSizes: ["16:9", "9:16",],
    supportedDurations: ["3s", "5s"],
    supportedResolutions: ["720p"],
    maxReferenceImages: 4,   // 🔥 ADD THIS
  },

   "video:miniMaxFast": {
    label:"MiniMax Hailou 2.3 Fast",
    description: "A fast and cost-efficient AI video model designed for quick video generation with smooth motion and reliable scene consistency—perfect for social media and rapid content creation.",
    credits: 10, // base price
    logo: LOGOS.hailou,
    traits: ["Fast", "Efficient", "Consistent"],
    supportedSizes: ["4:3", "16:9",],
    supportedDurations: ["6s", "10s"],
    supportedResolutions: ["720p"],
    maxReferenceImages: 1,   // 🔥 ADD THIS
  },

 
};
