// Script review for Blocky Stories: one cheap read of a finished script by
// a second model, the way a viewer meets it (heard once, one picture per
// line), before any picture is paid for. A failed review gets ONE rewrite by
// the planner (planner.js#runPlanner); a review that can't run never blocks.
//
// Why: the launch review (Oct 2026) found 6 of 13 stories ended on a setup
// line, 3 opened on someone who wasn't in the picture, and one had an
// "undercover" cop in full uniform. The planner was asked for a hook and a
// punchline, but nothing read the result.

import { REVIEW_SYSTEM } from "./rules.js";
export { REVIEW_SYSTEM };

export const REVIEW_PURPOSE = "script_review";

/** The rules, in the order the editor checks them. id → what the planner is told when it fails. */
export const REVIEW_RULES = Object.freeze({
  ending: "the last line must turn something",
  inPicture: "everyone a line talks to, points at or describes must be in that scene's picture",
  firstLine: "the first line names at most two people",
  textMessage: "a text message read aloud gets its own line",
  title: "the title must not give away the twist",
  heardOnce: "every line must land when heard once, out loud",
  premise: "nothing said may contradict what the pictures show",
  retell: "a viewer must be able to retell the story in one sentence after watching once",
});

export function reviewSchema() {
  const rule = { type: "object", additionalProperties: false, required: ["pass", "scene", "problem", "fix"], properties: { pass: { type: "boolean" }, scene: { type: "integer" }, problem: { type: "string" }, fix: { type: "string" } } };
  const ids = Object.keys(REVIEW_RULES);
  return { type: "object", additionalProperties: false, required: ids, properties: Object.fromEntries(ids.map((id) => [id, rule])) };
}

/**
 * The script as the editor reads it.
 * @param {object} p  {plan, cast, source, series?}  plan = validatePlan's plan
 */
export function buildReviewPrompt({ plan, cast, source, series }) {
  const byId = new Map(cast.map((c) => [c.id, c]));
  const name = (id) => byId.get(id)?.name ?? id;
  const outfits = plan.outfits ?? {};
  const used = new Set(plan.scenes.flatMap((s) => s.presentIds));
  const loc = new Map((plan.locations ?? []).map((l) => [l.id, l.description]));
  const parts = [
    `TITLE: ${plan.title}`,
    source === "episode"
      ? `KIND: episode ${series?.episode?.number ?? ""} of a series. The last line must deliver this cliffhanger so that a new viewer understands it: ${series?.episode?.cliffhanger ?? "(the planned cliffhanger)"}`
      : "KIND: a single complete video (not an episode).",
    `CHARACTERS:\n${cast.filter((c) => used.has(c.id)).map((c) => `- ${c.name}, blocky game avatar; role here: ${plan.roles?.[c.id] ?? c.tag}; wears in every scene: ${outfits[c.id] ?? c.look ?? "their usual look"}`).join("\n")}`,
    `SCRIPT:\n${plan.scenes.map((s, i) => `${i + 1}. [in the picture: ${s.presentIds.map(name).join(", ")}; place: ${loc.get(s.locationId) ?? "?"}] ${name(s.speakerId)}: ${s.line}`).join("\n")}`,
  ];
  return { system: REVIEW_SYSTEM, user: parts.join("\n\n") };
}

/** The model's answer → the problems to fix (empty = passed). Unknown or malformed rules count as passed. */
export function reviewProblems(data) {
  const problems = [];
  for (const [id, summary] of Object.entries(REVIEW_RULES)) {
    const r = data?.[id];
    if (!r || r.pass !== false) continue;
    const problem = String(r.problem ?? "").trim() || summary;
    problems.push({ rule: id, scene: Number.isInteger(r.scene) && r.scene > 0 ? r.scene : 0, problem, fix: String(r.fix ?? "").trim() });
  }
  return problems;
}

/** One line per problem, as the planner is told. */
export const problemLines = (problems) => problems.map((p) => `${p.scene ? `scene ${p.scene}` : "title or whole script"} (${REVIEW_RULES[p.rule]}): ${p.problem}${p.fix ? ` Fix: ${p.fix}` : ""}`);

/**
 * Runs the review. Never throws: {ok:true, problems:[], skipped:"..."} when it can't run.
 * @param {object} p  {plan, cast, source, series, llm}  llm({system,user,schema,name,purpose,review:true}) -> {data}
 */
export async function reviewScript({ plan, cast, source, series, llm }) {
  if (source === "script") return { ok: true, problems: [], skipped: "the user's own lines are never rewritten" };
  try {
    const { system, user } = buildReviewPrompt({ plan, cast, source, series });
    const r = await llm({ system, user, schema: reviewSchema(), name: "script_review", purpose: REVIEW_PURPOSE, review: true });
    const problems = reviewProblems(r.data);
    return { ok: problems.length === 0, problems };
  } catch (e) {
    return { ok: true, problems: [], skipped: `review could not run: ${String(e?.message ?? e).slice(0, 120)}` };
  }
}
