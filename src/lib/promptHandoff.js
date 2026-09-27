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
