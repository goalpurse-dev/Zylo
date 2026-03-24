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


    /* ---------- VIDEO ---------- */
  | "video:klingaist"
  | "video:miniMaxFast"
  | "video:RunwayGen-4Turbo"



  /* ---------- PRODUCT PHOTOS (DO NOT TOUCH) ---------- */
  | "product-photo"


  

export type Provider = "runware";

export type ProviderLink = {
  provider: Provider;
  generator: string;
  airTag: string;
  secret: "RUNWARE_API_KEY";
  edgeFn: string;

  // 🔥 VIDEO PRICING CORE
  costPerSecondUSD?: number;
  baseResolution?: "720p" | "768p" |"1080p";
  retailMultiplier?: number; // your markup multiplier
  baseCreditsPerSecond?: number; // 🔥 NEW

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


    /* =======================================================
                              VIDEO 
     ======================================================= */

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
