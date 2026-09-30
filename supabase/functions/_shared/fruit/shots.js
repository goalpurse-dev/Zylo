// Camera shots for AI Fruit Story v2. Every scene has a spoken line, so the
// speaker's face must be large for lip sync: close-up, medium close-up or
// chest-up only. Wide and over-the-shoulder are gone (the 30 s story drew an
// over-the-shoulder listener as a human, and wide shots shrink the mouth).
export const SPEAKING_SHOTS = ["close-up", "medium close-up", "chest-up"];
/** Older rows may still carry these; the builders treat them as chest-up. */
export const LEGACY_SHOTS = ["medium two-shot", "over-the-shoulder", "wide"];
export const shotOf = (shot) => (SPEAKING_SHOTS.includes(shot) ? shot : "chest-up");
