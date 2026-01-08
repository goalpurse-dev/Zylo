// src/lib/pricing.ts
// Centralized credit pricing + helpers (ZyloAI_Credits_v1 -> v2 synced to providers)
// ONE CREDIT = $0.02 retail

// ---- money meta (for your pricing page only; not used in math) ----
export const CREDIT_RETAIL_USD = 0.02;      // user-facing overage price per credit
export const CREDIT_TARGET_COST_USD = 0.01; // internal blended target (incl. ~30% buffer)

// ---- shared enums / helpers -------------------------------------------------
export type Quality = "basic" | "pro" | "premium";
export type Resolution = "720p" | "1080p" | "4k";

export const QUALITY_MULTIPLIER: Record<Quality, number> = {
  basic: 1.0,
  pro: 1.3,
  premium: 1.8,
};

export const RESOLUTION_MULTIPLIER: Record<Resolution, number> = {
  "720p": 1.0,
  "1080p": 1.5,
  "4k": 3.0,
};

// Map UI tiers → quality (unchanged)
export const TIER_TO_QUALITY: Record<string, Quality> = {
  "zylo-v1": "basic",   // video entry tier (not used by text→image UI)
  "zylo-v2": "basic",
  "zylo-v3": "pro",
  "zylo-v4": "premium",
};

// --------------------------- Enhancements (aspect presets used in UI) -------
export const UPSCALE_PRICING = {
  image: {
    "1:1": 2,   // not used now, kept for compatibility
    "9:16": 3,
    "16:9": 3,
  },
  video1080p: {
    8: 6,
    16: 10,
    24: 15,
    30: 20,
  },
  video4k: {
    8: 10,
    16: 18,
    24: 26,
    30: 32,
  },
};

// Always whole credits, min 1
export const roundCredits = (n: number) => Math.max(1, Math.ceil(n));

// ---------------------------------------------------------------------------
// Enhancements (flat overrides / easy lookups) — SYNCED WITH providers.ts
// ---------------------------------------------------------------------------

// Image Upscale (flat) — retail $0.10 → 5 credits @ $0.02/credit
// Generator: FLUX.1 [dev]
export const IMAGE_UPSCALE_FLAT_RETAIL_USD = 0.10;
export const IMAGE_UPSCALE_FLAT_CREDITS = roundCredits(
  IMAGE_UPSCALE_FLAT_RETAIL_USD / CREDIT_RETAIL_USD
); // 5

// Video Enhance (flat) — retail $2.20 → 110 credits
// Generator: Kling 2.1 Pro — Enhance
export const VIDEO_ENHANCE_FLAT_RETAIL_USD = 2.20;
export const VIDEO_ENHANCE_FLAT_CREDITS = roundCredits(
  VIDEO_ENHANCE_FLAT_RETAIL_USD / CREDIT_RETAIL_USD
); // 110

// ---------------------------------------------------------------------------
// Text → Image tiered pricing (v2 / v3 / v4) — SYNCED WITH providers.ts
// ---------------------------------------------------------------------------

// v2 (Basic) — retail $0.04 → 2 credits
// Generator: Runware Model 97 (Std)
export const T2I_V2_RETAIL_USD = 0.04;
export const T2I_V2_CREDITS = roundCredits(T2I_V2_RETAIL_USD / CREDIT_RETAIL_USD); // 2

// v3 (Pro) — retail $0.08 → 4 credits
// Generator: ByteDance ImageGen v3
export const T2I_V3_RETAIL_USD = 0.08;
export const T2I_V3_CREDITS = roundCredits(T2I_V3_RETAIL_USD / CREDIT_RETAIL_USD); // 4

// v4 (Premium) — retail $0.20 → 10 credits
// Generator: Google Imagen 4
export const T2I_V4_RETAIL_USD = 0.20;
export const T2I_V4_CREDITS = roundCredits(T2I_V4_RETAIL_USD / CREDIT_RETAIL_USD); // 10

