// src/lib/providers.ts

/* ======================== TYPES ======================== */

export type ToolKey =
  /* ---------- TEXT → IMAGE (UI MODELS) ---------- */
  | "image:nano"
  | "image:spark"
  | "image:prime"
  | "image:juggernaut"
  | "image:hidream"
  | "image:openai"
  | "image:flux.base"
  | "image:flux.max"
  | "image:Wan2.6-image"
  | "image:nano-pro"
  | "image:seedream4.0"
  | "image:nano.2"
  | "image:fruit-v2"
  | "image:fruit-v3"



    /* ---------- VIDEO ---------- */
  | "video:klingaist"
  | "video:klingpro"
  | "video:miniMaxFast"
  | "video:RunwayGen-4Turbo"
  | "video:wan26flash"
  | "video:veo31fast"
  | "video:veo31lite"
  | "video:viduq3turbo"
  | "video:seedance15pro"
  | "video:seedance20fast"



  /* ---------- PRODUCT PHOTOS (DO NOT TOUCH) ---------- */
  | "product-photo"


  

export type Provider = "runware" | "atlascloud";

export type ProviderLink = {
  provider: Provider;
  generator: string;
  airTag: string;
  secret: "RUNWARE_API_KEY" | "ATLASCLOUD_API_KEY";
  edgeFn: string;

  resolutionPricing?: Record<
  string,
  { credits: number; price: number }
>;

  // 🔥 VIDEO PRICING CORE
  costPerSecondUSD?: number;
  resolutionCostPerSecondUSD?: Record<string, number>;
  baseResolution?: "480p" | "540p" | "720p" | "768p" | "1080p";
  retailMultiplier?: number; // your markup multiplier
  baseCreditsPerSecond?: number; // 🔥 NEW

  soundCreditsPerSecond?: number; // credits/s when sound is enabled

  // IMAGE (keep as-is)
  costUSD?: number;
  retailUSD?: number;
  credits?: number;
  margin?: number;

  requiresFrame?: boolean;
  enhanceAirTag?: string;
};

const m = (costUSD: number, retailUSD: number) =>
  Number(((retailUSD - costUSD) / retailUSD).toFixed(2));

/* ======================== PROVIDERS ======================== */

