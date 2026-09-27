import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeReferenceHierarchy } from "../supabase/functions/_shared/referenceHierarchy.ts";
import { resolveReferenceReuse } from "../supabase/functions/_shared/visualWorldReconciliation.ts";

const budget = { characterSheets: 7, locationSheets: 4, objectSheets: 3, styleAnchors: 0, diagramStyleSheets: 1, maxAssets: 16 };
const entity = (id, name, category, importance = "RECURRING", extra = {}) => ({ id, name, category, importance, referenceNeeded: true, referencePriority: importance === "HERO" ? "high" : "medium", ...extra });
const beat = (id, primaryEntityIds = [], supportingEntityIds = [], locationId = null, chapterId = "c1") => ({ id, sequenceId: `s_${chapterId}`, primaryEntityIds, supportingEntityIds, locationId, chapterId, estimatedStartSeconds: 0, estimatedEndSeconds: 6 });
const plan = (title, entities, visualBeats) => analyzeReferenceHierarchy({ title, topic: title, narrativeStrategy: {}, entities, visualBeats, continuityGroups: [], budget });

test("A changing semantic focus changes the rebuilt reference selection", () => {
  const entities = [entity("viking", "Viking survivor", "CHARACTER", "HERO"), entity("ship", "Viking ship", "VEHICLE_MACHINE"), entity("winter", "Arctic winter camp", "LOCATION")];
  const beats = [beat("b1", ["viking"], ["ship"], "winter")];
  const person = plan("One Viking survives the winter", entities, beats);
  const engineering = plan("How the Viking ship works", entities, beats);
  assert.equal(person.heroSubjects[0].subjectId, "viking");
  assert.equal(engineering.heroSubjects[0].subjectId, "ship");
});

test("B old reference slots are not automatically carried into a rebuild", () => {
  const fresh = plan("The biology of coral bleaching", [entity("coral", "Coral bleaching mechanism", "IMPORTANT_OBJECT", "HERO")], [beat("b1", ["coral"])]);
  const old = [{ entityId: "old_telegraph", entityName: "Telegraph machine", entityCategory: "IMPORTANT_OBJECT" }];
  const matches = resolveReferenceReuse(fresh.selectedEntities.map((e) => ({ id: e.id, name: e.name, category: e.category })), old);
  assert.equal(matches.length, 0);
  assert.ok(!fresh.selectedReferences.some((r) => r.subjectId === "old_telegraph"));
});

test("C reuse is evaluated only for slots selected by the independent plan", () => {
  const fresh = plan("Plato and the Atlantis debate", [entity("plato", "Plato", "CHARACTER", "HERO"), entity("sonar", "Side-scan sonar", "IMPORTANT_OBJECT")], [beat("b1", ["plato"], ["sonar"])]);
  const old = [{ entityId: "plato", entityName: "Plato", entityCategory: "CHARACTER" }, { entityId: "proclus", entityName: "Proclus", entityCategory: "CHARACTER" }];
  const matches = resolveReferenceReuse(fresh.selectedEntities.map((e) => ({ id: e.id, name: e.name, category: e.category })), old);
  assert.ok(matches.some((m) => m.parentEntityId === "plato"));
  assert.ok(!matches.some((m) => m.parentEntityId === "proclus"));
});

test("D a new semantic plan never contains a generated style anchor", () => {
  const result = plan("Inside the Amazon rainforest", [entity("amazon", "Amazon rainforest", "LOCATION", "HERO")], [beat("b1", [], [], "amazon")]);
  assert.equal(budget.styleAnchors, 0);
  assert.ok(!result.selectedReferences.some((r) => r.subjectId === "__style_reference__"));
});

test("E a central protagonist outranks frequent incidental objects", () => {
  const beats = Array.from({ length: 20 }, (_, i) => beat(`b${i}`, i < 3 ? ["lead"] : [], ["meter"]));
  const result = plan("Mara survives alone", [entity("lead", "Mara", "CHARACTER", "HERO"), entity("meter", "Survival meter", "IMPORTANT_OBJECT")], beats);
  assert.equal(result.heroSubjects[0].subjectId, "lead");
});

test("F a central place or system becomes CORE without a protagonist", () => {
  const result = plan("How photosynthesis works", [entity("photosynthesis", "Photosynthesis", "IMPORTANT_OBJECT", "HERO"), entity("microscope", "Microscope", "IMPORTANT_OBJECT")], [beat("b1", ["photosynthesis"], ["microscope"])]);
  assert.equal(result.heroSubjects[0].subjectId, "photosynthesis");
  assert.equal(result.heroSubjects[0].subjectRole, "main_concept");
});

test("F2 viewer-facing strategy copy cannot replace an explicit title subject", () => {
  const result = analyzeReferenceHierarchy({
    title: "What Really Happened to the Lost City of Atlantis?",
    topic: "Evidence surrounding the myth of Atlantis",
    narrativeStrategy: { viewerPromise: "You will discover which theory survives the evidence." },
    entities: [], continuityGroups: [], visualBeats: [], budget,
  });
  const core = result.selectedEntities.find((item) => item.importanceTier === "CORE");
  assert.equal(core?.category, "LOCATION");
  assert.match(core?.name ?? "", /Lost City of Atlantis/i);
});

test("G a frequent secondary example cannot steal CORE from the title subject", () => {
  const beats = Array.from({ length: 30 }, (_, i) => beat(`b${i}`, ["thera"]));
  const result = plan("What really happened to Atlantis?", [entity("thera", "Santorini Thera", "LOCATION", "HERO")], beats);
  assert.equal(result.heroSubjects[0].subjectId, "__episode_hero__");
  assert.match(result.heroSubjects[0].displayName, /Atlantis/i);
});

test("H optional references never become required generation slots", () => {
  const result = plan("Ada builds a clean-energy company", [entity("ada", "Ada", "CHARACTER", "HERO"), entity("meter", "Voltage meter", "IMPORTANT_OBJECT", "INCIDENTAL", { referenceNeeded: false, referencePriority: "low" })], [beat("b1", ["ada"])]);
  assert.ok(result.optionalSubjects.some((r) => r.subjectId === "meter"));
  assert.ok(!result.selectedReferences.some((r) => r.subjectId === "meter"));
});

test("I rebuild remains non-destructive and adoption is explicit", () => {
  const start = readFileSync(new URL("../supabase/functions/start-long-form-visual-world/index.ts", import.meta.url), "utf8");
  assert.match(start, /reuseSourceVisualWorldVersionId: project\.current_visual_world_version_id/);
  assert.doesNotMatch(start, /current_visual_world_version_id\s*:/);
  const ui = readFileSync(new URL("../src/pages/workspace/long-form/visualWorld.jsx", import.meta.url), "utf8");
  assert.match(ui, /adoptVisualWorldVersion\(visualWorldVersionId\)/);
});

test("J refresh follows the new rebuild and recovery can resume planning", () => {
  const ui = readFileSync(new URL("../src/pages/workspace/long-form/visualWorld.jsx", import.meta.url), "utf8");
  assert.match(ui, /const rebuildPreview = latestForPlan/);
  assert.match(ui, /displayWorld = rebuildPreview \?\? reconciliationWorld \?\? world/);
  const worker = readFileSync(new URL("../supabase/functions/advance-long-form-visual-world/index.ts", import.meta.url), "utf8");
  assert.match(worker, /case "planning":/);
  assert.match(worker, /await stagePlanning\(admin, row, project, visualPlanRow\)/);
});
