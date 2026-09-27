import test from "node:test";
import assert from "node:assert/strict";
import { assessVisualWorldCompatibility } from "../src/pages/workspace/long-form/visualWorldCompatibility.js";

// 2026-09-19 "fix the missing production workflow" pass, item 4: "do NOT
// blindly rebuild Visual World... determine whether the current Visual
// World still contains every canonical identity/location/object reference
// required by the new plan."
//
// 2026-09-19 (same day) forensic follow-up: this module under-reported
// compatibility on Mars's real v4->v5 replan ("2 of 15 reusable, 13 new"
// when the real answer is "6 of 14 reusable, 8 new"). The regression tests
// below reproduce the exact real Mars entity shapes that exposed both bugs.

function entity(overrides) {
  return { id: "e1", name: "Protagonist", category: "CHARACTER", importance: "HERO", referenceNeeded: true, ...overrides };
}

test("fully compatible: every required entity in the new plan already has a same-id or same-named entry in the current Visual World", () => {
  const newRegistry = [entity({ id: "e1", name: "Protagonist", category: "CHARACTER" }), entity({ id: "e2", name: "Greenhouse Dome", category: "LOCATION", importance: "RECURRING" })];
  const currentWorld = [{ entityId: "e1", entityName: "Protagonist", entityCategory: "CHARACTER" }, { entityId: "e2", entityName: "Greenhouse Dome", entityCategory: "LOCATION" }];
  const result = assessVisualWorldCompatibility(newRegistry, currentWorld);
  assert.equal(result.compatible, true);
  assert.equal(result.reusableCount, 2);
  assert.equal(result.missingCount, 0);
});

test("a new named character not present in the current Visual World is reported as exactly missing, not silently duplicated or ignored", () => {
  const newRegistry = [
    entity({ id: "e1", name: "Protagonist", category: "CHARACTER" }),
    entity({ id: "e3", name: "Agricultural Specialist", category: "CHARACTER", importance: "RECURRING" }),
  ];
  const currentWorld = [{ entityId: "e1", entityName: "Protagonist", entityCategory: "CHARACTER" }];
  const result = assessVisualWorldCompatibility(newRegistry, currentWorld);
  assert.equal(result.compatible, false);
  assert.equal(result.reusableCount, 1);
  assert.equal(result.missingCount, 1);
  assert.equal(result.missing[0].name, "Agricultural Specialist");
});

