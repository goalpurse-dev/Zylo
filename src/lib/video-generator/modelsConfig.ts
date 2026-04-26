const LOGOS = {
  hailou: "/assets/logos/hailou.webp",
  kling: "/assets/logos/kling.webp",
  runway: "/assets/logos/runway.webp",
};

export const MODELS = {

  "video:klingpro": {
    label: "KlingAI Video 3.0 Pro",
    description: "Best cinematic + realistic motion. Great for storytelling, skeleton-style POV content, and premium viral videos. Supports AI sound and ultra-sharp 1080p/1440p output.",
    logo: LOGOS.kling,
    traits: ["Cinematic", "Realistic Motion", "🔊 Sound", "Premium"],
    supportedSizes: ["16:9", "9:16", "1:1"],
    supportedDurations: ["3s", "5s", "8s", "10s", "15s"],
    supportedResolutions: ["1080p"],
    maxReferenceImages: 1,
    durationSlider: { min: 3, max: 15 },
    hasSound: true,
    // resolution is locked per size — not user-selectable
    sizeResolutions: { "16:9": "1080p", "9:16": "1080p", "1:1": "1440p" },
  },

   "video:klingaist": {
    label: "KlingAI Video 3.0 Standard",
    description: "A high-quality AI video model built for cinematic visuals and smooth motion. KlingAI 3.0 Standard delivers detailed scenes, strong realism, and stable generation—ideal for professional-looking content and storytelling videos.",
  
    logo: LOGOS.kling,
    traits: ["Cinematic", "Quality", "Studio Lighting"],
    supportedSizes: ["16:9", "9:16",],
    supportedDurations: ["3s", "5s"],
    supportedResolutions: ["720p"],
    maxReferenceImages: 2,   // 🔥 ADD THIS
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


 
};