// ---------------------------------------------------------------------------
// Text → Video tiered pricing (v2 / v3 / v4) — SYNCED WITH providers.ts
// ---------------------------------------------------------------------------

// v2 (Basic) — retail $0.45 → 23 credits (≈5s clip)
export const T2V_V2_RETAIL_USD = 0.45;
export const T2V_V2_CREDITS = roundCredits(T2V_V2_RETAIL_USD / CREDIT_RETAIL_USD); // 23

// v3 (Pro) — retail $0.65 → 33 credits (≈5s clip)
export const T2V_V3_RETAIL_USD = 0.65;
export const T2V_V3_CREDITS = roundCredits(T2V_V3_RETAIL_USD / CREDIT_RETAIL_USD); // 33

// v4 (Premium) — retail $0.80 → 40 credits (≈8s clip)
export const T2V_V4_RETAIL_USD = 0.80;
export const T2V_V4_CREDITS = roundCredits(T2V_V4_RETAIL_USD / CREDIT_RETAIL_USD); // 40

// ---------------------------------------------------------------------------
// Ad Studio (Sora 2) — keep existing exports for compat (values unchanged here)
// ---------------------------------------------------------------------------

// Sora 2 (standard) — retail $2.00 → 100 credits at $0.02/credit
export const AD_SORA2_RETAIL_USD = 2.00;
export const AD_SORA2_CREDITS = roundCredits(AD_SORA2_RETAIL_USD / CREDIT_RETAIL_USD); // 100

// ---------------------------------------------------------------------------
// Product Photos — SYNCED WITH providers.ts (Flux Kontext $0.20)
// ---------------------------------------------------------------------------

export const PRODUCT_PHOTO_SEEDREAM_RETAIL_USD = 0.20;
export const PRODUCT_PHOTO_SEEDREAM_CREDITS = roundCredits(
  PRODUCT_PHOTO_SEEDREAM_RETAIL_USD / CREDIT_RETAIL_USD
); // 10

// ---- image helpers (area-based) --------------------------------------------
const BASE_SIZE = 1024; // baseline is 1024x1024
const BASE_AREA = BASE_SIZE * BASE_SIZE;

/** Parse strings like "1080x1920", "1536×1536", "2048x1152 (16:9)" → [w,h] */
export function parseSize(size: string): [number, number] {
  const s = (size || "").toLowerCase();
  const m = s.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/);
  if (!m) return [BASE_SIZE, BASE_SIZE];
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return [BASE_SIZE, BASE_SIZE];
  }
  return [w, h];
}

/** Area multiplier vs 1024² */
export function imageSizeMultiplier(size: string): number {
  const [w, h] = parseSize(size);
  return (w * h) / BASE_AREA;
}

// ---- IMAGES -----------------------------------------------------------------
// Baselines per 1024² to keep margins safe: v2=2, v3=4, v4=10 credits.
const IMAGE_BASE_BY_QUALITY: Record<Quality, number> = {
  basic: 2,   // maps to v2 pricing @ 1024²
  pro: 4,     // maps to v3 pricing @ 1024²
  premium: 10 // maps to v4 pricing @ 1024²
};

// Text→Image
export function creditsForImage(opts: { quality: Quality; size: string }) {
  const { quality, size } = opts;
  const base = IMAGE_BASE_BY_QUALITY[quality];
  return roundCredits(base * imageSizeMultiplier(size));
}

// Thumbnail (from text or user image) – includes minor upscale/templating
export function creditsForThumbnail(_: { quality?: Quality; size?: string }) {
  return 1;
}

// Logo options (raster previews + SVG vectorization)
export function creditsForLogo(optionsCount: 1 | 3 | 5) {
  if (optionsCount === 1) return 1;
  if (optionsCount === 3) return 2;
  return 3; // 5 options
}

// IRL photo → AI-styled (same schedule as Text→Image)
export function creditsForIrlPhoto(opts: { quality: Quality; size: string }) {
  return creditsForImage(opts);
}

