// Data shape + state machine for the "Discover ideas" results grid.
// Idea text comes from the real backend — see ideaEngine.js (client) and
// supabase/functions/generate-long-form-ideas (server). Concept preview
// images come from previewJobs.js.

// Generation preferences sent to the future Idea Discovery Engine.
// "all" / high-level directions are signals, never hard constraints —
// the engine must stay free to return ideas outside this taxonomy.
export const IDEA_CATEGORY_OPTIONS = [
  { value: "all", label: "All topics" },
  { value: "history", label: "History" },
  { value: "science", label: "Science" },
  { value: "technology", label: "Technology" },
  { value: "business_economics", label: "Business & Economics" },
  { value: "engineering", label: "Engineering" },
  { value: "geography_culture", label: "Geography & Culture" },
  { value: "nature_biology", label: "Nature & Biology" },
  { value: "space", label: "Space" },
  { value: "society_psychology", label: "Society & Psychology" },
  { value: "survival_extreme", label: "Survival & Extreme" },
];

// Descriptions are UI guidance only, shown in the LongFormSelect dropdown —
// the stored values are the plain enum-like strings above/below.
export const IDEA_DIRECTION_OPTIONS = [
  { value: "high_curiosity", label: "High curiosity", description: "Strong questions, mysteries and curiosity gaps" },
  { value: "evergreen", label: "Evergreen", description: "Timeless topics with long-term appeal" },
  { value: "unexpected", label: "Unexpected", description: "Surprising angles people don't usually think about" },
  { value: "story_driven", label: "Story-driven", description: "Ideas built around compelling narratives" },
  { value: "educational", label: "Educational", description: "Clear concepts designed to teach something useful" },
  { value: "deep_dive", label: "Deep dive", description: "More detailed and specialized subject exploration" },
  { value: "broad_appeal", label: "Broad appeal", description: "Accessible ideas designed for a wide audience" },
];

// Per-idea concept preview image lifecycle. Each idea's preview resolves
// independently of the others and independently of the idea text itself —
// one preview failing must never affect its idea or any other card.
export const PREVIEW_STATUS = {
  PENDING: "pending",
  GENERATING: "generating",
  READY: "ready",
  FAILED: "failed",
};

// Overall "Generate Ideas" panel state — drives the button/empty-state copy.
// Text ideas land at IDEAS_READY as soon as the (future) idea model returns;
// GENERATING only covers that first text pass, never the preview images.
export const GENERATE_STATUS = {
  IDLE: "idle",
  GENERATING_IDEAS: "generating_ideas",
  IDEAS_READY: "ideas_ready",
  ERROR: "error",
};

/**
 * Frontend idea result shape (backend scoring/metadata comes later):
 *
 * {
 *   id: string,
 *   title: string,            // working video title
 *   topic: string,            // canonical topic handed to Story Plan on selection
 *   angle: string,            // one-line viewer promise / hook, shown to the user
 *   visualDirection: string,  // internal-only: WHAT the concept preview should show (never just the title)
 *   category: string,         // one of IDEA_CATEGORY_OPTIONS values (best-guess, may differ from the request)
 *   direction: string,        // one of IDEA_DIRECTION_OPTIONS values
 *   narrativeArchetype: string | undefined, // internal only — not rendered anywhere; a future Narrative Director's input, not decoration
 *   conceptPreview: {
 *     status: PREVIEW_STATUS,
 *     imageUrl: string | null,
 *     jobId: string | null,   // real `jobs` table id once submitted — hydration resumes this id, never resubmits
 *   },
 * }
 *
 * Deliberately NOT called "thumbnail" — this is a cheap concept preview to
 * help a creator imagine the video, not the final YouTube thumbnail (that's
 * a separate, later Thumbnail Generator tool).
 */
export function createIdea({ id, title, topic, angle, visualDirection, category, direction, narrativeArchetype }) {
  return {
    id,
    title,
    topic: topic ?? title,
    angle,
    visualDirection: visualDirection ?? angle,
    category,
    narrativeArchetype,
    direction,
    conceptPreview: { status: PREVIEW_STATUS.PENDING, imageUrl: null, jobId: null },
  };
}

// Discovery session state — persisted inside the Long Form draft (see
// state.js). This is a temporary set of generated options for creating a
// project, never the project itself: a Project only gets created once the
// user commits via "Create Story Plan".
export const DEFAULT_DISCOVERY_STATE = {
  batchId: null,
  generationStatus: GENERATE_STATUS.IDLE,
  ideas: [],
  // The uncapped, append-only history of every "Generate Ideas"/"Generate
  // 10 More" click this session: [{ batchId, createdAt, ideas }]. `ideas`
  // above stays the capped/visible working list (MAX_VISIBLE_IDEAS) exactly
  // as before — this exists so an early batch is never unrecoverable just
  // because later generations pushed it out of the visible cap.
  ideaBatches: [],
  selectedIdeaId: null,
  createdAt: null,
  // Mirrors the backend's per-batch response (generate-long-form-ideas) —
  // the free-batch safeguard. nextGenerationAllowedAt is always a server
  // timestamp, never computed client-side; the backend is the sole
  // authority on whether a batch is actually allowed.
  ideaBatchesGenerated: 0,
  nextGenerationAllowedAt: null,
};

// Guard against an unbounded, ever-growing results screen while still
// honoring "Generate 10 More" as an append rather than a destructive
// replace (the user may still want an idea from an earlier batch).
export const MAX_VISIBLE_IDEAS = 30;
