// src/lib/providers.ts
export type ToolKey =
  | "image-upscale:v2"
  | "t2i:v2"
  | "t2i:v3"
  | "t2i:v4"
  | "t2v:v2"
  | "t2v:v3"
  | "t2v:v4"
  | "ad-video:v4"
  | "ad-video:v5"
  | "product-photo"
  | "video-enhance:v1";

export type Provider = "runware";

export type ProviderLink = {
  provider: Provider;
  generator: string;
  airTag: string;                  // primary Runware AIR tag (step 1 for chains)
  secret: "RUNWARE_API_KEY";
  edgeFn: string;                  // Supabase Edge Function path
  costUSD: number;
  retailUSD: number;
  credits: number;                 // explicit @ $0.02/credit
  margin: number;                  // (retail - cost) / retail
  requiresFrame?: boolean;

  // optional secondary model for chained flows (used by product-photo)
  enhanceAirTag?: string;
};

const m = (costUSD: number, retailUSD: number) =>
  Number(((retailUSD - costUSD) / retailUSD).toFixed(2));

export const KEY_LINKS: Record<ToolKey, ProviderLink> = {
  /* ======================== IMAGES ======================== */

  "image-upscale:v2": {
    provider: "runware",
    generator: "FLUX.1 [dev] — Upscale",
    airTag: "runware:101@1",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",
    costUSD: 0.0038,
    retailUSD: 0.10,
    credits: 5,
    margin: m(0.0038, 0.10),
  },

  // v2 — runware:97@1
  "t2i:v2": {
    provider: "runware",
    generator: "Flux.1[schnell]",
    airTag: "runware:100@1",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",
    costUSD: 0.0013,  // adjust if you have exact
    retailUSD: 0.02,
    credits: 1,
    margin: m(0.0013, 0.02),
  },

  // v3 — bytedance:3@1
  "t2i:v3": {
    provider: "runware",
    generator: "ByteDance ImageGen v3",
    airTag: "bytedance:3@1",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",
    costUSD: 0.018,  // adjust if you have exact
    retailUSD: 0.04,
    credits: 2,
    margin: m(0.018, 0.08),
  },

  // v4 — Google Imagen 4
  "t2i:v4": {
    provider: "runware",
    generator: "Google Imagen 4",
    airTag: "google:2@2",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-image",
    costUSD: 0.06,
    retailUSD: 0.14,
    credits: 7,
    margin: m(0.06, 0.20),
  },


  /* ======================== VIDEO (TEXT → VIDEO) ======================== */

"t2v:v3": {
  provider: "runware",
  generator: "Seedance 1.0 Pro Fast",
  airTag: "bytedance:2@2",
  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-video-generate",

  // 5s @ 720p
  costUSD: 0.06738,          // Runware cost
  retailUSD: 0.12,           // 8 credits * $0.02
  credits: 6,
  margin: m(0.06738, 0.16),  // ≈ 57.9% margin

  requiresFrame: false,
},



"t2v:v4": {
  provider: "runware",
  generator: "Kling 2.5 Turbo Pro",
  airTag: "klingai:6@1",
  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-video-generate",
  costUSD: 0.35,
  retailUSD: 0.80,
  credits: 40,
  margin: m(0.35, 0.80),
  requiresFrame: false,
},

  /* ======================== AD VIDEO (versioned) ======================== */
"ad-video:v4": {
  provider: "runware",
  generator: "Seedance 1.0 Pro Fast",
  airTag: "bytedance:2@2",

  // v4 has NO avatar lipsync, NO avatar reference
  lipSyncAirTag: undefined,
  audioMuxAirTag: undefined,   // ❌ was "runware:muxer" — removed

  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-ad-video",

  // Seedance costs ~0.3177 for 10s → your 8s ~0.25–0.30
  costUSD: 0.30,
  retailUSD: 0.70,
  credits: 35,                 // 35 × $0.02 = $0.70
  requiresFrame: false,
},


"ad-video:v5": {
  provider: "runware",
  generator: "Veo 3.1 Fast",
  airTag: "google:3@3",

  // v5 = avatar mode unlocked
  lipSyncAirTag: "pixverse:lipsync@1",

  // NO AUDIO MUX MODEL EXISTS — remove
  audioMuxAirTag: undefined,

  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-ad-video",

  costUSD: 2.0,          // Veo Fast = $0.8 per 8s, + small overhead
  retailUSD: 4.0,
  credits: 200,          // 200 × $0.02 = $4
  requiresFrame: false,
},

  /* ======================== PRODUCT PHOTOS ======================== */


"product-photo": {
  provider: "runware",

  // Pipeline:
  // 1) RMBG v2.0 (runware:110@1) → clean product cut-out
  // 2) FLUX.1 Kontext [max] (bfl:4@1) → final composite using [bg, product-cutout]
  generator: "RMBG v2.0 → FLUX.1 Kontext [max]",

  // This airTag is what the UI / job-worker sees for the final gen step.
  airTag: "bfl:4@1",

  // Internal-only; edge function uses this directly.
  enhanceAirTag: "runware:110@1",

  secret: "RUNWARE_API_KEY",
  edgeFn: "/functions/v1/runware-product-photo",

  // Rough cost:
  // RMBG: ~0.0006 + FLUX Kontext max: 0.08 ≈ 0.0806
  costUSD: 0.081,

  retailUSD: 0.20,
  credits: 12,
  margin: m(0.081, 0.12),
},

  /* ======================== VIDEO ENHANCE ======================== */

  "video-enhance:v1": {
    provider: "runware",
    generator: "Kling 2.1 Pro — Enhance",
    airTag: "klingai:5@2",
    secret: "RUNWARE_API_KEY",
    edgeFn: "/functions/v1/runware-video-enhance",
    costUSD: 0.90,
    retailUSD: 2.20,
    credits: 110,
    margin: m(0.90, 2.20),
  },
};

/* Export helper */
export const getProviderLink = (key: ToolKey) => KEY_LINKS[key];
