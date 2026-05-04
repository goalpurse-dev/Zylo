const LOGOS = {
  hailou:     "/assets/logos/hailou.webp",
  kling:      "/assets/logos/kling.webp",
  runway:     "/assets/logos/runway.webp",
  wan:        "/assets/logos/wan.webp",       // add logo file when available
  vidu:       "/assets/logos/vidu.webp",      // add logo file when available
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



  // ── Atlas Cloud models ──────────────────────────────────────

  /**
   * Wan 2.6 Flash — image-to-video only (requires a reference image).
   * 720p · no audio · fast generation
   */
  "video:wan26flash": {
    label:                "Wan 2.6 Flash",
    description:          "Alibaba's Wan 2.6 Flash delivers fast, fluid image-to-video generation at 720p. Ideal for animating product shots, portraits, and scenes where you supply the starting frame.",
    logo:                 LOGOS.wan,
    traits:               ["Image-to-Video", "Fast", "Fluid Motion"],
    supportedSizes:       ["16:9", "9:16"],
    supportedDurations:   ["3s", "5s"],
    supportedResolutions: ["720p"],
    maxReferenceImages:   1,
    requiresRefImage:     true,   // i2v only — caller must enforce this in the UI
    hasSound:             false,
  },

  /**
   * Vidu Q3 Turbo — text-to-video and image-to-video, audio always included.
   * 540p/720p/1080p · audio on
   */
  "video:viduq3turbo": {
    label:                "Vidu Q3 Turbo",
    description:          "Vidu Q3 Turbo supports both text-to-video and image-to-video with built-in audio generation. Produces cinematic results with strong motion quality and sound.",
    logo:                 LOGOS.vidu,
    traits:               ["540p-1080p", "Text-to-Video", "Image-to-Video", "🔊 Audio"],
    supportedSizes:       ["16:9", "9:16"],
    supportedDurations:   ["3s", "5s", "8s"],
    supportedResolutions: ["540p", "720p", "1080p"],
    maxReferenceImages:   1,      // optional — 0 images = text-to-video
    hasSound:             true,
  },
};
