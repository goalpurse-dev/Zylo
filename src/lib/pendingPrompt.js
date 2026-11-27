// A guest typed an idea on Home and pressed send: the text waits on this device while they sign up, and the tool
// (Maestro, Create or Quick Generate) picks it up the first time it opens after that. Kept for one hour.
// Read with peekPendingPrompt (safe in a useState initializer, which React may call twice), then clearPendingPrompt
// in an effect.
const KEY = "zyvo:pending-prompt";
const TTL_MS = 60 * 60 * 1000;

export function savePendingPrompt(tool, text) {
  try { localStorage.setItem(KEY, JSON.stringify({ tool, text: String(text ?? "").slice(0, 2000), at: Date.now() })); } catch { /* no storage */ }
}

/** the waiting text for this tool ("maestro" | "create" | "quick"), or "" */
export function peekPendingPrompt(tool) {
  try {
    if (typeof window === "undefined") return "";
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!p || p.tool !== tool || !(Date.now() - Number(p.at) < TTL_MS)) return "";
    return String(p.text ?? "");
  } catch { return ""; }
}

export function clearPendingPrompt(tool) {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (p?.tool === tool) localStorage.removeItem(KEY); } catch { /* no storage */ }
}
