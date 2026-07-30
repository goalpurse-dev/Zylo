const STORAGE_KEY = "zyvo:seo-generation-draft";
const MAX_AGE_MS = 30 * 60 * 1000;

export function saveSeoDraft({ templateId, prompt, source }) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ templateId, prompt, source, timestamp: Date.now() }),
    );
  } catch {
    // sessionStorage may be unavailable (privacy mode, quota) — draft simply won't persist.
  }
}

function readValidDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft?.templateId || Date.now() - draft.timestamp > MAX_AGE_MS) return null;
    return draft;
  } catch {
    return null;
  }
}

/** Read the pending draft without clearing it. */
export function peekSeoDraft() {
  return readValidDraft();
}

/** Read and clear the pending draft, scoped to a specific template. */
export function consumeSeoDraft(templateId) {
  const draft = readValidDraft();
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (!draft || draft.templateId !== templateId) return "";
  return draft.prompt || "";
}
