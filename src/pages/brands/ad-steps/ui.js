// Small shared UI helpers & constants used by multiple steps
export const cn = (...a) => a.filter(Boolean).join(" ");
export const zyloGrad = "bg-gradient-to-r from-blue-600 to-purple-600";

export const TOTAL_DURATION = 8;     // hard cap 8s ad
export const MIN_SCENE_LEN = 2;      // min 2s / scene
export const MAX_SCENES = 4;