export const KEY_LINKS: Record<ToolKey, ProviderLink> = {
  /* =======================================================
     TEXT → IMAGE (CLEAN, UI-FACING MODELS)
     ======================================================= */

  /**
   * Nano Banana
   * Fast, cheap, used for quick generations
   */
  "image:nano": {
    provider: "runware",
    generator: "Gemini Flash Image 2.5",
    airTag: "google:4@1",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

    costUSD: 0.039,
    retailUSD: 0.08,
    credits: 4,
    margin: m(0.039, 0.08),
  },

  "image:openai": {
    provider: "runware",
    generator: "GPT Image 1.5",
    airTag: "openai:4@1",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

   /* On the highest quality */
    costUSD: 0.133,
    retailUSD: 0.20,
    credits: 10,
    margin: m(0.133, 0.20),
  },
"image:nano.2": {
  provider: "runware",
  generator: "Nano Banana 2",
  airTag: "google:4@3",
  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-image",

  costUSD: 0.06923,
  retailUSD: 0.14,
  credits: 7,
  margin: m(0.06923, 0.14),

  // 🔥 ADD THIS
  resolutionPricing: {
    "1k": { credits: 5, price: 0.10 },
    "2k": { credits: 7, price: 0.14 },
    "4k": { credits: 10, price: 0.20 },
  },
},

  "image:seedream4.0": {
    provider: "runware",
    generator: "Seedream 4.0",
    airTag: "bytedance:5@0",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

   /* On the highest quality */
    costUSD: 0.03,
    retailUSD: 0.06,
    credits: 3,
    margin: m(0.03, 0.06),
  },

   "image:nano-pro": {
    provider: "runware",
    generator: "Nano Pro",
    airTag: "google:4@2",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

   /* On the highest quality */
    costUSD: 0.1457,
    retailUSD: 0.30,
    credits: 25,
    margin: m(0.1457, 0.30),
  },

  


    "image:juggernaut": {
    provider: "runware",
    generator: "Juggernaut Pro Flux by RunDiffusion",
    airTag: "rundiffusion:130@100",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

    costUSD: 0.0042,
    retailUSD: 0.04,
    credits: 2,
    margin: m(0.0042, 0.04),
  },

    "image:flux.base": {
    provider: "runware",
    generator: "Flux Base by RunDiffusion",
    airTag: "runware:400@4",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

    costUSD: 0.0006,
    retailUSD: 0.02,
    credits: 1,
    margin: m(0.0006, 0.02),
  },


    "image:flux.max": {
    provider: "runware",
    generator: "FLUX.2 [Max]",
    airTag: "bfl:7@1",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

    costUSD: 0.07,
    retailUSD: 0.14,
    credits: 7,
    margin: m(0.07, 0.14),
  },

   "image:hidream": {
    provider: "runware",
    generator: "HiDream-i1 Fast",
    airTag: "runware:97@3",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

    costUSD: 0.0038,
    retailUSD: 0.02,
    credits: 1,
    margin: m(0.0038, 0.02),
  },


  /* -------------------------------------------------------
     FRUIT STORY DEDICATED MODELS
     zyvo-v2  → GPT Image 2 low (dynamic 2-3 credits/image)
     zyvo-v3  → GPT Image 2 medium (8 credits/image)
     ------------------------------------------------------- */

  "image:fruit-v2": {
    provider: "runware",
    generator: "GPT Image 2",
    airTag: "openai:gpt-image@2",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

    costUSD: 0.010423,
    retailUSD: 0.02,
    credits: 2,
    margin: m(0.010423, 0.02),
  },

  "image:fruit-v3": {
    provider: "runware",
    generator: "GPT Image 2",
    airTag: "openai:gpt-image@2",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",

    costUSD: 0.08,
    retailUSD: 0.16,
    credits: 8,
    margin: m(0.08, 0.16),
  },

    /* =======================================================
                              VIDEO
     ======================================================= */

 "video:klingpro": {
  provider: "runware",
  generator: "KlingAI Video 3.0 Pro",
  airTag: "klingai:kling-video@3-pro",
  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-video",

  costPerSecondUSD: 0.112,   // $0.56 / 5s without sound
  baseResolution: "1080p",
  retailMultiplier: 2,

  baseCreditsPerSecond: 11,  // no sound: $0.224/s at ~$0.02/credit
  soundCreditsPerSecond: 17, // with sound: $0.168/s cost → $0.336/s retail
},

 "video:klingaist": {
  provider: "runware",
  generator: "KlingAI Video 3.0 Standard",
  airTag: "klingai:kling-video@3-standard",
  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-video",

  costPerSecondUSD: 0.084,
  baseResolution: "720p",

  retailMultiplier: 2.2,

  // 🔥 THIS IS WHAT UI + BACKEND USE
  baseCreditsPerSecond: 9,
},

 "video:miniMaxFast": {
  provider: "runware",
  generator: "MiniMax Hailou 2.3 Fast",
  airTag: "minimax:4@2",
  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-video",

  costPerSecondUSD: 0.0317,
  baseResolution: "768p",

  retailMultiplier: 2.2,

  // 🔥 THIS IS WHAT UI + BACKEND USE
  baseCreditsPerSecond: 4,
},

 "video:RunwayGen-4Turbo": {
  provider: "runware",
  generator: "Runway Gen-4 Turbo",
  airTag: "runway:1@1",
  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-video",

  costPerSecondUSD: 0.05042,


  retailMultiplier: 2.1,

  // 🔥 THIS IS WHAT UI + BACKEND USE
  baseCreditsPerSecond: 5,
},

  /* =======================================================
     ATLAS CLOUD VIDEO MODELS
     Provider: Atlas Cloud (atlascloud)
     Edge fn:  runware-video-atlascloud  (DO NOT reuse runware-video)
     Secret:   ATLASCLOUD_API_KEY
     Note:     provider is kept as "runware" so job-worker passes its
               provider guard; actual routing is via edgeFn.
     ======================================================= */

  /**
   * Wan-2.6 Flash  —  image-to-video ONLY
   * Cost: $0.018/s  ×  2.2 markup  =  ~$0.040/s retail
   * At $0.02/credit → 2 credits/s
   */
  "video:wan26flash": {
    provider:   "runware",              // must stay "runware" for job-worker guard
    generator:  "Wan 2.6 Flash",
    airTag:     "alibaba:wan@2.6-flash",
    secret:     "RUNWARE_API_KEY",
    edgeFn:     "/functions/v1/runware-video",

    costPerSecondUSD:     0.07593,       // $0.4556 / 6s actual cost
    baseResolution:       "720p",
    retailMultiplier:     2,
    baseCreditsPerSecond: 8,            // $0.4556 × 2 / 6s / $0.02 ≈ 7.6 → 8/s → 46 credits per 6s clip
  },

  /**
   * Seedance 1.5 Pro — 6s clip, WITH audio (providerSettings.bytedance.audio:
   * true — confirmed working, see runware-video/runware.ts). This is the
   * "correct" Seedance tier — real native audio support, unlike 2.0 Fast.
   * Measured from actual Runware invoices:
   *   480p (496x864): $0.1431144 / 6s → $0.023852/s
   *   720p:           $0.3151728 / 6s → $0.052529/s
   * No-sound rate is from an earlier, unverified 4s test — left as-is.
   */
  "video:seedance15pro": {
    provider:   "runware",
    generator:  "Seedance 1.5 Pro",
    airTag:     "bytedance:seedance@1.5-pro",
    secret:     "RUNWARE_API_KEY",
    edgeFn:     "/functions/v1/runware-video",
    costPerSecondUSD:      0.052529,  // 720p, with audio — measured
    baseResolution:        "720p",
    retailMultiplier:      2,
    baseCreditsPerSecond:  2.5,       // no sound (unverified, earlier 4s test)
    soundCreditsPerSecond: 5.25,      // with sound, 720p — measured
  },

  /**
   * Seedance 2.0 Fast — audio is always included even though its Runware
   * schema has no audio toggle. Measured $0.364092/6s @ 480p (496x864).
   * Clay Rescue uses this for its sound-on path; its sound-off path remains
   * on Seedance 1.5 Pro.
   */
  "video:seedance20fast": {
    provider:   "runware",
    generator:  "Seedance 2.0 Fast",
    airTag:     "bytedance:seedance@2.0-fast",
    secret:     "RUNWARE_API_KEY",
    edgeFn:     "/functions/v1/runware-video",
    costPerSecondUSD:     0.060682,   // $0.364092 / 6s, measured @ 480p (496x864)
    baseResolution:       "480p",
    retailMultiplier:     2,
    baseCreditsPerSecond: 7,          // generic video-generator retail rate; audio is always included
  },

  "video:veo31fast": {
    provider:   "runware",
    generator:  "Veo 3.1 Fast",
    airTag:     "google:3@3",
    secret:     "RUNWARE_API_KEY",
    edgeFn:     "/functions/v1/runware-video",

    costPerSecondUSD:     0.15,         // $0.9 / 6s actual cost
    baseResolution:       "1080p",
    retailMultiplier:     2,
    baseCreditsPerSecond: 15,           // $0.9 × 2 / 6s / $0.02 = 15/s → 90 credits per 6s clip
  },

  "video:veo31lite": {
    provider:   "runware",
    generator:  "Veo 3.1 Lite",
    airTag:     "google:veo@3.1-lite",
    secret:     "RUNWARE_API_KEY",
    edgeFn:     "/functions/v1/runware-video",

    baseResolution:       "720p",
    retailMultiplier:     2,
    // With sound (generateAudio: true)  — confirmed $0.05/s → 5 credits/s
    soundCreditsPerSecond: 5,
    // Without sound (generateAudio: false) — confirmed $0.03/s → 3 credits/s
    baseCreditsPerSecond: 3,
  },

  /**
   * Vidu Q3-Turbo  —  text-to-video + image-to-video, includes audio
   * Resolution costs:
   * 540p  $0.034/s
   * 720p  $0.051/s
   * 1080p $0.068/s
   * Audio is always included (not a user toggle on this model).
   */
  "video:viduq3turbo": {
    provider:   "runware",              // must stay "runware" for job-worker guard
    generator:  "Vidu Q3 Turbo",
    airTag:     "vidu/q3-turbo",        // edge fn appends /text-to-video or /image-to-video
    secret:     "ATLASCLOUD_API_KEY",
    edgeFn:     "/functions/v1/runware-video-atlascloud",

    costPerSecondUSD:     0.034,
    resolutionCostPerSecondUSD: {
      "540p":  0.034,
      "720p":  0.051,
      "1080p": 0.068,
    },
    baseResolution:       "540p",
    retailMultiplier:     2.2,
    baseCreditsPerSecond: 4,            // $0.034 × 2.2 / $0.02 = 3.74 → 4
  },

  /* =======================================================
     PRODUCT PHOTOS (❌ DO NOT TOUCH – WORKING)
     ======================================================= */

  "product-photo": {
    provider: "runware",

    // Pipeline:
    // 1) RMBG v2.0 → clean cut-out
    // 2) FLUX.1 Kontext [max] → composite
    generator: "RMBG v2.0 → FLUX.1 Kontext [max]",

    airTag: "bfl:4@1",
    enhanceAirTag: "runware:110@1",

    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-product-photo",

    costUSD: 0.081,
    retailUSD: 0.20,
    credits: 12,
    margin: m(0.081, 0.20),
  },




};

/* ======================== HELPERS ======================== */

export const getProviderLink = (key: ToolKey) => KEY_LINKS[key];