// HD Upscaler (→2K/4K). Premium path → 2 credits.
export function creditsForUpscale(quality: Quality) {
  return quality === "pro" || quality === "premium" ? 2 : 1;
}

// Brand-consistent image (inject brand style/LoRA/IP-Adapter)
export function creditsForBrandImage(opts: { quality: Quality; size: string }) {
  return creditsForImage(opts);
}

// ---- VIDEO & AVATAR ---------------------------------------------------------
// Legacy per-sec rates (kept for non-text2video tools)
const RATE_AVATAR_AD_PER_SEC = 41 / 30;  // ≈ 1.3667  (D-ID/HeyGen + TTS)
const RATE_T2V_PER_SEC = 6.5;            // text→video (legacy)
const RATE_REDDIT_EDIT_PER_SEC = 5 / 60; // template edit/captions only
const RATE_TTS_BASIC_PER_SEC = 4 / 60;   // Google TTS
const RATE_TTS_PRO_PER_SEC = 8 / 60;     // ElevenLabs (premium voices)

// Talking-head avatar ad (voice + lipsync)
export function creditsForAdsWithAvatar(opts: {
  seconds: number;
  quality?: Quality;
  resolution?: Resolution;
}) {
  const sec = Math.max(1, Math.ceil(opts.seconds));
  const q = opts.quality ?? "basic";
  const r = opts.resolution ?? "720p";
  const raw = RATE_AVATAR_AD_PER_SEC * sec * RESOLUTION_MULTIPLIER[r] * QUALITY_MULTIPLIER[q];
  return roundCredits(raw);
}

// Generic text→video (per-sec) — still used by some tools like brandVideo
export function creditsForVideo3dUGC(opts: {
  seconds: number;
  quality?: Quality;
  resolution?: Resolution;
}) {
  const sec = Math.max(1, Math.ceil(opts.seconds));
  const q = opts.quality ?? "basic";
  const r = opts.resolution ?? "720p";
  const raw = RATE_T2V_PER_SEC * sec * RESOLUTION_MULTIPLIER[r] * QUALITY_MULTIPLIER[q];
  return roundCredits(raw);
}

// Cartoon styles → same as 3D/styled
export const creditsForCartoonVideo = creditsForVideo3dUGC;

// Reddit-style narration (template edit only; optional avatar overlay)
export function creditsForRedditVideo(opts: {
  seconds: number;
  includeAvatarOverlay?: boolean;
  quality?: Quality;
  resolution?: Resolution;
}) {
  const sec = Math.max(1, Math.ceil(opts.seconds));
  const base = roundCredits(RATE_REDDIT_EDIT_PER_SEC * sec); // editing/captions
  if (!opts.includeAvatarOverlay) return base;
  const q = opts.quality ?? "basic";
  const r = opts.resolution ?? "720p";
  const overlay = roundCredits(
    RATE_AVATAR_AD_PER_SEC * sec * RESOLUTION_MULTIPLIER[r] * QUALITY_MULTIPLIER[q]
  );
  return base + overlay;
}

// Chat-bubble video with TTS only
export function creditsForTextSpeaker(opts: { seconds: number; quality?: Quality }) {
  const sec = Math.max(1, Math.ceil(opts.seconds));
  const q = opts.quality ?? "basic";
  const rate = q === "pro" || q === "premium" ? RATE_TTS_PRO_PER_SEC : RATE_TTS_BASIC_PER_SEC;
  return roundCredits(rate * sec);
}

// 60s auto story (images + voice + edit)
export function creditsForCartoonStory60s(quality: Quality) {
  return quality === "pro" || quality === "premium" ? 45 : 10;
}

// Brand-consistent T2V (same as 3D/styled)
export const creditsForBrandVideo = creditsForVideo3dUGC;

// ---- LLM / TTS / STT --------------------------------------------------------
export function creditsForScript() {
  return 1; // script_to_ugc_ad per spec (4o-mini class LLM)
}

