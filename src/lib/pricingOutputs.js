// src/lib/pricingOutputs.js
//
// Single source of truth for the pricing page's "what can you actually make
// with N credits" claims. Every viral-tool template has a different credit
// cost, so a flat "~25 AI videos" style claim is misleading — this file
// describes each tool's complete output and the pricing page derives every
// displayed count from calculateCompleteOutputs() rather than hardcoding
// numbers.
//
// Per-output credit costs are NOT kept here: they are computed from the
// server's price quotes (public.tool_prices, see usePricingOutputCosts) with
// each tool's own price items and formula, so the page always matches what
// the tool shows and charges. Long Form reads its per-minute tier prices from
// the same table (lib/longFormTiers). Plan credits are what the Stripe
// webhook grants (supabase/functions/_shared/stripePlanPrices.js; a test keeps
// the two equal).
//
// This is DISPLAY-ONLY data for the marketing pricing page. It does not
// drive Stripe checkout, subscriptions, credit allocation, or backend
// billing.

import { priceItems as fruitPriceItems, estimateStory as estimateFruitStory } from "../components/viral-tools/ai-fruit-story-v2/pricing/fruitV2Estimates";
import { buildFruitPriceItems, calcFruitStoryCredits, getFruitSceneCountForLength } from "../components/viral-tools/ai-fruit-story/api/fruitStoryApi";
import { PRICE_ITEMS as CLAY_PRICE_ITEMS, calcCredits as calcClayCredits, LENGTH_OPTIONS as CLAY_LENGTHS } from "../components/viral-tools/clay-rescue/api/clayRescueApi";
import { PRICE_ITEMS as FACE_PRICE_ITEMS, calcCredits as calcFaceCredits } from "../components/viral-tools/face-asmr/api/faceAsmrApi";
import { PRICE_ITEMS as MICRO_PRICE_ITEMS, calcCredits as calcMicroCredits, LENGTH_OPTIONS as MICRO_LENGTHS } from "../components/viral-tools/micro-camera-animal/api/microCameraAnimalApi";
import { PRICE_ITEMS as SWAP_PRICE_ITEMS, calcCredits as calcSwapCredits, DEFAULT_SCENE_COUNT as SWAP_SCENES } from "../components/viral-tools/footballer-nationality-swap/api/footballerNationalitySwapApi";
import { PRICE_ITEMS as COOKING_PRICE_ITEMS, calcVisualCredits as calcCookingVisualCredits } from "../components/viral-tools/ai-cooking-matic/api/cookingMaticApi";
import { PRICE_ITEMS as TWO_AM_PRICE_ITEMS } from "../components/viral-tools/two-am/api/twoAmApi";
import { imagePriceItem } from "./image-generator/pricing";
import { PLAN_CREDITS } from "../../supabase/functions/_shared/stripePlanPrices.js";
import { PLAN_ORDER, QUALITY_TIERS, secondsAdj, calculateCompleteOutputs } from "./pricingMath";

export {
  PLAN_ORDER, QUALITY_TIERS, TIER_MIN_PLAN, planRank, secondsAdj, calculateCompleteOutputs, recommendPlan,
  LONG_FORM_TIERS, LONG_FORM_LENGTHS, LONG_FORM_HEADLINE_MINUTES, longFormOutputs,
} from "./pricingMath";

export const PRICING_PLANS = {
  starter: { name: "Starter", credits: PLAN_CREDITS.starter, modelAccess: ["V2"] },
  pro: { name: "Pro", credits: PLAN_CREDITS.pro, modelAccess: ["V2", "V3"] },
  generative: { name: "Generative", credits: PLAN_CREDITS.generative, modelAccess: ["V2", "V3", "V4"] },
};

// Face ASMR's lengths live in its builder; scene counts mirror it.
const FACE_LENGTHS = [
  { label: "15 seconds", scenes: 3 },
  { label: "30 seconds", scenes: 6 },
  { label: "45 seconds", scenes: 9 },
];

const secondsLabel = (value) => `${parseInt(value, 10)} seconds`;
const FRUIT_V1_LENGTHS = ["15s", "30s", "45s", "60s"];

