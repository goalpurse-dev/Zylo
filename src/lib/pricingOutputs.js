// src/lib/pricingOutputs.js
//
// Single source of truth for the pricing page's "what can you actually make
// with N credits" claims. Every viral-tool template has a different credit
// cost, so a flat "~25 AI videos" style claim is misleading — this file
// holds the real per-tool/per-length V2 credit costs plus each plan's
// monthly credit allotment, and the pricing page derives every displayed
// count from calculateCompleteOutputs() rather than hardcoding numbers.
//
// This is DISPLAY-ONLY data for the marketing pricing page. It does not
// drive Stripe checkout, subscriptions, credit allocation, or backend
// billing — those remain wherever they already live (src/pages/Pricing.jsx's
// PRICE_IDS, the profiles.credit_balance column, etc).

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

// V2 credit costs per complete output, per tool. "Complete output" always
// means one fully finished generation a user could actually post (all
// scenes/images/clips included), not a single image or clip fragment.
export const V2_OUTPUT_COSTS = {
  fruitStory: {
    name: "AI Fruit Story",
    hasAudio: true,
    options: [
      { label: "15 seconds", credits: 42 },
      { label: "30 seconds", credits: 70 },
      { label: "45 seconds", credits: 98 },
      { label: "60 seconds", credits: 140 },
    ],
  },

  clayRescue: {
    name: "Clay Rescue",
    hasAudio: false,
    options: [
      { label: "30 seconds", credits: 32 },
      { label: "45 seconds", credits: 48 },
    ],
  },

  faceAsmr: {
    name: "Face ASMR",
    hasAudio: false,
    options: [
      { label: "15 seconds", credits: 21 },
      { label: "30 seconds", credits: 42 },
      { label: "45 seconds", credits: 63 },
    ],
  },

  microCamera: {
    name: "Micro Camera Animal",
    hasAudio: false,
    options: [
      { label: "15 seconds", credits: 26 },
      { label: "30 seconds", credits: 50 },
    ],
  },

  nationalitySwap: {
    name: "Nationality Swap",
    hasAudio: true,
    options: [
      { label: "Complete video", credits: 16 },
    ],
  },

  cookingMatic: {
    name: "AI Cooking Matic",
    hasAudio: true,
    options: [
      { label: "Complete five-clip video", credits: 103 },
    ],
  },

  imageGenerator: {
    name: "Zyvo V2 Image Generator",
    type: "image",
    options: [
      { label: "One image", credits: 2 },
    ],
  },

  twoAmWorlds: {
    name: "2AM Worlds V2",
    type: "image",
    options: [
      { label: "One 1K image", credits: 5 },
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

/** Math.floor(planCredits / generationCredits), never negative/NaN. */
export function calculateCompleteOutputs(planCredits, generationCredits) {
  if (!planCredits || !generationCredits || generationCredits <= 0) {
    return 0;
  }
  return Math.floor(planCredits / generationCredits);
}

/** Complete-output count for one tool option, for one plan id. */
export function outputsForPlan(planId, toolKey, optionIndex = 0) {
  const plan = PRICING_PLANS[planId];
  const option = V2_OUTPUT_COSTS[toolKey]?.options?.[optionIndex];
  if (!plan || !option) return 0;
  return calculateCompleteOutputs(plan.credits, option.credits);
}

// The headline comparison used on the main pricing cards: AI Fruit Story V2
// at 30 seconds (70 credits/video, includes images + video clips + audio).
export const HEADLINE_TOOL_KEY = "fruitStory";
export const HEADLINE_OPTION_LABEL = "30 seconds";

export function headlineOutputsForPlan(planId) {
  const option = V2_OUTPUT_COSTS[HEADLINE_TOOL_KEY].options.find(
    (o) => o.label === HEADLINE_OPTION_LABEL
  );
  const plan = PRICING_PLANS[planId];
  if (!plan || !option) return 0;
  return calculateCompleteOutputs(plan.credits, option.credits);
}
