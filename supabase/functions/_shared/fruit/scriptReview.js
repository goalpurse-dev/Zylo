// Script review for AI Fruit Story v2: one cheap read of a finished script by
// a second model, the way a viewer meets it (heard once, one picture per
// line), before any picture is paid for. A failed review gets ONE rewrite by
// the planner (planner.js#runPlanner); a review that can't run never blocks.
//
// Why: the launch review (Oct 2026) found 6 of 13 stories ended on a setup
// line, 3 opened on someone who wasn't in the picture, and one had an
// "undercover" cop in full uniform. The planner was asked for a hook and a
// punchline, but nothing read the result.

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
});

export const REVIEW_SYSTEM = `You are the script editor for AI Fruit Story: short vertical drama videos with fruit characters, made for TikTok. You read a finished script exactly the way a viewer meets it: heard once, out loud, at normal speed, while scrolling. Each scene is ONE picture and ONE spoken line. The viewer sees only the characters listed as "in the picture" for that scene, wearing the outfit listed for them, and knows nothing you are not told in the lines.

Check these rules. Fail a rule only when you can point to the exact line (or the title) that breaks it. Do not fail a script for taste.

ending: The last line must TURN something: a reveal, a reversal, or a price being named. It fails if the last line only agrees, obeys, greets, leaves, plans what happens next, or repeats what we already know. In an EPISODE the last line may be a cliffhanger instead, but it must be a question or threat the viewer fully understands from this episode alone (they must know who everyone in it is).

inPicture: Everyone a line talks TO, points AT, or describes as being here ("baby", "you two", "that guy", "look at her") must be in the picture for that scene. Talking ABOUT someone who is elsewhere is fine.

firstLine: The first line names or refers to at most two people besides the speaker. A chain of relationships ("my niece's husband's mistress") fails.

textMessage: When a character reads a text message, note, email or sign aloud, the words read are a line by themselves. Reading and reacting in the same line fails.

title: The title must not give away the twist or the ending.

heardOnce: Every line must be understood when heard once: no chain of relationships, no pronoun whose owner is unclear, no joke that only works written down, no line that needs an earlier line re-read.

premise: Nothing said may contradict what the pictures show. A character said to be undercover, disguised or hiding who they are must not be wearing the outfit that gives them away. A place or object a line depends on must fit the setting. Fruit characters have no hair, beards, skin or tattoos: a line that depends on one fails.

For each rule answer pass true or false. When false: scene is the scene number (0 for the title), problem says what is wrong in one plain sentence, and fix says what to change in one plain sentence. When true: scene 0 and empty strings.
Return only the JSON object.`;

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
    `CHARACTERS:\n${cast.filter((c) => used.has(c.id)).map((c) => `- ${c.name}, ${c.fruit} ${c.gender === "female" ? "woman" : "man"}; role here: ${plan.roles?.[c.id] ?? c.tag}; wears in every scene: ${outfits[c.id] ?? c.outfit ?? "their usual outfit"}`).join("\n")}`,
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
