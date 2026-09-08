import { planReferenceViews } from "../../src/pages/workspace/long-form/visualWorldPlanning.js";

// Hand-authored development data. Never inserted into a real project and
// never sent to Story, Research, Script, Visual Director or Reference Planner.
export const fixturePlan = {
  entity_registry: [
    { id: "erik", name: "Erik the farmer", category: "CHARACTER", importance: "HERO", referenceNeeded: true },
    { id: "longhouse", name: "Longhouse", category: "LOCATION", importance: "RECURRING", referenceNeeded: true },
    { id: "hearth", name: "Hearth", category: "IMPORTANT_OBJECT", importance: "RECURRING", referenceNeeded: true },
    { id: "longship", name: "Viking longship", category: "VEHICLE_MACHINE", importance: "RECURRING", referenceNeeded: true },
  ],
  continuity_groups: [{ id: "winter_evening", locationId: "longhouse", cameraAnchors: ["wide_toward_hearth", "reverse_from_hearth"], entityIds: ["erik", "hearth"], lightingState: "Evening hearth light", spatialInvariants: ["Central hearth", "Benches against both long walls", "Entrance behind the wide camera"] }],
};
const canonical = {
  erik: "A weathered Norse farmer in his mid-30s, broad-shouldered and stocky, with a short reddish-brown beard, weather-cracked skin, and pale blue eyes. Straight shoulder-length reddish-brown hair, no braids. Undyed oatmeal wool tunic, charcoal wool trousers, muted brown fur-lined cloak clasped at the right shoulder, brown leather boots and oatmeal wool leg wraps. Same facial proportions, beard length, hair, clothing and palette in every view.",
  longhouse: "Long timber-framed hall with a central stone-lined hearth pit, low turf-and-timber walls, smoke-darkened roof beams, packed-earth floor, simple benches along both long walls. Camera at the entrance looking down the hall toward the central hearth, central aisle clear, hearth in the middle distance. A reusable empty animation set with fixed architecture, no people.",
  hearth: "Low rectangular stone-lined open hearth pit in the centre of a packed-earth floor, glowing embers, a small controlled flame and an iron cooking pot. No masonry chimney or wall fireplace.",
  longship: "Long narrow shallow-draft clinker-built oak hull with overlapping planks, symmetrical rows of oar ports, one mast with a furled square sail, simple curved undecorated prow, hauled onto a sparse rocky winter shore. Entire hull and mast visible.",
};
export const fixtureEntities = planReferenceViews(fixturePlan.entity_registry, fixturePlan.continuity_groups).map((e) => ({ ...e, canonicalSpec: canonical[e.entityId], factualConstraints: e.entityCategory === "CHARACTER" ? ["No horned helmet; practical wool clothing rather than fantasy armor."] : e.entityId === "longhouse" ? ["Central open hearth, not a wall fireplace.", "Light from hearth and roof smoke opening."] : ["Period-appropriate wood, wool, iron and stone; no modern components."], forbiddenElements: ["logos", "weapons", "modern objects"] }));
export const smokeSlots = ["erik:three_quarter_neutral", "erik:profile", "longhouse:wide_toward_hearth", "longship:three_quarter_hero"];
export const fixtureWorld = {
  id: "fixture-only", status: "ready", renderer_tool_key: "image:flux.base", style_key: "zyvo_illustrated_documentary",
  reference_plan: { visualStyleNotes: "Cold muted blues and greys for a winter survival story", entities: fixtureEntities },
  excluded_views: fixtureEntities.flatMap((e) => e.requiredViews.map((v) => `${e.entityId}:${v.angle}`)).filter((key) => !smokeSlots.includes(key)),
};
