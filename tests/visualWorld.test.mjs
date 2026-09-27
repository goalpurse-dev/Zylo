import test from "node:test";
import assert from "node:assert/strict";
import { applyReferencePlanningBudget, compileReferencePrompt, deriveReferenceQAExpectations, deriveRequiredViews, validateCompiledReferencePrompt, validateRequiredViews, ZYVO_STYLE_SPEC } from "../supabase/functions/_shared/visualWorldStyle.ts";

const views = (name, category = "IMPORTANT_OBJECT") => deriveRequiredViews({ id: name.toLowerCase().replace(/\W/g, "_"), name, category, importance: "RECURRING", referenceNeeded: true }, []);
const promptFor = (name, view) => compileReferencePrompt({ styleSpec: ZYVO_STYLE_SPEC, entityName: name, canonicalSpec: `${name}, clean reusable canonical appearance`, view, factualConstraints: ["Display the label POWER", "show a process sequence"] });

test("Sun and Moon stay single-subject; Earth is capped at three distinct images", () => {
  assert.equal(views("Sun", "DIAGRAM_SUBJECT").length, 1);
  assert.equal(views("Moon", "DIAGRAM_SUBJECT").length, 1);
  const earth = views("Earth", "DIAGRAM_SUBJECT");
  assert.deepEqual(earth.map((v) => v.angle), ["earth_full_disk", "earth_atmosphere_limb", "earth_surface_texture"]);
  validateRequiredViews({ id: "earth", name: "Earth", category: "DIAGRAM_SUBJECT", importance: "RECURRING" }, earth);
  const sunPrompt = promptFor("Sun", views("Sun", "DIAGRAM_SUBJECT")[0]);
  assert.match(sunPrompt, /the Sun only/);
  assert.match(sunPrompt, /NO people, spacecraft, vehicles, unrelated planets/);
});

test("PV panel and sky references stay isolated and reject presentation clutter", () => {
  for (const name of ["Photovoltaic panel", "Daytime sky"]) {
    const view = views(name)[0];
    const prompt = promptFor(name, view);
    validateCompiledReferencePrompt(view, prompt);
    assert.match(prompt, /NO infographic layout/);
    assert.match(prompt, /NO collage/);
    assert.match(prompt, /NO readable text/);
    assert.doesNotMatch(prompt, /Display the label POWER|show a process sequence/);
  }
});

test("combined plants split into crop, forest and phytoplankton assets and never characters", () => {
  const plantViews = views("plants crops forests phytoplankton", "CHARACTER");
  assert.deepEqual(plantViews.map((v) => v.angle), ["crop_specimen", "forest_vegetation", "phytoplankton_specimen"]);
  assert.ok(plantViews.every((v) => v.referenceType === "environment_reference"));
});

test("machine references remain individual object images", () => {
  const machineViews = views("Oxygen scrubber machine", "VEHICLE_MACHINE");
  assert.equal(machineViews.length, 1);
  assert.equal(machineViews[0].referenceType, "object_reference");
  const prompt = promptFor("Oxygen scrubber machine", machineViews[0]);
  assert.match(prompt, /one coherent equipment system/i);
  assert.match(prompt, /sensor plus console/i);
  assert.equal(deriveReferenceQAExpectations(machineViews[0]).coherentSystemAllowed, true);
});

test("reference planning budget keeps reusable high-value entities and one diagram style sheet", () => {
  const entities = [
    ...Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, name: `Character ${i}`, category: "CHARACTER", importance: i === 0 ? "HERO" : "RECURRING", referenceNeeded: true, referencePriority: i < 3 ? "high" : "medium" })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, name: `Location ${i}`, category: "LOCATION", importance: "RECURRING", referenceNeeded: true, referencePriority: "medium" })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `o${i}`, name: `Object ${i}`, category: "IMPORTANT_OBJECT", importance: "RECURRING", referenceNeeded: true, referencePriority: "medium" })),
    { id: "diagram", name: "Timeline", category: "DIAGRAM_SUBJECT", importance: "RECURRING", referenceNeeded: true, referencePriority: "high" },
  ];
  const budgeted = applyReferencePlanningBudget(entities);
  assert.equal(budgeted.selected.filter((e) => e.category === "CHARACTER").length, 7);
  assert.equal(budgeted.selected.filter((e) => e.category === "LOCATION").length, 4);
  assert.equal(budgeted.selected.filter((e) => e.category === "IMPORTANT_OBJECT").length, 3);
  assert.equal(budgeted.diagramStyleNeeded, true);
  assert.ok(budgeted.selected.length + 1 <= 16);
});

test("recurring locations compile to one reusable anchor", () => {
  const location = { id: "lab", name: "Field lab", category: "LOCATION", importance: "RECURRING", referenceNeeded: true };
  const result = deriveRequiredViews(location, [{ locationId: "lab", cameraAnchors: ["wide_establishing", "reverse_wide", "detail_insert"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].referenceType, "location_reference");
});

test("diagram style prompt is simple, text-free, and topic-neutral", () => {
  const prompt = compileReferencePrompt({ styleSpec: ZYVO_STYLE_SPEC, entityName: "Diagram visual language", canonicalSpec: "minimal", view: { referenceType: "diagram_style_reference", angle: "canonical_diagram_style", purpose: "style" } });
  assert.match(prompt, /extremely simple visual-language sample/i);
  assert.match(prompt, /NO readable text/);
  assert.match(prompt, /not an information graphic/i);
  validateCompiledReferencePrompt({ referenceType: "diagram_style_reference", angle: "canonical_diagram_style", purpose: "style" }, prompt);
});

test("canonical character sheet carries the universal dispatch contract", () => {
  const view = { referenceType: "character_reference", angle: "character_reference_sheet", purpose: "sheet", importance: "HERO" };
  const prompt = compileReferencePrompt({ styleSpec: ZYVO_STYLE_SPEC, entityName: "Plato", canonicalSpec: "older bearded philosopher in a simple robe", view });
  validateCompiledReferencePrompt(view, prompt);
  assert.match(prompt, /\[CANONICAL REFERENCE NEGATIVE CONTRACT\]/);
});
