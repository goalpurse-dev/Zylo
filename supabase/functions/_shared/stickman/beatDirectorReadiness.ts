// deno-lint-ignore-file no-explicit-any
// stickman/beatDirectorReadiness.ts — 2026-10-02 "real narration audio
// master timeline" pass, Section 15.
//
// The single object the (not-yet-built) Beat Director will consume so it
// never has to re-read or rediscover the episode's own identity. Pure
// assembly only — every field here is copied from already-persisted,
// already-frozen/ready artifacts; this function invents nothing and makes
// no provider call itself.
//
// Deliberately requires the CALLER to have already fetched project/profile/
// script/bible/narration rows (via the admin client) — this keeps the
// function itself synchronous, pure, and trivially unit-testable with fake
// rows, exactly like this session's other compile/merge functions.

export type BeatDirectorReadiness = {
  ready: boolean;
  missing: string[]; // human-readable list of what's not ready yet, when ready:false
  scriptVersionId: string | null;
  productionBibleVersionId: string | null;
  generationProfileId: string | null;
  narrationAudioVersionId: string | null;
  audioDurationSeconds: number | null;
  narration: { segmentId: string; text: string; startSeconds: number; endSeconds: number; words: { word: string; start: number; end: number }[] }[];
  productionBible: unknown | null;
  storyContext: { topic: string; viewerPromise: string; visualPremise: string | null; visualTone: string | null };
};

export function assembleBeatDirectorReadiness(input: {
  project: { topic?: string | null; selected_idea_title?: string | null; selected_idea_angle?: string | null } | null;
  generationProfile: { id: string } | null;
  scriptVersion: { id: string; script_document?: { narrationSegments?: { id: string; text: string }[] } } | null;
  productionBible: { id: string; bible_version: number; bible: any } | null;
  narrationAudio: { id: string; status: string; audio_duration_seconds: number | null; narration: any[] | null } | null;
}): BeatDirectorReadiness {
  const missing: string[] = [];
  if (!input.generationProfile) missing.push("No active Production Profile");
  if (!input.scriptVersion) missing.push("No script version");
  if (!input.productionBible) missing.push("Production Bible not yet frozen");
  if (!input.narrationAudio || input.narrationAudio.status !== "ready") missing.push("Narration audio not yet ready");

  const narrationRows = input.narrationAudio?.status === "ready" ? (input.narrationAudio.narration ?? []) : [];
  const segmentsById = new Map((input.scriptVersion?.script_document?.narrationSegments ?? []).map((s) => [s.id, s.text]));

  const narration = narrationRows.map((row: any) => ({
    segmentId: row.segmentId,
    text: segmentsById.get(row.segmentId) ?? "",
    startSeconds: row.startSeconds,
    endSeconds: row.endSeconds,
    words: row.words ?? [],
  }));

  return {
    ready: missing.length === 0,
    missing,
    scriptVersionId: input.scriptVersion?.id ?? null,
    productionBibleVersionId: input.productionBible?.id ?? null,
    generationProfileId: input.generationProfile?.id ?? null,
    narrationAudioVersionId: input.narrationAudio?.status === "ready" ? input.narrationAudio.id : null,
    audioDurationSeconds: input.narrationAudio?.status === "ready" ? input.narrationAudio.audio_duration_seconds : null,
    narration,
    productionBible: input.productionBible?.bible ?? null,
    storyContext: {
      topic: input.project?.topic ?? "",
      viewerPromise: [input.project?.selected_idea_title, input.project?.selected_idea_angle].filter(Boolean).join(" — "),
      visualPremise: input.productionBible?.bible?.visualPremise ?? null,
      visualTone: input.productionBible?.bible?.visualTone ?? null,
    },
  };
}