/* ---- Real Mars v4 -> v5 regression: preserved entity ID survives a reworded name ---- */
test("REGRESSION (real Mars v5 replan): a preserved entity id is matched even when the description text was reworded — the protagonist kept id e_protagonist across the replan with 60 real reference assets already generated, but its name text changed from 'on-shift crew member / protagonist' to 'habitat crew member / protagonist'", () => {
  const newRegistry = [entity({ id: "e_protagonist", name: "habitat crew member / protagonist", category: "CHARACTER" })];
  const currentWorld = [{ entityId: "e_protagonist", entityName: "on‑shift crew member / protagonist", entityCategory: "CHARACTER" }];
  const result = assessVisualWorldCompatibility(newRegistry, currentWorld);
  assert.equal(result.compatible, true, "matching by preserved id must win even though the name text is completely different");
  assert.equal(result.reusableCount, 1);
});
test("REGRESSION (real Mars v5 replan): 3 more entities that kept their id but were reworded — technician, greenhouse location, and greenhouse-chamber object — must all match by id", () => {
  const newRegistry = [
    entity({ id: "e_technician", name: "maintenance technician (suit & life support)", category: "CHARACTER", importance: "RECURRING" }),
    entity({ id: "l_greenhouse", name: "Greenhouse / growth chamber", category: "LOCATION", importance: "RECURRING" }),
    entity({ id: "o_greenhouse_chamber", name: "flagged greenhouse chamber / growth rack", category: "IMPORTANT_OBJECT", importance: "RECURRING" }),
  ];
  const currentWorld = [
    { entityId: "e_technician", entityName: "suit/maintenance technician", entityCategory: "CHARACTER" },
    { entityId: "l_greenhouse", entityName: "greenhouse / growth chamber (rack + chamber)", entityCategory: "LOCATION" },
    { entityId: "o_greenhouse_chamber", entityName: "flagged greenhouse chamber / tray block", entityCategory: "IMPORTANT_OBJECT" },
  ];
  const result = assessVisualWorldCompatibility(newRegistry, currentWorld);
  assert.equal(result.compatible, true);
  assert.equal(result.reusableCount, 3);
});
test("REGRESSION (real Mars v5 replan): a genuine rename (different id, identical name) still matches via the name+category fallback — 'agricultural specialist' moved from id e_ag_spec to e_agri_specialist", () => {
  const newRegistry = [entity({ id: "e_agri_specialist", name: "agricultural specialist", category: "CHARACTER", importance: "RECURRING" })];
  const currentWorld = [{ entityId: "e_ag_spec", entityName: "agricultural specialist", entityCategory: "CHARACTER" }];
  const result = assessVisualWorldCompatibility(newRegistry, currentWorld);
  assert.equal(result.compatible, true);
  assert.equal(result.reusable[0].matchedWorldEntityId, "e_ag_spec");
});
test("REGRESSION (real Mars v5 replan): DIAGRAM_SUBJECT entities are never counted as requiring a Visual World reference at all, even when referenceNeeded is true — matches deriveRequiredViews' own fallthrough (a diagram subject is rendered by the deterministic graphic pipeline, never a photographic reference)", () => {
  const newRegistry = [entity({ id: "d_eva_budget_diagram", name: "EVA dose budget calculation / bar graphic", category: "DIAGRAM_SUBJECT", importance: "RECURRING", referenceNeeded: true })];
  const result = assessVisualWorldCompatibility(newRegistry, []);
  assert.equal(result.totalRequired, 0, "DIAGRAM_SUBJECT must never inflate the required count");
  assert.equal(result.compatible, true);
});
test("REGRESSION (real Mars v5 replan, full reproduction): the corrected checker reports 6 of 14 reusable (not the buggy '2 of 15') against the real entity shapes", () => {
  const newRegistry = [
    entity({ id: "e_protagonist", name: "habitat crew member / protagonist", category: "CHARACTER", importance: "HERO" }),
    entity({ id: "e_operations_officer", name: "operations officer (habitual planner)", category: "CHARACTER", importance: "RECURRING" }),
    entity({ id: "e_power_officer", name: "power officer / controller", category: "CHARACTER", importance: "RECURRING" }),
    entity({ id: "e_agri_specialist", name: "agricultural specialist", category: "CHARACTER", importance: "RECURRING" }),
    entity({ id: "e_technician", name: "maintenance technician (suit & life support)", category: "CHARACTER", importance: "RECURRING" }),
    entity({ id: "l_habitat_common", name: "Habitat — common module / bunks / tablet wall", category: "LOCATION", importance: "HERO" }),
    entity({ id: "l_greenhouse", name: "Greenhouse / growth chamber", category: "LOCATION", importance: "RECURRING" }),
    entity({ id: "l_suit_lab", name: "Suit locker / maintenance bench", category: "LOCATION", importance: "RECURRING" }),
    entity({ id: "l_airlock_surface", name: "Airlock / exterior / rover", category: "LOCATION", importance: "RECURRING" }),
    entity({ id: "l_power_isru", name: "Power room / solar array / ISRU plant", category: "LOCATION", importance: "RECURRING" }),
    entity({ id: "o_tablet_checklist", name: "wall tablet — morning checklist UI", category: "IMPORTANT_OBJECT", importance: "RECURRING" }),
    entity({ id: "o_faulty_suit", name: "suit with pressure-regulation valve fault", category: "IMPORTANT_OBJECT", importance: "RECURRING" }),
    entity({ id: "o_greenhouse_chamber", name: "flagged greenhouse chamber / growth rack", category: "IMPORTANT_OBJECT", importance: "RECURRING" }),
    entity({ id: "o_battery_rack", name: "battery bank / power controller console", category: "VEHICLE_MACHINE", importance: "RECURRING" }),
    entity({ id: "d_eva_budget_diagram", name: "EVA dose budget calculation / bar graphic", category: "DIAGRAM_SUBJECT", importance: "RECURRING" }),
  ];
  const currentWorld = [
    { entityId: "e_protagonist", entityName: "on‑shift crew member / protagonist", entityCategory: "CHARACTER" },
    { entityId: "e_ag_spec", entityName: "agricultural specialist", entityCategory: "CHARACTER" },
    { entityId: "e_power_officer", entityName: "power officer / controller", entityCategory: "CHARACTER" },
    { entityId: "e_technician", entityName: "suit/maintenance technician", entityCategory: "CHARACTER" },
    { entityId: "l_habitat_module", entityName: "habitat living module (with porthole and tablet UI)", entityCategory: "LOCATION" },
    { entityId: "l_greenhouse", entityName: "greenhouse / growth chamber (rack + chamber)", entityCategory: "LOCATION" },
    { entityId: "l_airlock_lockers", entityName: "airlock / suit locker bay", entityCategory: "LOCATION" },
    { entityId: "l_ops_center", entityName: "operations/power control console", entityCategory: "LOCATION" },
    { entityId: "l_isru_plant", entityName: "ISRU / MOXIE-style plant and solar array field", entityCategory: "LOCATION" },
    { entityId: "o_tablet", entityName: "wall tablet checklist UI (icons: O2/H2O/power)", entityCategory: "IMPORTANT_OBJECT" },
    { entityId: "o_suit", entityName: "extravehicular suit (locker)", entityCategory: "IMPORTANT_OBJECT" },
    { entityId: "o_greenhouse_chamber", entityName: "flagged greenhouse chamber / tray block", entityCategory: "IMPORTANT_OBJECT" },
    { entityId: "o_battery_array", entityName: "battery bank / solar array field", entityCategory: "VEHICLE_MACHINE" },
    { entityId: "o_isru_unit", entityName: "ISRU unit (startup/standby visible panel)", entityCategory: "VEHICLE_MACHINE" },
    { entityId: "d_eva_budget_diagram", entityName: "EVA dose budget calculation", entityCategory: "DIAGRAM_SUBJECT" },
  ];
  const result = assessVisualWorldCompatibility(newRegistry, currentWorld);
  assert.equal(result.totalRequired, 14, "DIAGRAM_SUBJECT excluded -> 14, not 15");
  assert.equal(result.reusableCount, 6, "protagonist, technician, power officer, agricultural specialist, greenhouse, greenhouse chamber");
  assert.equal(result.missingCount, 8);
  assert.deepEqual(result.missing.map((m) => m.id).sort(), ["e_operations_officer", "l_airlock_surface", "l_habitat_common", "l_power_isru", "l_suit_lab", "o_battery_rack", "o_faulty_suit", "o_tablet_checklist"].sort());
});

