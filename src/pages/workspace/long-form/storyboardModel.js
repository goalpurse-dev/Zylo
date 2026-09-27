export const SHOTS = { WIDE: "Wide", MEDIUM: "Medium", CLOSE: "Close-up", DETAIL: "Detail", INSERT: "Insert" };
export const TYPES = { STORY_ILLUSTRATION: "Scene", ENVIRONMENT: "Environment", CHARACTER: "Character", OBJECT_DETAIL: "Detail", DIAGRAM: "Diagram", MAP: "Map", COMPARISON: "Comparison", CUTAWAY: "Cutaway", TIMELINE: "Timeline", PROGRAMMATIC_GRAPHIC: "Text / Graphic" };
export const CATEGORIES = { CHARACTER: "Characters", LOCATION: "Locations", IMPORTANT_OBJECT: "Important objects", VEHICLE_MACHINE: "Vehicles", DIAGRAM_SUBJECT: "Diagram subjects" };
export function generationState(row) {
  if (!row?.id) return "creating";
  if (row.status === "ready") return "ready";
  if (row.status === "failed") return "failed";
  return row.workflow_started_at || row.stage_started_at ? "directing" : "starting";
}
export function beatBadge(beat) {
  if (["DIAGRAM", "MAP", "COMPARISON", "PROGRAMMATIC_GRAPHIC", "TIMELINE"].includes(beat.visualType)) return TYPES[beat.visualType];
  if (beat.shotStrategy === "REUSE_WITH_DELTA") return "Reuse scene";
  if (["INSERT", "DETAIL"].includes(beat.shotStrategy) || beat.visualType === "OBJECT_DETAIL") return "Detail";
  return "New scene";
}
export function timeRange(beat) {
  const format = (seconds) => `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, "0")}`;
  return `${format(beat.estimatedStartSeconds)}–${format(beat.estimatedEndSeconds)}`;
}
export function storyboardStats(row) {
  const beats = row.visual_plan?.visualBeats ?? [];
  const entities = row.entity_registry ?? row.visual_plan?.entityRegistry ?? [];
  return { beats: beats.length, sequences: row.visual_plan?.visualSequences?.length ?? beats.length, chapters: new Set(beats.map(b => b.chapterId)).size, setups: new Set(beats.map(b => b.baseSetupKey).filter(Boolean)).size, reuse: beats.filter(b => b.shotStrategy === "REUSE_WITH_DELTA").length, diagrams: beats.filter(b => b.visualType === "DIAGRAM").length, maps: beats.filter(b => b.visualType === "MAP").length, counts: Object.fromEntries(Object.keys(CATEGORIES).map(key => [key, entities.filter(e => e.category === key).length])) };
}
export function continuityLabels(row) {
  const entities = row.entity_registry ?? [];
  const setups = [...new Set((row.visual_plan?.visualBeats ?? []).map(b => b.baseSetupKey).filter(Boolean))];
  return new Map((row.visual_plan?.visualBeats ?? []).filter(b => b.baseSetupKey).map(b => [b.id, `${entities.find(e => e.id === b.locationId)?.name ?? "Shared scene"} · Setup ${setupLabel(setups.indexOf(b.baseSetupKey))}`]));
}
function setupLabel(index) { return index < 26 ? String.fromCharCode(65 + index) : `${Math.floor(index / 26)}${String.fromCharCode(65 + index % 26)}`; }
export function chapterGroups(row, script) {
  const beats = row.visual_plan?.visualBeats ?? [];
  const ids = [...new Set(beats.map(b => b.chapterId))];
  return ids.map((id, index) => ({ id, number: index + 1, title: script?.chapters?.find(c => c.chapterId === id)?.title ?? `Chapter ${index + 1}`, beats: beats.filter(b => b.chapterId === id), sequences: (row.visual_plan?.visualSequences ?? []).filter(s=>s.chapterId===id).map((s,i)=>({...s,number:i+1,beats:beats.filter(b=>b.sequenceId===s.id)})) }));
}
// The server repeats this whitelist; narration, grounding and continuity are never accepted from a client patch.
export function beatPatch(beat, draft) {
  if (!draft.informationToCommunicate?.trim()) throw new Error("Describe what the viewer should see.");
  if (!SHOTS[draft.shotSize] || !TYPES[draft.visualType]) throw new Error("Choose a supported shot and visual type.");
  return { beatId: beat.id, informationToCommunicate: draft.informationToCommunicate.trim(), shotSize: draft.shotSize, visualType: draft.visualType, locationId: draft.locationId || null, characterIds: draft.characterIds ?? [] };
}
export function editWarnings(beat, draft) {
  const text = draft.informationToCommunicate?.toLowerCase() ?? "";
  const conflicts = (beat.forbiddenElements ?? []).filter(item => text.includes(item.toLowerCase()));
  return [...conflicts.map(item => `Check this detail: “${item}” is restricted in this scene.`), ...((beat.factualVisualConstraints?.length || beat.revealConstraints?.length) ? ["This scene has factual or reveal constraints. They remain attached to your edit; review your description against them."] : [])];
}
