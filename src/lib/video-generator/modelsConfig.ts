const LOGOS = {
  hailou: "/assets/logos/hailou.webp",
  kling: "/assets/logos/kling.webp",
  runway: "/assets/logos/runway.webp",
};

export const MODELS = {


   "video:klingaist": {
    label: "KlingAI Video 3.0 Standard",
    description: "A high-quality AI video model built for cinematic visuals and smooth motion. KlingAI 3.0 Standard delivers detailed scenes, strong realism, and stable generation—ideal for professional-looking content and storytelling videos.",
  
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

    logo: LOGOS.hailou,
    traits: ["Fast", "Efficient", "Consistent"],
    supportedSizes: ["4:3", "16:9",],
    supportedDurations: ["6s", "10s"],
    supportedResolutions: ["720p"],
    maxReferenceImages: 1,   // 🔥 ADD THIS
  },

    "video:RunwayGen-4Turbo": {
    label:"Runway Gen-4 (Cinematic)",
    description: "Ultra-realistic AI video generation with cinematic motion, lifelike detail, and smooth scene transitions. Perfect for creating high-end viral content, ads, and storytelling clips that actually look professional.",

    logo: LOGOS.runway,
    traits: ["Cinematic", "Ultra Realistic", "High Quality"],
    supportedSizes: ["9:16", "16:9", "1:1",],
    supportedDurations: ["3s","5s", "10s"],
    supportedResolutions: ["Auto (HD)"],
    maxReferenceImages: 1,   // 🔥 ADD THIS
  },

 
};
