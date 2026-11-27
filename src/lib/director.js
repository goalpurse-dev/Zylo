// The site's calls to the Director (supabase/functions/director-api): plan, change, save, list, get, delete. Always
// with the user's own login. Local dev with ?mock=1 only (import.meta.env.DEV is false in every build): an in-browser
// fake answers instead (directorMock.js), so the pages can be checked on localhost with no model call and no account.
import { supabase } from "./supabaseClient";

const BASE = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "")}/functions/v1/director-api`;
export const DIRECTOR_MOCK = Boolean(import.meta.env?.DEV) && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mock") === "1";

export class DirectorError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

async function call(action, body = {}) {
  if (DIRECTOR_MOCK) {
    const { mockDirector } = await import("./directorMock.js");
    return mockDirector(action, body);
  }
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new DirectorError("SIGN_IN", "Sign in to plan a video.");
  let res;
  try {
    res = await fetch(BASE, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
  } catch {
    throw new DirectorError("NETWORK", "We couldn't reach Zyvo. Check your connection and try again.");
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new DirectorError(out?.code ?? "SERVER", out?.error ?? "Something went wrong on our side.", out ?? {});
  return out;
}

/** "Plan my video": { styleId, studioId, idea, lengthSec, format, extras } -> { draft } */
export const planVideo = (input) => call("plan", input);
/** the chat box / quick chips: { draftId, ask } -> { draft, reply } */
export const reviseDraft = (draftId, ask) => call("revise", { draftId, ask });
/** the user's own edits: { draftId, title, hook, scenes, lengthSec?, format? } -> { draft } */
export const saveDraft = (draftId, patch) => call("save", { draftId, ...patch });
export const getDraft = (draftId) => call("get", { draftId });
export const listDrafts = () => call("list");
export const deleteDraft = (draftId) => call("delete", { draftId });
/** "Make it on Zyvo" / "Make it with your Claude" chosen: { draftId, where } */
export const markSent = (draftId, where, resultUrl = null) => call("sent", { draftId, where, resultUrl });
