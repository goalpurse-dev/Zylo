// Local, session-scoped draft for the Long Form "New Video" flow.
// Structured so this shape can be swapped for real project state (keyed by
// projectId, persisted server-side) once the Topic Understanding Engine lands.

import { DEFAULT_DISCOVERY_STATE } from "./discoverIdeas";

const DRAFT_KEY = "zyvo:long-form:draft:v6";

export const MIN_CUSTOM_LENGTH_MINUTES = 5;
export const MAX_CUSTOM_LENGTH_MINUTES = 20;
export const DEFAULT_CUSTOM_LENGTH_MINUTES = 10;
export const DEFAULT_CUSTOM_DEPTH = "balanced";

export const DEFAULT_IDEA_DRAFT = {
  topic: "",
  // Same settings semantics for BOTH "Start with a topic" and a selected
  // discovered idea — neither path locks in its own length/depth. Auto is
  // always the default; Custom is opt-in. See LengthDepthControls.jsx.
  lengthMode: "auto", // "auto" | "custom"
  customLengthMinutes: DEFAULT_CUSTOM_LENGTH_MINUTES,
  depthMode: "auto", // "auto" | "custom"
  customExplanationDepth: DEFAULT_CUSTOM_DEPTH, // "simple" | "balanced" | "deep"
  source: "custom", // "custom" | "discovery"
  ideaCategory: "all",
  ideaDirection: "high_curiosity",
  selectedIdea: null,
  // Stable id for "this one Idea discovery / create-video session" — not a
  // Video Project id. Created once (see discoverySession.js) and reused
  // across refresh/back/mode-switch/filter changes; only reset by an
  // intentional "Create New Video" from the lobby (see resetIdeaDraft).
  discoverySessionId: null,
  // Generated idea options for this session — never the Project itself.
  // Persisted here (not a separate storage key) so a refresh or a Back
  // navigation from Story restores the exact same batch instead of
  // silently regenerating (and re-billing) it.
  discovery: DEFAULT_DISCOVERY_STATE,
};

// v5 and earlier stored a single requestedLength ("auto"|"8-10"|"10-12"|"12-15")
// and explanationDepth ("auto"|"simple"|"balanced"|"deep") field each. Maps
// them onto the new lengthMode/depthMode + custom-value split so an
// in-progress draft (selected idea, discovery board, cooldown, everything)
// survives this schema change instead of being wiped.
const LENGTH_RANGE_MIDPOINTS = { "8-10": 9, "10-12": 11, "12-15": 13 };

function migrateLegacyLengthDepth(parsed) {
  const patch = {};

  if (parsed.lengthMode === undefined && typeof parsed.requestedLength === "string") {
    if (parsed.requestedLength === "auto") {
      patch.lengthMode = "auto";
    } else {
      patch.lengthMode = "custom";
      patch.customLengthMinutes = LENGTH_RANGE_MIDPOINTS[parsed.requestedLength] ?? DEFAULT_CUSTOM_LENGTH_MINUTES;
    }
  }

  if (parsed.depthMode === undefined && typeof parsed.explanationDepth === "string") {
    if (parsed.explanationDepth === "auto") {
      patch.depthMode = "auto";
    } else {
      patch.depthMode = "custom";
      patch.customExplanationDepth = ["simple", "balanced", "deep"].includes(parsed.explanationDepth)
        ? parsed.explanationDepth
        : DEFAULT_CUSTOM_DEPTH;
    }
  }

  return patch;
}

export function loadIdeaDraft() {
  if (typeof window === "undefined") return DEFAULT_IDEA_DRAFT;
  try {
    const saved = window.sessionStorage.getItem(DRAFT_KEY);
    if (!saved) return DEFAULT_IDEA_DRAFT;
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_IDEA_DRAFT,
      ...parsed,
      ...migrateLegacyLengthDepth(parsed),
      discovery: { ...DEFAULT_DISCOVERY_STATE, ...(parsed.discovery || {}) },
    };
  } catch {
    return DEFAULT_IDEA_DRAFT;
  }
}

export function saveIdeaDraft(draft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Best-effort only — the in-memory state on the page still works this session.
  }
}

// Clears the persisted draft entirely — the ONLY thing that should start a
// genuinely new discovery session (a fresh discoverySessionId gets created
// on the next /long-form/new mount, since draft.discoverySessionId is now
// null). Call this from the lobby's "Create New Video", never from a normal
// refresh/back navigation, which must keep reusing the existing session.
export function resetIdeaDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Best-effort — worst case the old draft (and its session) just gets reused.
  }
}

// What Story Plan actually receives once it exists: an explicit user Custom
// value always wins; Auto resolves to null/"auto" so a later Topic
// Understanding recommendation has room to decide instead of being
// overridden by a stale idea-time default.
export function resolveLengthDepth(draft) {
  return {
    targetLengthMinutes: draft.lengthMode === "custom" ? draft.customLengthMinutes : null,
    explanationDepth: draft.depthMode === "custom" ? draft.customExplanationDepth : "auto",
  };
}

export const LENGTH_MODE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "custom", label: "Custom" },
];

export const DEPTH_MODE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "custom", label: "Custom" },
];

export const CUSTOM_DEPTH_OPTIONS = [
  { value: "simple", label: "Simple", description: "Very accessible, minimal jargon, explained from fundamentals." },
  { value: "balanced", label: "Balanced", description: "Normal high-quality YouTube explainer depth with useful detail." },
  { value: "deep", label: "Deep", description: "More technical, detail-heavy treatment for viewers who want depth." },
];

// User-facing stages. Internal engine stages (FactGraph, Narrative Director,
// VisualBeat Engine, etc.) never surface here — they operate underneath
// whichever of these five stages is active.
export const LONG_FORM_STAGES = [
  { key: "idea", label: "Idea" },
  { key: "story", label: "Story" },
  { key: "look", label: "Look" },
  { key: "generate", label: "Generate" },
  { key: "edit", label: "Edit" },
];
