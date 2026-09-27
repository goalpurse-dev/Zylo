import { writeFileSync } from "node:fs";
import { analyzeReferenceHierarchy } from "../../supabase/functions/_shared/referenceHierarchy.ts";
import { resolveReferenceReuse } from "../../supabase/functions/_shared/visualWorldReconciliation.ts";

const budget = { characterSheets: 7, locationSheets: 4, objectSheets: 3, styleAnchors: 0, diagramStyleSheets: 1, maxAssets: 16 };
const e = (id, name, category, importance, referenceNeeded, referencePriority) => ({ id, name, category, importance, referenceNeeded, referencePriority });
const entities = [
  e("ent_plato", "Plato (author/narrator)", "CHARACTER", "HERO", true, "high"),
  e("Santorini_Thera", "Santorini (Thera)", "LOCATION", "RECURRING", true, "high"),
  e("Gibraltar_region", "Gibraltar region (Pillars of Heracles)", "LOCATION", "RECURRING", true, "high"),
  e("Tartessos_Iberia", "Iberia / Tartessos region", "LOCATION", "RECURRING", true, "medium"),
  e("Doggerland", "Doggerland (North Sea palaeolandscape)", "LOCATION", "RECURRING", true, "medium"),
  e("ent_shipboard_lab", "Shipboard / field lab", "LOCATION", "RECURRING", true, "medium"),
  e("Ignatius_Donnelly", "Ignatius Donnelly", "CHARACTER", "RECURRING", true, "medium"),
  e("Proclus", "Proclus (late-antique commentator)", "CHARACTER", "RECURRING", true, "medium"),
  e("geologists", "Geologists / palaeogeographers", "CHARACTER", "RECURRING", true, "medium"),
  e("philologists", "Philologists / classicists", "CHARACTER", "RECURRING", true, "medium"),
  e("19th_century_popularizers", "19th-century popularizers", "CHARACTER", "INCIDENTAL", false, "low"),
  e("ent_multibeam", "Multibeam sonar", "IMPORTANT_OBJECT", "RECURRING", true, "medium"),
  e("ent_side_scan", "Side-scan sonar", "IMPORTANT_OBJECT", "RECURRING", true, "medium"),
  e("ent_radiocarbon", "Radiocarbon dating", "IMPORTANT_OBJECT", "RECURRING", true, "medium"),
  e("ent_seismic_survey", "Seismic sub-bottom profiler", "IMPORTANT_OBJECT", "RECURRING", false, "low"),
  e("ent_tephrochronology", "Tephrochronology", "IMPORTANT_OBJECT", "RECURRING", false, "low"),
  e("obj_sensational_headline", "Sensational modern headlines", "IMPORTANT_OBJECT", "RECURRING", false, "low"),
  e("obj_bullet_list_graphic", "On-screen evidence checklist", "DIAGRAM_SUBJECT", "RECURRING", true, "medium"),
  e("Coring_and_Strata", "Coring / Stratigraphy / Tephra", "DIAGRAM_SUBJECT", "RECURRING", true, "high"),
];
const demand = {
  ent_plato: 76, Santorini_Thera: 43, Gibraltar_region: 30, Tartessos_Iberia: 30,
  Doggerland: 29, ent_shipboard_lab: 12, Ignatius_Donnelly: 35, Proclus: 35,
  geologists: 7, philologists: 7, "19th_century_popularizers": 35,
  ent_multibeam: 11, ent_side_scan: 5, ent_radiocarbon: 6, ent_seismic_survey: 5,
  ent_tephrochronology: 12, obj_sensational_headline: 32, obj_bullet_list_graphic: 44,
  Coring_and_Strata: 30,
};
const beats = Array.from({ length: 175 }, (_, index) => ({
  id: `production_beat_${index + 1}`,
  sequenceId: `production_sequence_${Math.floor(index / 6) + 1}`,
  chapterId: `chapter_${Math.floor(index / 25) + 1}`,
  primaryEntityIds: Object.entries(demand).filter(([, count]) => index < count).map(([id]) => id),
  supportingEntityIds: [],
  locationId: index < 24 ? "Santorini_Thera" : index < 35 ? "ent_shipboard_lab" : null,
  estimatedStartSeconds: index * 4,
  estimatedEndSeconds: index * 4 + 4,
}));

const hierarchy = analyzeReferenceHierarchy({
  title: "What Really Happened to the Lost City of Atlantis?",
  topic: "A look into the theories and evidence surrounding the myth of Atlantis and its existence.",
  narrativeStrategy: {
    primaryNarrativeMode: "investigation",
    centralThesis: "Plato's Atlantis is tested against competing reconstructions, geological processes and archaeological evidence.",
    viewerQuestion: "Was Atlantis a real place, and what visual model best explains the myth?",
  },
  entities, visualBeats: beats, continuityGroups: [], budget,
});
const adopted = [
  ["Santorini_Thera", "Santorini (Thera)", "LOCATION"], ["ent_plato", "Plato (author/narrator)", "CHARACTER"],
  ["ent_shipboard_lab", "Shipboard / field lab", "LOCATION"], ["Gibraltar_region", "Gibraltar region (Pillars of Heracles)", "LOCATION"],
  ["Doggerland", "Doggerland (North Sea palaeolandscape)", "LOCATION"], ["geologists", "Geologists / palaeogeographers", "CHARACTER"],
  ["Ignatius_Donnelly", "Ignatius Donnelly", "CHARACTER"], ["philologists", "Philologists / classicists", "CHARACTER"],
  ["Proclus", "Proclus (late-antique commentator)", "CHARACTER"], ["ent_seismic_survey", "Seismic sub-bottom profiler", "IMPORTANT_OBJECT"],
  ["ent_tephrochronology", "Tephrochronology", "IMPORTANT_OBJECT"], ["19th_century_popularizers", "19th-century popularizers", "CHARACTER"],
].map(([entityId, entityName, entityCategory]) => ({ entityId, entityName, entityCategory }));
const matches = resolveReferenceReuse(hierarchy.selectedEntities.map((item) => ({ id: item.id, name: item.name, category: item.category })), adopted);
const reusable = new Set(matches.map((match) => match.newEntityId));
const selected = hierarchy.selectedReferences.map((item) => ({ ...item, disposition: reusable.has(item.subjectId) ? "REUSE_COMPATIBLE" : "GENERATE_NEW" }));
if (hierarchy.diagramStyleNeeded) selected.push({ subjectId: "__diagram_style_reference__", displayName: "Diagram visual language", importanceTier: "MAJOR", referenceFormat: "diagram_board", requiredForCompletion: true, disposition: "REUSE_COMPATIBLE" });
const result = {
  mode: "ZERO_PROVIDER_DRY_REPLAN",
  projectId: "e7a6fd5e-0d3d-416e-8e44-02d52491000b",
  sourceVisualPlanVersionId: "0f4a7915-bfac-4e7e-adb6-d16e316cbb86",
  selected,
  optional: hierarchy.optionalSubjects,
  excluded: hierarchy.excludedReferences,
  providerCalls: 0,
  providerCostUsd: 0,
};
writeFileSync(new URL("./atlantis-rebuild-dry-plan.json", import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
