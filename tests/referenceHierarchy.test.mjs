import test from "node:test";
import assert from "node:assert/strict";
import { analyzeReferenceHierarchy } from "../supabase/functions/_shared/referenceHierarchy.ts";

const budget = { characterSheets: 7, locationSheets: 4, objectSheets: 3, styleAnchors: 0, diagramStyleSheets: 1, maxAssets: 16 };
const entity = (id, name, category, importance = "RECURRING", extra = {}) => ({ id, name, category, importance, referenceNeeded: true, referencePriority: importance === "HERO" ? "high" : "medium", ...extra });
const beat = (id, primaryEntityIds = [], supportingEntityIds = [], locationId = null, chapterId = "c1", text = "") => ({ id, primaryEntityIds, supportingEntityIds, locationId, chapterId, informationToCommunicate: text, estimatedStartSeconds: 0, estimatedEndSeconds: 8 });
const plan = (topic, entities, visualBeats = [], customBudget = budget) => analyzeReferenceHierarchy({ topic, entities, visualBeats, continuityGroups: [], budget: customBudget });

test("historical mystery synthesizes a missing reconstructed visual hero above evidence tools", () => {
  const result = plan("What really happened to Atlantis?", [entity("plato", "Plato", "CHARACTER", "HERO"), entity("sonar", "Side-scan sonar", "IMPORTANT_OBJECT"), entity("doggerland", "Doggerland", "LOCATION")], [beat("b1", ["plato"]), beat("b2", [], ["sonar"]), beat("b3", ["doggerland"], [], null, "c2", "comparison with Doggerland")]);
  assert.equal(result.heroSubjects[0].subjectId, "__episode_hero__");
  assert.equal(result.heroSubjects[0].subjectRole, "main_world_anchor");
  assert.ok(result.selectedReferences.find((r) => r.subjectId === "__episode_hero__"));
  const sonar = [...result.selectedReferences, ...result.excludedReferences].find((r) => r.subjectId === "sonar");
  assert.ok(sonar.importanceScore < result.heroSubjects[0].importanceScore);
});

test("viewer-led what-if selects a protagonist character board", () => {
  const result = plan("What if you became a millionaire tomorrow?", [entity("car", "Luxury car", "IMPORTANT_OBJECT"), entity("house", "Modern house", "LOCATION")]);
  assert.equal(result.heroSubjects[0].displayName, "Viewer protagonist");
  assert.equal(result.heroSubjects[0].referenceFormat, "character_board");
});

test("science process makes the shared diagram system the visual spine", () => {
  const result = plan("How the carbon cycle system works", [entity("cycle", "Carbon cycle", "DIAGRAM_SUBJECT", "HERO"), entity("sensor", "Carbon sensor", "IMPORTANT_OBJECT")], [beat("b1", ["cycle"]), beat("b2", ["cycle"], ["sensor"], null, "c2")]);
  assert.equal(result.heroSubjects[0].subjectId, "cycle");
  assert.equal(result.heroSubjects[0].referenceFormat, "diagram_board");
  assert.equal(result.diagramStyleNeeded, true);
});

test("business story keeps the company ecosystem above secondary people and products", () => {
  const result = plan("How Nvidia became an AI giant", [entity("nvidia", "Nvidia", "IMPORTANT_OBJECT", "HERO"), entity("ceo", "Jensen Huang", "CHARACTER"), entity("gpu", "GPU server", "IMPORTANT_OBJECT")], [beat("b1", ["nvidia"]), beat("b2", ["nvidia"], ["ceo", "gpu"], null, "c2")]);
  assert.equal(result.heroSubjects[0].subjectId, "nvidia");
  assert.ok(result.selectedReferences[0].importanceScore >= result.selectedReferences.at(-1).importanceScore);
});

test("fiction episode prioritizes its lead character over props", () => {
  const result = plan("Mara escapes the glass city", [entity("mara", "Mara", "CHARACTER", "HERO"), entity("city", "Glass city", "LOCATION"), entity("key", "Silver key", "IMPORTANT_OBJECT")], [beat("b1", ["mara"], ["key"], "city"), beat("b2", ["mara"], [], "city", "c2")]);
  assert.equal(result.heroSubjects[0].subjectId, "mara");
  assert.equal(result.heroSubjects[0].subjectRole, "protagonist");
});

test("character ensemble orders the lead first while packing every selected character as one board", () => {
  const result = plan("The Orion crew mutiny", [entity("captain", "Orion captain", "CHARACTER", "HERO"), entity("pilot", "Orion pilot", "CHARACTER"), entity("engineer", "Orion engineer", "CHARACTER")], [beat("b1", ["captain"], ["pilot", "engineer"]), beat("b2", ["captain", "pilot"], ["engineer"], null, "c2")]);
  assert.equal(result.heroSubjects[0].subjectId, "captain");
  assert.ok(result.selectedReferences.filter((r) => r.referenceFormat === "character_board").length === 3);
});

test("location-led video selects the recurring place as its world anchor", () => {
  const result = plan("Inside the Amazon rainforest", [entity("amazon", "Amazon rainforest", "LOCATION", "HERO"), entity("guide", "Field guide", "CHARACTER")], [beat("b1", [], ["guide"], "amazon"), beat("b2", [], [], "amazon", "c2")]);
  assert.equal(result.heroSubjects[0].subjectId, "amazon");
  assert.equal(result.heroSubjects[0].referenceFormat, "location_board");
});

test("tight budget drops optional tools before the core identity", () => {
  const tiny = { ...budget, objectSheets: 1, maxAssets: 4 };
  const result = plan("Ada builds the future", [entity("ada", "Ada", "CHARACTER", "HERO"), entity("lab", "Ada laboratory", "LOCATION"), entity("meter", "Voltage meter", "IMPORTANT_OBJECT", "INCIDENTAL"), entity("scope", "Oscilloscope tool", "IMPORTANT_OBJECT", "INCIDENTAL")], [beat("b1", ["ada"], [], "lab")], tiny);
  assert.ok(result.selectedReferences.some((r) => r.subjectId === "ada"));
  assert.ok(result.excludedReferences.some((r) => ["meter", "scope"].includes(r.subjectId)));
});

test("hypothetical reconstructed subject is marked explicitly", () => {
  const result = plan("Could a future ocean city survive?", [entity("engineer", "Marine engineer", "CHARACTER")]);
  assert.equal(result.heroSubjects[0].isHypotheticalReconstruction, true);
  assert.equal(result.heroSubjects[0].isCoreIdentity, true);
});

test("comparison-heavy documentary downgrades comparison-only subjects", () => {
  const result = plan("Why the Roman road network endured", [entity("rome", "Roman road network", "LOCATION", "HERO"), entity("persia", "Persian roads", "LOCATION"), entity("china", "Han roads", "LOCATION")], [beat("b1", [], [], "rome"), beat("b2", [], ["persia"], null, "c2", "comparison versus Roman roads"), beat("b3", [], ["china"], null, "c3", "comparison with Rome")]);
  assert.equal(result.heroSubjects[0].subjectId, "rome");
  const all = [...result.selectedReferences, ...result.excludedReferences];
  assert.ok(all.find((r) => r.subjectId === "rome").importanceScore > all.find((r) => r.subjectId === "persia").importanceScore);
});
