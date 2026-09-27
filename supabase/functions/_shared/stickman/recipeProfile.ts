// deno-lint-ignore-file no-explicit-any
// stickman/recipeProfile.ts — Phase 1 "Stickman Script Mode" pass.
//
// A tiny shared helper so generate-long-form-story-plan and
// advance-long-form-script can both branch on recipe the same way
// build-stickman-production-bible/index.ts already does (its own inline
// `long_form_generation_profiles` lookup + literal recipe_version compare) —
// centralized here instead of copy-pasted a third and fourth time.
//
// Neither Story Plan nor Script previously queried long_form_generation_profiles
// at all — both only read long_form_projects. The active profile is
// guaranteed to exist by the time either function runs: Setup
// (create-long-form-production-setup) always creates it before the project
// ever leaves "planning" for the Story page.

import { STICKMAN_DOODLE_EXPLAINER_V1 } from "./styleContract.ts";

export async function fetchActiveGenerationProfile(admin: any, projectId: string): Promise<any | null> {
  const { data } = await admin
    .from("long_form_generation_profiles")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();
  return data ?? null;
}

export function isStickmanProfile(profile: any): boolean {
  return profile?.recipe_version === STICKMAN_DOODLE_EXPLAINER_V1.recipeVersion;
}

// niche has no dedicated column anywhere in the schema — it only ever lives
// inside the generation profile's raw_setup_snapshot (see
// create-long-form-production-setup/index.ts, which stores the whole Setup
// payload verbatim there). Returns null for a project created before niche
// was collected, or if Setup was never given one.
export function nicheFromProfile(profile: any): string | null {
  const niche = profile?.raw_setup_snapshot?.niche;
  return typeof niche === "string" && niche.trim() ? niche.trim() : null;
}