test("matches by name+category, case-insensitively, when no id match exists", () => {
  const newRegistry = [entity({ id: "totally-different-id-this-time", name: "protagonist", category: "CHARACTER" })];
  const currentWorld = [{ entityId: "some-other-id", entityName: "Protagonist", entityCategory: "CHARACTER" }];
  const result = assessVisualWorldCompatibility(newRegistry, currentWorld);
  assert.equal(result.compatible, true);
  assert.equal(result.missingCount, 0);
});

test("the same name in a DIFFERENT category is not treated as a match (a location named 'Command' is not the same as a character named 'Command')", () => {
  const newRegistry = [entity({ id: "e1", name: "Command", category: "LOCATION", importance: "RECURRING" })];
  const currentWorld = [{ entityId: "other-id", entityName: "Command", entityCategory: "CHARACTER" }];
  const result = assessVisualWorldCompatibility(newRegistry, currentWorld);
  assert.equal(result.compatible, false);
  assert.equal(result.missingCount, 1);
});

test("entities that don't need a reference at all are never counted as required, regardless of Visual World coverage", () => {
  const newRegistry = [entity({ id: "e1", name: "Background Extra", category: "CHARACTER", importance: "LOW", referenceNeeded: false })];
  const result = assessVisualWorldCompatibility(newRegistry, []);
  assert.equal(result.totalRequired, 0);
  assert.equal(result.compatible, true);
});
test("a CHARACTER with referenceNeeded=true but importance neither HERO nor RECURRING is still never required (matches deriveRequiredViews' own rule)", () => {
  const newRegistry = [entity({ id: "e1", name: "Passerby", category: "CHARACTER", importance: "INCIDENTAL", referenceNeeded: true })];
  const result = assessVisualWorldCompatibility(newRegistry, []);
  assert.equal(result.totalRequired, 0);
});

test("an empty new registry is trivially compatible with anything", () => {
  const result = assessVisualWorldCompatibility([], [{ entityId: "x", entityName: "Anyone", entityCategory: "CHARACTER" }]);
  assert.equal(result.compatible, true);
  assert.equal(result.totalRequired, 0);
});

test("a Visual World that doesn't exist yet (no current entities at all) reports every required entity as missing, never as a false compatible", () => {
  const newRegistry = [entity({ id: "e1", name: "Protagonist", category: "CHARACTER" }), entity({ id: "e2", name: "Rover", category: "VEHICLE_MACHINE", importance: "RECURRING" })];
  const result = assessVisualWorldCompatibility(newRegistry, []);
  assert.equal(result.compatible, false);
  assert.equal(result.missingCount, 2);
  assert.equal(result.reusableCount, 0);
});
