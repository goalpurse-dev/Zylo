// 2026-09-19 "fix the missing production workflow" pass, item 4: "do NOT
// blindly rebuild Visual World... determine whether the current Visual
// World still contains every canonical identity/location/object reference
// required by the new plan. If it does, reuse it. If new references are
// required, show exactly what is missing and only generate those. Do not
// duplicate existing canonical references."
//
// 2026-09-19 (SAME DAY) forensic follow-up — real Mars incident found this
// module itself under-reporting compatibility: v5's own review screen said
// "2 of 15 reusable, 13 new" when the real, correct answer (verified against
// actual long_form_reference_assets rows) is "6 of 14 reusable, 8 new."
// Two concrete bugs, both fixed here:
//
// BUG 1 — wrong requiredness predicate. This used to treat any
// `referenceNeeded: true` entity as required. But planReferenceViews (the
// ACTUAL function that decides what Visual World needs, used everywhere
// else in this app) also runs deriveRequiredViews and drops anything that
// resolves to zero views — e.g. DIAGRAM_SUBJECT entities (never get a
// photographic reference at all, see deriveRequiredViews' own fallthrough
// `return []`) and a CHARACTER whose importance is neither HERO nor
// RECURRING. Mars's real v5 registry has exactly one DIAGRAM_SUBJECT entity
// (`d_eva_budget_diagram`) that this module was wrongly counting as a 15th
// required reference. Fixed by importing and reusing deriveRequiredViews
// itself — the ONE authoritative "does this need a reference" predicate,
// never a second reimplementation of it.
//
// BUG 2 — matched by name text ONLY, never by entity id. A replanned
// VisualPlanVersion very often PRESERVES the same entity id across versions
// for an unchanged role even when the LLM planner rephrases its
// description ("on-shift crew member / protagonist" -> "habitat crew member
// / protagonist", same id `e_protagonist` both times, 60 real succeeded
// reference assets already sitting under that exact id). Matching by name
// text alone missed this and 3 other real Mars entities the SAME way
// (e_technician, l_greenhouse, o_greenhouse_chamber) — all falsely reported
// "missing" despite already having real, succeeded reference assets. A
// preserved entity id is the STRONGEST possible continuity signal (stronger
// than any text similarity heuristic) and is checked first; name+category
// match is kept as the fallback for a genuine rename (different id, same
// human-readable identity — e.g. Mars's own "agricultural specialist"
// keeping its exact name but moving from id `e_ag_spec` to
// `e_agri_specialist`).
import { deriveRequiredViews } from "./visualWorldPlanning.js";

function identityKey(name, category) {
  return `${(name ?? "").trim().toLowerCase()}::${category ?? ""}`;
}

export function assessVisualWorldCompatibility(newEntityRegistry = [], currentWorldEntities = [], continuityGroups = []) {
  const currentById = new Map((currentWorldEntities ?? []).map((e) => [e.entityId, e]));
  const currentByKey = new Map(
    (currentWorldEntities ?? []).map((e) => [identityKey(e.entityName ?? e.name, e.entityCategory ?? e.category), e])
  );
  const required = (newEntityRegistry ?? []).filter((e) => deriveRequiredViews(e, continuityGroups).length > 0);
  const reusable = [];
  const missing = [];
  for (const entity of required) {
    const matched = currentById.get(entity.id) ?? currentByKey.get(identityKey(entity.name, entity.category));
    if (matched) reusable.push({ id: entity.id, name: entity.name, category: entity.category, matchedWorldEntityId: matched.entityId });
    else missing.push({ id: entity.id, name: entity.name, category: entity.category });
  }
  return {
    compatible: missing.length === 0,
    totalRequired: required.length,
    reusableCount: reusable.length,
    missingCount: missing.length,
    reusable,
    missing,
  };
}
