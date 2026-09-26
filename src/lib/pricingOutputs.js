// src/lib/pricingOutputs.js
//
// Single source of truth for the pricing page's "what can you actually make
// with N credits" claims. Every viral-tool template has a different credit
// cost, so a flat "~25 AI videos" style claim is misleading — this file
// describes each tool's V2 complete output and the pricing page derives every
// displayed count from calculateCompleteOutputs() rather than hardcoding
// numbers.
//
// Per-output credit costs are NOT kept here: they are computed from the
// server's price quotes (public.tool_prices, see usePricingOutputCosts) with
// each tool's own price items and formula, so the page always matches what
// the tool shows and charges.
//
// This is DISPLAY-ONLY data for the marketing pricing page. It does not
// drive Stripe checkout, subscriptions, credit allocation, or backend
// billing — those remain wherever they already live (src/pages/Pricing.jsx's
// PRICE_IDS, the profiles.credit_balance column, etc).

import { buildFruitPriceItems, calcFruitStoryCredits, getFruitSceneCountForLength } from "../components/viral-tools/ai-fruit-story/api/fruitStoryApi";
import { PRICE_ITEMS as CLAY_PRICE_ITEMS, calcCredits as calcClayCredits, LENGTH_OPTIONS as CLAY_LENGTHS } from "../components/viral-tools/clay-rescue/api/clayRescueApi";
import { PRICE_ITEMS as FACE_PRICE_ITEMS, calcCredits as calcFaceCredits } from "../components/viral-tools/face-asmr/api/faceAsmrApi";
import { PRICE_ITEMS as MICRO_PRICE_ITEMS, calcCredits as calcMicroCredits, LENGTH_OPTIONS as MICRO_LENGTHS } from "../components/viral-tools/micro-camera-animal/api/microCameraAnimalApi";
import { PRICE_ITEMS as SWAP_PRICE_ITEMS, calcCredits as calcSwapCredits, DEFAULT_SCENE_COUNT as SWAP_SCENES } from "../components/viral-tools/footballer-nationality-swap/api/footballerNationalitySwapApi";
import { PRICE_ITEMS as COOKING_PRICE_ITEMS, calcVisualCredits as calcCookingVisualCredits } from "../components/viral-tools/ai-cooking-matic/api/cookingMaticApi";
import { PRICE_ITEMS as TWO_AM_PRICE_ITEMS } from "../components/viral-tools/two-am/api/twoAmApi";
import { imagePriceItem } from "./image-generator/pricing";

export const PRICING_PLANS = {
  starter: {
    name: "Starter",
    monthlyPrice: 20,
    annualMonthlyPrice: 16,
    annualTotal: 192,
    credits: 750,
    modelAccess: ["V2"],
  },
  pro: {
    name: "Pro",
    monthlyPrice: 42,
    annualMonthlyPrice: 35,
    annualTotal: 420,
    credits: 1600,
    modelAccess: ["V2", "V3"],
  },
  generative: {
    name: "Generative",
    monthlyPrice: 85,
    annualMonthlyPrice: 70,
    annualTotal: 840,
    credits: 3200,
    modelAccess: ["V2", "V3", "V4"],
  },
};

// Ordered so the pricing page can render plan columns/tabs in a stable order.
export const PLAN_ORDER = ["starter", "pro", "generative"];

// Face ASMR's lengths live in its builder; scene counts mirror it.
const FACE_LENGTHS = [
  { label: "15 seconds", scenes: 3 },
  { label: "30 seconds", scenes: 6 },
  { label: "45 seconds", scenes: 9 },
];

const secondsLabel = (value) => `${parseInt(value, 10)} seconds`;

// V2 complete outputs, per tool. "Complete output" always means one fully
// finished generation a user could actually post (all scenes/images/clips
// included), not a single image or clip fragment. Each tool lists the price
// items it needs (quoted with a tool prefix) and each option computes its
// credits from those prices — `service` is Cooking Matic's per-plan fee.
export const V2_OUTPUT_COSTS = {
  fruitStory: {
    name: "AI Fruit Story",
    hasAudio: true,
    priceItems: buildFruitPriceItems("9:16", "zyvo-v2"),
    options: ["15s", "30s", "45s", "60s"].map((length) => ({
      label: secondsLabel(length),
      credits: (p) => calcFruitStoryCredits(getFruitSceneCountForLength(length), "fruit-v2", p),
    })),
  },

  clayRescue: {
    name: "Clay Rescue",
    hasAudio: false,
    priceItems: CLAY_PRICE_ITEMS,
    options: CLAY_LENGTHS.map((opt) => ({
      label: secondsLabel(opt.value),
      credits: (p) => calcClayCredits(opt.scenes, "clay-v2", p),
    })),
  },

  faceAsmr: {
    name: "Face ASMR",
    hasAudio: false,
    priceItems: FACE_PRICE_ITEMS,
    options: FACE_LENGTHS.map((opt) => ({
      label: opt.label,
      credits: (p) => calcFaceCredits(opt.scenes, "face-v2", p),
    })),
  },

  microCamera: {
    name: "Micro Camera Animal",
    hasAudio: false,
    priceItems: MICRO_PRICE_ITEMS,
    options: MICRO_LENGTHS.map((opt) => ({
      label: secondsLabel(opt.value),
      credits: (p) => calcMicroCredits(opt.scenes, "micro-v2", p),
    })),
  },

  nationalitySwap: {
    name: "Nationality Swap",
    hasAudio: true,
    priceItems: SWAP_PRICE_ITEMS,
    options: [
      { label: "Complete video", credits: (p) => calcSwapCredits(SWAP_SCENES, "footballer-v2", p) },
    ],
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
  "clayRescue",
  "faceAsmr",
  "microCamera",
  "nationalitySwap",
  "cookingMatic",
  "imageGenerator",
  "twoAmWorlds",
];

/** Every price item the page needs, ids prefixed "<tool>:" so tools can't collide. */
export const PRICING_PRICE_ITEMS = TOOL_ORDER.flatMap((toolKey) =>
  V2_OUTPUT_COSTS[toolKey].priceItems.map((item) => ({ ...item, id: `${toolKey}:${item.id}` })),
);

/**
 * Resolve every option's credits for every plan from quoted prices
 * ({ "<tool>:<id>": credits }) and Cooking Matic's per-plan service fee.
 * → { [toolKey]: [ { starter, pro, generative } per option ] }, null where unknown.
 */
export function resolveOutputCosts(prices, serviceByPlan = {}) {
  const out = {};
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
  }
  return out;
}

/** Math.floor(planCredits / generationCredits), never negative/NaN. */
export function calculateCompleteOutputs(planCredits, generationCredits) {
  if (!planCredits || !generationCredits || generationCredits <= 0) {
    return 0;
  }
  return Math.floor(planCredits / generationCredits);
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

// The headline comparison used on the main pricing cards: AI Fruit Story V2
// at 30 seconds (includes images + video clips + audio).
export const HEADLINE_TOOL_KEY = "fruitStory";
export const HEADLINE_OPTION_LABEL = "30 seconds";
export const HEADLINE_OPTION_INDEX = V2_OUTPUT_COSTS[HEADLINE_TOOL_KEY].options.findIndex(
  (o) => o.label === HEADLINE_OPTION_LABEL,
);

export function headlineOutputsForPlan(costs, planId) {
  return outputsForPlan(costs, planId, HEADLINE_TOOL_KEY, HEADLINE_OPTION_INDEX);
}
