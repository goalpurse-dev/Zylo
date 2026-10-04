// Carries a "Try this prompt" selection from a blog CTA into a generator
// landing page without ever putting the prompt text in the URL. A prompt in
// the URL (e.g. /2am-worlds-ai-generator?prompt=...) is a real, distinct,
// crawlable URL as far as Google is concerned — every unique prompt text
// becomes its own near-duplicate indexable page. sessionStorage carries the
// same UX (the generator opens pre-filled) with zero URL footprint.
const STORAGE_KEY = "zyvo_prefill_prompt";

export function stashPrompt(text) {
  try { sessionStorage.setItem(STORAGE_KEY, String(text ?? "")); } catch { /* storage unavailable (private mode, etc.) — safe to no-op */ }
}

export function takeStashedPrompt() {
  if (typeof window === "undefined") return "";
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value) sessionStorage.removeItem(STORAGE_KEY);
    return value || "";
  } catch {
    return "";
  }
}

// AI Fruit Story "Make this video": the prompt plus the library character ids
// it names, read by the tool (ai-fruit-story-v2/hooks/useFruitV2Flow.js). Peek
// and clear are separate so the tool's state initializer stays pure.
const FRUIT_STORY_KEY = "zyvo_prefill_fruit_story";

export function stashFruitStory({ prompt, castIds = [] }) {
  try { sessionStorage.setItem(FRUIT_STORY_KEY, JSON.stringify({ prompt: String(prompt ?? ""), castIds })); } catch { /* storage unavailable — safe to no-op */ }
}

/** { prompt, castIds } or null. */
export function peekStashedFruitStory() {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(FRUIT_STORY_KEY) || "null");
    if (!value || typeof value.prompt !== "string" || !value.prompt.trim()) return null;
    return { prompt: value.prompt, castIds: Array.isArray(value.castIds) ? value.castIds.filter((id) => typeof id === "string") : [] };
  } catch {
    return null;
  }
}

export function clearStashedFruitStory() {
  try { sessionStorage.removeItem(FRUIT_STORY_KEY); } catch { /* storage unavailable */ }
}