// Generic TTS
export function creditsForTTS(opts: { seconds: number; quality?: Quality }) {
  const sec = Math.max(1, Math.ceil(opts.seconds));
  const q = opts.quality ?? "basic";
  const rate = q === "pro" || q === "premium" ? RATE_TTS_PRO_PER_SEC : RATE_TTS_BASIC_PER_SEC;
  return roundCredits(rate * sec);
}

// Brand voice TTS (wrapper; lets UI pick brand default voice tier)
export function creditsForBrandVoiceTTS(opts: { seconds: number; premiumVoice?: boolean }) {
  return creditsForTTS({ seconds: opts.seconds, quality: opts.premiumVoice ? "pro" : "basic" });
}

// STT (per started minute)
export function creditsForSTT(seconds: number) {
  const minutesStarted = Math.max(1, Math.ceil(seconds / 60));
  return roundCredits(minutesStarted * 1); // Deepgram-class costing
}

// ---- GIFs -------------------------------------------------------------------
export function creditsForGifCreatorHQ(seconds: number) {
  const s = Math.max(1, Math.ceil(seconds));
  if (s <= 10) return 2;
  const extra = Math.ceil((s - 10) / 5); // each extra 5s → +1
  return 2 + extra;
}

export function creditsForGif3DSpin(mode: "pseudo_3d" | "true_3d") {
  return mode === "true_3d" ? 25 : 5;
}

// ---- E-COMMERCE PRODUCT IMAGES ---------------------------------------------
export function creditsForProductPhotosAutogen(opts: {
  pack: "basic_pack" | "pro_pack";
  extraImages?: number; // optional extras (+3 credits each)
}) {
  const base = opts.pack === "pro_pack" ? 40 : 20;
  const extras = Math.max(0, Math.floor(opts.extraImages ?? 0)) * 3;
  return base + extras;
}

/* ============================================================================
   VIDEO (TIERED, DURATION-BASED) — per your provider costs & retail mapping
   ========================================================================== */

// Flat, legacy per-tier price (kept for backward-compat fallbacks)
export const VIDEO_TIER_FIXED_PRICE: Record<Tier, number> = {
  "zylo-v1": 15,
  "zylo-v2": 40,
  "zylo-v3": 100,
  "zylo-v4": 250,
};

// NEW: Duration-specific pricing (credits) — matches new retail
// v2: 5s → $0.45 (23 cr)
// v3: 5s → $0.65 (33 cr)
// v4: 8s → $0.80 (40 cr)
export const VIDEO_TIER_DURATION_CREDITS: Record<Tier, Record<number, number>> = {
  "zylo-v1": { 5: 10, 8: 16, 12: 20 }, // unchanged fallback
  "zylo-v2": { 5: T2V_V2_CREDITS },
  "zylo-v3": { 5: T2V_V3_CREDITS },
  "zylo-v4": { 8: T2V_V4_CREDITS },
};

export type JobType =
  | "image"
  | "brandImage"
  | "thumbnail"
  | "logo"
  | "irl"
  | "upscaler"
  | "video"
  | "brandVideo"
  | "avatarAd"
  | "reddit"
  | "textSpeaker"
  | "cartoonStory60"
  | "gif"
  | "gifSpin"
  | "productPhotos"
  | "script"
  | "tts"
  | "stt";

// NOTE: for VIDEO we support v1–v4; Text→Image UI still uses v2–v4 only.
export type Tier = "zylo-v1" | "zylo-v2" | "zylo-v3" | "zylo-v4";

export type EstimateArgs = {
  type: JobType;
  tier: Tier;
  // video knobs
  durationSec?: number;
  resolution?: Resolution;
  // image knobs
  size?: string;
  variants?: number; // logo options count
  // brand voice
  premiumVoice?: boolean;
  // gifs & ecommerce
  gifMode?: "pseudo_3d" | "true_3d";
  pack?: "basic_pack" | "pro_pack";
  extraImages?: number;
};

