// Script review for Blocky Stories: one cheap read of a finished script by
// a second model, the way a viewer meets it (heard once, one picture per
// line), before any picture is paid for. It checks the script against the
// twist plan (twists.js): the clue is really in scene 1 or 2, the payoff really
// happens and uses it. What fails is rewritten by the planner
// (planner.js#runPlanner) and checked again; a review that can't run never blocks.
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
  firstLine: "the first line must be a hook: mid-action or mid-mystery, something at stake, at most two people named",
  escalation: "every scene must make it worse, weirder or higher stakes than the one before; no line just throws the last one back",
  clue: "the plan's clue must really be in scene 1 or 2, in the line or in what is seen, without being explained",
  payoff: "the plan's payoff must happen on screen in the reveal scene, use the clue, and be named by the line; nobody admits or explains",
  ending: "something must change for someone on screen, and the winner's last line (8 words or fewer) lands it without explaining the twist",
  cast: "every cause is someone in the cast; nobody outside it is blamed or spoken to",
  powers: "nobody really does what their role can't (a player's ban never works; an admin's does)",
  natural: "the lines must sound spoken and vary in length; no speaker has three lines in a row",
  voice: "every line must be something THIS speaker would say here, with I, my, you and your pointing at the right one",
  inPicture: "everyone a line talks to, points at or describes must be in that scene's picture",
  textMessage: "nothing in the story may need reading on screen, and nobody reads anything aloud",
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
    // What the viewer sees of each character. Their role in this story is in the writer's notes below: the viewer
    // doesn't know it unless a line says it (the editor once failed a reveal for "repeating" a role it had been shown).
    `CHARACTERS (as the viewer sees them):\n${cast.filter((c) => used.has(c.id)).map((c) => `- ${c.name}, blocky game avatar; looks like this in every scene: ${outfits[c.id] ?? c.look ?? "their usual look"}`).join("\n")}`,
    // What the speaker is seen doing is part of the picture: a proof held up there is a proof the viewer sees.
    `SCRIPT:\n${plan.scenes.map((s, i) => `${i + 1}. [in the picture: ${s.presentIds.map(name).join(", ")}; place: ${loc.get(s.locationId) ?? "?"}${s.action ? `; ${name(s.speakerId)} ${s.action}` : ""}] ${name(s.speakerId)}: ${s.line}`).join("\n")}`,
    [
      "WRITER'S NOTES (the viewer NEVER sees these; they are here so you can check that the story delivers them):",
      `premise: ${plan.premise || "(none given)"}`,
      `dominant emotion: ${plan.emotion || "(none given)"}`,
      ...(plan.assumed ? [`what the viewer is meant to assume after the first two lines: ${plan.assumed}`] : []),
      `twist: ${plan.twist || "(none given)"}`,
      ...(plan.clue ? [`THE CLUE, planned for scene ${plan.clueScene}: ${plan.clue}`] : []),
      ...(plan.payoff ? [`THE PAYOFF, planned for scene ${plan.revealScene}: ${plan.payoff}`] : plan.revealScene ? [`the writer says the twist is revealed in scene ${plan.revealScene}`] : []),
      ...(plan.consequence ? [`what is meant to have changed by the end: ${plan.consequence}`] : []),
      ...(plan.winnerId ? [`the winner, who speaks the last line: ${name(plan.winnerId)}`] : []),
      `roles: ${cast.filter((c) => used.has(c.id)).map((c) => `${c.name} is ${plan.roles?.[c.id] ?? c.tag}`).join("; ")}`,
      ...(plan.scenes.some((s) => s.raises) ? [`what each scene is meant to raise: ${plan.scenes.map((s, i) => `${i + 1}. ${s.raises || "?"}`).join(" ")}`] : []),
    ].join("\n"),
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