// Complete outputs, per tool. "Complete output" always means one fully
// finished generation a user could actually post (all scenes/images/clips
// included), not a single image or clip fragment. Each tool lists the price
// items it needs (quoted with a tool prefix) and each option computes its V2
// credits from those prices — `service` is Cooking Matic's per-plan fee.
// `finder` is the plan finder's unit: one output at the tool's usual length,
// priced per quality tier (tiers the tool doesn't have are left out).
export const V2_OUTPUT_COSTS = {
  // AI Fruit Story v2 at its live prices (image:fruit-story + video:fruit-story-v2/3/4):
  // scene pictures + about lengthSec of video, the same estimate its cost card shows.
  fruitStory: {
    name: "AI Fruit Story",
    hasAudio: true,
    priceItems: fruitPriceItems("9:16"),
    options: [20, 30, 60].map((lengthSec) => ({
      label: `${lengthSec} seconds`,
      credits: (p) => estimateFruitStory({ lengthSec, tierId: "v2", prices: p }).total,
    })),
    finder: {
      label: "AI Fruit TikToks", unit: `${secondsAdj(20)} AI Fruit Story videos`, short: "20 s",
      tiers: Object.fromEntries(QUALITY_TIERS.map((t) => [t, (p) => estimateFruitStory({ lengthSec: 20, tierId: t, prices: p }).total])),
    },
  },

  // The original AI Fruit Story (shown to everyone without the fruit_v2 flag
  // until the full rollout): 15–60 s, pictures + 6 s clips + portraits.
  fruitStoryV1: {
    name: "AI Fruit Story",
    hasAudio: true,
    priceItems: buildFruitPriceItems("9:16", "zyvo-v2"),
    options: FRUIT_V1_LENGTHS.map((length) => ({
      label: secondsLabel(length),
      credits: (p) => calcFruitStoryCredits(getFruitSceneCountForLength(length), "fruit-v2", p),
    })),
    finder: {
      label: "AI Fruit TikToks", unit: `${secondsAdj(30)} AI Fruit Story videos`, short: "30 s",
      tiers: Object.fromEntries(QUALITY_TIERS.map((t) => [t, (p) => calcFruitStoryCredits(getFruitSceneCountForLength("30s"), `fruit-${t}`, p)])),
    },
  },

  clayRescue: {
    name: "Clay Rescue",
    hasAudio: false,
    priceItems: CLAY_PRICE_ITEMS,
    options: CLAY_LENGTHS.map((opt) => ({
      label: secondsLabel(opt.value),
      credits: (p) => calcClayCredits(opt.scenes, "clay-v2", p),
    })),
    finder: {
      label: "Clay Rescue", unit: `${secondsAdj(30)} Clay Rescue videos`, short: "30 s",
      tiers: Object.fromEntries(QUALITY_TIERS.map((t) => [t, (p) => calcClayCredits(CLAY_LENGTHS[0].scenes, `clay-${t}`, p)])),
    },
  },

  faceAsmr: {
    name: "Face ASMR",
    hasAudio: false,
    priceItems: FACE_PRICE_ITEMS,
    options: FACE_LENGTHS.map((opt) => ({
      label: opt.label,
      credits: (p) => calcFaceCredits(opt.scenes, "face-v2", p),
    })),
    finder: {
      label: "Face ASMR", unit: `${secondsAdj(30)} Face ASMR videos`, short: "30 s",
      tiers: Object.fromEntries(QUALITY_TIERS.map((t) => [t, (p) => calcFaceCredits(FACE_LENGTHS[1].scenes, `face-${t}`, p)])),
    },
  },

  microCamera: {
    name: "Micro Camera Animal",
    hasAudio: false,
    priceItems: MICRO_PRICE_ITEMS,
    options: MICRO_LENGTHS.map((opt) => ({
      label: secondsLabel(opt.value),
      credits: (p) => calcMicroCredits(opt.scenes, "micro-v2", p),
    })),
    finder: {
      label: "Micro Camera Animal", unit: `${secondsAdj(30)} Micro Camera Animal videos`, short: "30 s",
      tiers: Object.fromEntries(QUALITY_TIERS.map((t) => [t, (p) => calcMicroCredits(MICRO_LENGTHS[1].scenes, `micro-${t}`, p)])),
    },
  },

  nationalitySwap: {
    name: "Kit Swap",
    hasAudio: true,
    priceItems: SWAP_PRICE_ITEMS,
    options: [
      { label: "Complete video", credits: (p) => calcSwapCredits(SWAP_SCENES, "footballer-v2", p) },
    ],
    finder: {
      label: "Kit Swap", unit: "Kit Swap videos", short: "video",
      tiers: Object.fromEntries(QUALITY_TIERS.map((t) => [t, (p) => calcSwapCredits(SWAP_SCENES, `footballer-${t}`, p)])),
    },
  },

  cookingMatic: {
    name: "AI Cooking Matic",
    hasAudio: true,
    priceItems: COOKING_PRICE_ITEMS,
    options: [
      {
        label: "Complete five-clip video",
        credits: (p, service) => {
          const visual = calcCookingVisualCredits(p);
          return visual == null || service == null ? null : visual + service;
        },
      },
    ],
  },

  imageGenerator: {
    name: "Zyvo V2 Image Generator",
    type: "image",
    priceItems: [imagePriceItem("image:juggernaut", "1:1", undefined, "image")],
    options: [
      { label: "One image", credits: (p) => p.image ?? null },
    ],
    finder: { label: "Images", unit: "Zyvo V2 images", short: "image", tiers: { v2: (p) => p.image ?? null } },
  },

  twoAmWorlds: {
    name: "2AM Worlds V2",
    type: "image",
    priceItems: TWO_AM_PRICE_ITEMS,
    options: [
      { label: "One 1K image", credits: (p) => p["twoam-v2"] ?? null },
    ],
  },
};