function tierToQuality(tier: Tier): Quality {
  return TIER_TO_QUALITY[tier] ?? "basic";
}

// helper: minimal configured duration per tier (if caller doesn't pass one)
function minDurationForTier(tier: Tier): number {
  const table = VIDEO_TIER_DURATION_CREDITS[tier];
  if (!table) return 5;
  const keys = Object.keys(table)
    .map((k) => parseInt(k, 10))
    .filter(Number.isFinite);
  return keys.length ? Math.min(...keys) : 5;
}

export function creditsForTextToVideoFixed(tier: Tier) {
  return VIDEO_TIER_FIXED_PRICE[tier] ?? 15;
}

// NEW: duration-aware video pricing (prefers duration table; falls back to flat)
export function creditsForTextToVideo(a: { tier: Tier; seconds?: number }) {
  const table = VIDEO_TIER_DURATION_CREDITS[a.tier];
  const sec = Math.max(1, Math.ceil(a.seconds ?? minDurationForTier(a.tier)));
  if (table && table[sec] != null) return table[sec];
  return creditsForTextToVideoFixed(a.tier);
}

/* ============================================================================
   Aggregator & exported estimator
   ========================================================================== */

export function estimateCredits(a: EstimateArgs): number {
  const quality = tierToQuality(a.tier);

  switch (a.type) {
    case "image": {
      const size = a.size ?? "1024x1024";
      return creditsForImage({ quality, size });
    }
    case "brandImage": {
      const size = a.size ?? "1024x1024";
      return creditsForBrandImage({ quality, size });
    }
    case "thumbnail": {
      return creditsForThumbnail({});
    }
    case "logo": {
      const n = (a.variants as 1 | 3 | 5) ?? 1;
      return creditsForLogo(n);
    }
    case "irl": {
      const size = a.size ?? "1024x1024";
      return creditsForIrlPhoto({ quality, size });
    }
    case "upscaler": {
      return creditsForUpscale(quality);
    }
    case "video": {
      // Use duration-based pricing when available; fallback to flat
      return creditsForTextToVideo({ tier: a.tier, seconds: a.durationSec });
    }
    case "brandVideo": {
      const sec = Math.max(1, Math.ceil(a.durationSec ?? 15));
      const res = a.resolution ?? "720p";
      return creditsForBrandVideo({ seconds: sec, quality, resolution: res });
    }
    case "avatarAd": {
      const sec = Math.max(1, Math.ceil(a.durationSec ?? 30));
      const res = a.resolution ?? "720p";
      return creditsForAdsWithAvatar({ seconds: sec, quality, resolution: res });
    }
    case "reddit": {
      const sec = Math.max(1, Math.ceil(a.durationSec ?? 60));
      return creditsForRedditVideo({ seconds: sec });
    }
    case "textSpeaker": {
      const sec = Math.max(1, Math.ceil(a.durationSec ?? 60));
      return creditsForTextSpeaker({ seconds: sec, quality });
    }
    case "cartoonStory60": {
      return creditsForCartoonStory60s(quality);
    }
    case "gif": {
      const sec = Math.max(1, Math.ceil(a.durationSec ?? 5));
      return creditsForGifCreatorHQ(sec);
    }
    case "gifSpin": {
      const mode = a.gifMode ?? "pseudo_3d";
      return creditsForGif3DSpin(mode);
    }
    case "productPhotos": {
      const pack = a.pack ?? "basic_pack";
      return creditsForProductPhotosAutogen({ pack, extraImages: a.extraImages });
    }
    case "script": {
      return creditsForScript();
    }
    case "tts": {
      const sec = Math.max(1, Math.ceil(a.durationSec ?? 60));
      return creditsForBrandVoiceTTS({ seconds: sec, premiumVoice: a.premiumVoice });
    }
    case "stt": {
      const sec = Math.max(1, Math.ceil(a.durationSec ?? 60));
      return creditsForSTT(sec);
    }
    default:
      return 1;
  }
}
