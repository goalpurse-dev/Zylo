// Client for the Long Form discovery-session safeguard AND its persistence.
// A session represents "this one Idea discovery / create-video session" —
// never the Video Project itself, and it IS the canonical server-side
// record of a generated Idea Discovery board (sessionStorage is now only a
// cache/pointer to this row, per the product decision that generated ideas
// must be a real generation, not just React state).
import { supabase } from "../../../lib/supabaseClient";
import { DEFAULT_DISCOVERY_STATE, GENERATE_STATUS } from "./discoverIdeas";

// Returns a real error code on failure instead of a bare null — this is
// what let a genuine, real-world failure here (most commonly the 8-new-
// sessions-per-hour cap during heavy manual testing/refreshing) go
// completely silent: the mount effect just gave up, draft.discoverySessionId
// stayed null forever, and every later Generate Ideas / Create Story Plan
// click sent an empty session id straight into generate-long-form-ideas'
// own "Missing discoverySessionId" validation — a real 400, correctly
// rejected by the backend, but with nothing upstream ever telling the user
// why. The fix is here (surface the reason, let the UI react), not in
// loosening that validation.
export async function createDiscoverySession() {
  const { data, error } = await supabase.functions.invoke("create-long-form-discovery-session", { body: {} });
  if (error || !data?.id) {
    const status = error?.context?.status;
    let body = null;
    try {
      body = error?.context && typeof error.context.json === "function" ? await error.context.json() : null;
    } catch {
      body = null;
    }
    return { ok: false, code: body?.code ?? (status === 429 ? "TOO_MANY_SESSIONS" : "SESSION_CREATE_FAILED") };
  }
  return { ok: true, id: data.id };
}

// Direct RLS-protected read (the session table has a SELECT policy for the
// owning user) — no edge function needed for this half; only writes are
// gated through one, since there is no INSERT/UPDATE policy by design.
export async function fetchDiscoverySession(discoverySessionId) {
  if (!discoverySessionId) return null;
  const { data, error } = await supabase.from("long_form_discovery_sessions").select("*").eq("id", discoverySessionId).maybeSingle();
  if (error || !data) return null;
  return data;
}

// Partial, whitelisted update of the caller's own session row. Fire-and-
// forget is fine for callers where losing one write to a flaky network just
// means a slightly stale restore next time, never a correctness problem
// (the real preview-job truth stays in the `jobs` table regardless).
export async function persistDiscoverySession(discoverySessionId, patch) {
  if (!discoverySessionId) return false;
  const { error } = await supabase.functions.invoke("update-long-form-discovery-session", {
    body: { discoverySessionId, patch },
  });
  return !error;
}

// Merges a server session row onto a base draft — used on mount when the
// session already has a saved board, so refresh/back restores the exact
// same ideas/images/selection/settings without regenerating anything. Only
// overrides the discovery-owned fields; anything the row doesn't track
// (e.g. in-flight generationStatus) stays whatever the base draft had.
export function applySessionRowToDraft(draft, row) {
  if (!row) return draft;
  const ideas = Array.isArray(row.ideas) ? row.ideas : [];
  const ideaBatches = Array.isArray(row.idea_batches) ? row.idea_batches : [];
  const selectedIdeaId = row.selected_idea_id ?? null;
  const selectedIdea = selectedIdeaId ? ideas.find((idea) => idea.id === selectedIdeaId) ?? draft.selectedIdea : draft.selectedIdea;

  return {
    ...draft,
    topic: row.topic ?? draft.topic,
    source: row.source === "discovery" ? "discovery" : row.source === "custom" ? "custom" : draft.source,
    ideaCategory: row.idea_category ?? draft.ideaCategory,
    ideaDirection: row.idea_direction ?? draft.ideaDirection,
    lengthMode: row.length_mode === "custom" ? "custom" : "auto",
    customLengthMinutes: row.custom_length_minutes ?? draft.customLengthMinutes,
    depthMode: row.depth_mode === "custom" ? "custom" : "auto",
    customExplanationDepth: row.custom_explanation_depth ?? draft.customExplanationDepth,
    selectedIdea,
    discovery: {
      ...DEFAULT_DISCOVERY_STATE,
      ...draft.discovery,
      ideas,
      ideaBatches,
      selectedIdeaId,
      ideaBatchesGenerated: row.idea_batches_generated ?? draft.discovery.ideaBatchesGenerated,
      nextGenerationAllowedAt: row.next_generation_allowed_at ?? null,
      generationStatus: ideas.length > 0 ? GENERATE_STATUS.IDEAS_READY : draft.discovery.generationStatus,
    },
  };
}
