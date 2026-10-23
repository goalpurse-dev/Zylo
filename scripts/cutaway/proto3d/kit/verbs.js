// M2 kit: animation verbs (easings measured in research/seamless-niche/ANIMATION_STUDY.md). Pure functions of time.
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** 0 before a, 1 after b, linear in between */
export const span = (t, a, b) => clamp01((t - a) / (b - a));
export const eOut = (x) => 1 - (1 - x) ** 3;
export const eIn = (x) => x * x;
export const eInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
export const eBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
/** pop in place with a small overshoot (0.15-0.35 s on the account) */
export const pop = (t, a, d = 0.35) => (t <= a ? 0 : t >= a + d ? 1 : eBack((t - a) / d));
/** on between a and b with soft edges (fade in/out of length f) */
export const window01 = (t, a, b, f = 0.25) => span(t, a - f / 2, a + f / 2) * (1 - span(t, b - f / 2, b + f / 2));
/** a quick light dip (0 → 1 → 0) for "time passes" or a storm flash */
export const dip = (t, a, d = 0.4) => Math.sin(Math.PI * span(t, a, a + d));