export const TOOL_ORDER = [
  "fruitStory",
  "fruitStoryV1",
  "clayRescue",
  "faceAsmr",
  "microCamera",
  "nationalitySwap",
  "cookingMatic",
  "imageGenerator",
  "twoAmWorlds",
];

/**
 * Which AI Fruit Story numbers a viewer sees: users with the fruit_v2 flag see
 * v2 (20 s, its live prices); everyone else, guests included, keeps the
 * original tool's numbers until the full rollout.
 */
export const fruitToolKey = (fruitV2) => (fruitV2 ? "fruitStory" : "fruitStoryV1");
/** The Fruit length used in headlines: v2's default 20 s, v1's default 30 s. */
export const fruitHeadline = (fruitV2) => (fruitV2 ? { key: "fruitStory", idx: 0, sec: 20 } : { key: "fruitStoryV1", idx: 1, sec: 30 });
/** Tool tabs for one viewer (only the Fruit version they'd get). */
export const toolOrderFor = (fruitV2) => TOOL_ORDER.filter((k) => k !== fruitToolKey(!fruitV2));

/** Every price item the page needs, ids prefixed "<tool>:" so tools can't collide. */
export const PRICING_PRICE_ITEMS = TOOL_ORDER.flatMap((toolKey) =>
  V2_OUTPUT_COSTS[toolKey].priceItems.map((item) => ({ ...item, id: `${toolKey}:${item.id}` })),
);

/**
 * Resolve every option's credits for every plan from quoted prices
 * ({ "<tool>:<id>": credits }) and Cooking Matic's per-plan service fee.
 * → { [toolKey]: [ { starter, pro, generative } per option ], finder: { [toolKey]: { v2, v3, v4 } } },
 * null where unknown.
 */
export function resolveOutputCosts(prices, serviceByPlan = {}) {
  const out = { finder: {} };
  for (const toolKey of TOOL_ORDER) {
    const tool = V2_OUTPUT_COSTS[toolKey];
    const prefix = `${toolKey}:`;
    const p = {};
    for (const [id, credits] of Object.entries(prices ?? {})) {
      if (id.startsWith(prefix)) p[id.slice(prefix.length)] = credits;
    }
    out[toolKey] = tool.options.map((option) =>
      Object.fromEntries(PLAN_ORDER.map((planId) => [planId, option.credits(p, serviceByPlan[planId])])),
    );
    if (tool.finder) {
      out.finder[toolKey] = Object.fromEntries(Object.entries(tool.finder.tiers).map(([tier, fn]) => [tier, fn(p) ?? null]));
    }
  }
  return out;
}

/** Credits for one tool option on one plan (from resolveOutputCosts), or null. */
export function creditsForPlan(costs, planId, toolKey, optionIndex = 0) {
  return costs?.[toolKey]?.[optionIndex]?.[planId] ?? null;
}

/** Complete-output count for one tool option, for one plan id; null until priced. */
export function outputsForPlan(costs, planId, toolKey, optionIndex = 0) {
  const plan = PRICING_PLANS[planId];
  const credits = creditsForPlan(costs, planId, toolKey, optionIndex);
  if (!plan || credits == null) return null;
  return calculateCompleteOutputs(plan.credits, credits);
}
