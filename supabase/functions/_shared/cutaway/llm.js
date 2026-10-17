// Cutaway Explainer: the Claude calls. fetch only.
//   planVideo: plan -> program checks -> critic (always once, fixes everything found) -> program checks again
//   checkImage: the vision check of one wide image against its state's checklist

import { MODELS } from "./pricing.js";
import { CRITIC_SYSTEM, normalizePlan, PLAN_SCHEMA, PLANNER_SYSTEM, plannerUser, planProblems, planWarnings, repairStructure, shapeProblems } from "./planner.js";
import { OVERLAYS } from "./style.js";
import { SOUND_KEYS } from "./sound.js";

const OVERLAY_KEYS = Object.keys(OVERLAYS);
const SOUND_KEYS_SET = new Set(SOUND_KEYS);

// USD per 1M tokens (same figures as the other templates' llm.js).
const PRICE = { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 };
const costOf = (u = {}) => Number((((u.input_tokens ?? 0) * PRICE.input + (u.output_tokens ?? 0) * PRICE.output + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6).toFixed(5));

async function callTool({ apiKey, system, content, name, schema, maxTokens = 12000, timeoutMs = 180_000 }) {
  const request = {
    model: MODELS.llm.model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    tools: [{ name, description: "Return the result.", input_schema: schema }],
    tool_choice: { type: "tool", name },
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => null);
  const costUsd = costOf(body?.usage);
  if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { costUsd });
  if (body?.stop_reason === "max_tokens") throw Object.assign(new Error("output truncated"), { costUsd });
  const block = (body?.content ?? []).find((b) => b?.type === "tool_use");
  if (!block) throw Object.assign(new Error("no tool result"), { costUsd });
  return { data: block.input, costUsd };
}

export const MAX_CRITIC_ROUNDS = 2;

/**
 * Plan, then the critic: always one round, a second only if the program still finds problems.
 * Every raw output and its problems are kept (trace), so a failure can be read afterwards.
 * Returns {plan, costUsd, critic: {rounds: [problems...]}, trace}.
 */
/** @param {{apiKey: string, topic: string, lengthSec: number, usedIdeas?: string[], onTrace?: (t: object) => void}} input */
export async function planVideo({ apiKey, topic, lengthSec, usedIdeas = [], onTrace = undefined }) {
  let costUsd = 0;
  const trace = [];
  const note = (entry) => { trace.push(entry); onTrace?.(entry); };
  try {
    // The planner: a malformed reply (wrong counts, missing fields) is retried once right away, never sent to the critic.
    let first = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const reply = await callTool({ apiKey, system: PLANNER_SYSTEM, content: plannerUser({ topic, lengthSec, usedIdeas }), name: "cutaway_plan", schema: PLAN_SCHEMA });
      costUsd += reply.costUsd;
      const shape = shapeProblems(reply.data, lengthSec);
      note({ stage: `planner ${attempt}`, costUsd: reply.costUsd, problems: shape.map((p) => `SHAPE: ${p}`), output: reply.data });
      if (!shape.length) { first = reply; break; }
      if (attempt === 2) throw Object.assign(new Error(`PLAN_INVALID: the planner's reply was malformed twice: ${shape.join("; ")}`), { problems: shape });
    }
    let plan = repairPlan(first.data);
    let problems = planProblems(plan, lengthSec, usedIdeas);
    note({ stage: "planner checks", costUsd: 0, problems, output: null });
    const rounds = [problems];
    for (let round = 1; round <= MAX_CRITIC_ROUNDS; round++) {
      if (round > 1 && !problems.length) break;
      const critic = await callTool({
        apiKey, system: CRITIC_SYSTEM, name: "cutaway_plan", schema: PLAN_SCHEMA,
        content: [
          plannerUser({ topic, lengthSec, usedIdeas }),
          `PROBLEMS FOUND BY THE PROGRAM (${problems.length}):\n${problems.length ? problems.map((p) => `- ${p}`).join("\n") : "- none; still check every rule, especially that each fact is true"}`,
          ...(planWarnings(plan).length ? [`ALSO FIX IF YOU CAN:\n${planWarnings(plan).map((p) => `- ${p}`).join("\n")}`] : []),
          `THE PLAN:\n${JSON.stringify(plan)}`,
        ].join("\n\n"),
      });
      costUsd += critic.costUsd;
      const shape = shapeProblems(critic.data, lengthSec);
      if (shape.length) {
        // A malformed critic reply is thrown away: keep the plan we had.
        note({ stage: `critic ${round} (malformed, discarded)`, costUsd: critic.costUsd, problems: shape.map((p) => `SHAPE: ${p}`), output: critic.data });
        rounds.push(problems);
        continue;
      }
      plan = repairPlan(critic.data);
      problems = planProblems(plan, lengthSec, usedIdeas);
      note({ stage: `critic ${round}`, costUsd: critic.costUsd, problems, output: critic.data });
      rounds.push(problems);
    }
    if (problems.length) throw Object.assign(new Error(`PLAN_INVALID after the critic: ${problems.join("; ")}`), { problems });
    return { plan: normalizePlan(plan), costUsd: Number(costUsd.toFixed(5)), critic: { rounds, warnings: planWarnings(plan) }, trace };
  } catch (e) {
    e.costUsd = Number((costUsd + (e.costUsd ?? 0)).toFixed(5));
    e.trace = trace;
    if (!/^PLAN_INVALID/.test(e.message)) e.message = `PLAN_FAILED: ${e.message}`;
    throw e;
  }
}

/** Mechanical fixes only (never content): unknown overlay or move -> a default, a sound key in the overlay slot moved over. */
export function repairPlan(input) {
  if (!input || !Array.isArray(input.beats)) return input;
  const plan = JSON.parse(JSON.stringify(input));
  for (const b of plan.beats) {
    if (!OVERLAY_KEYS.includes(b.overlay)) {
      if (SOUND_KEYS_SET.has(b.overlay) && !b.sound?.key) b.sound = { key: b.overlay, text: "", at: "verb", whole: false };
      b.overlay = "arrows";
    }
    if (!["push-in", "pull-out", "follow", "arc", "hold"].includes(b.move)) b.move = "push-in";
    if (b.sound && b.sound.key && !SOUND_KEYS_SET.has(b.sound.key)) b.sound = { key: "custom", text: b.sound.text || b.sound.key, at: b.sound.at === "start" ? "start" : "verb", whole: Boolean(b.sound.whole) };
    if (!b.card) b.card = { text: "", word: "" };
  }
  return repairStructure(plan);
}

const VISION_SCHEMA = {
  type: "object", additionalProperties: false, required: ["checks", "pass", "fix"],
  properties: {
    checks: { type: "array", items: { type: "object", additionalProperties: false, required: ["check", "ok", "seen"], properties: { check: { type: "string" }, ok: { type: "boolean" }, seen: { type: "string" } } } },
    pass: { type: "boolean" },
    fix: { type: "string" },
  },
};

export const VISION_SYSTEM = `You check one generated image of a 3D cutaway diorama for a "how it works" explainer video, against a short checklist.

THE HOUSE STYLE. These are CORRECT, never a defect:
- water and other liquids tinted light blue / cyan (never clear glass)
- the ground sliced open as a cutaway, with buried contents (pipes, tanks, trash, foundations) shown in the cut face
- stylised-realistic 3D game-art look, dioramas whose world runs to the frame edges
- every element named in THE PLAN below (for example a gas flare burning, a truck, rain) is meant to be there

JUDGE ONLY:
1. each checklist line: ok true/false, and what you actually see
2. clear defects a viewer would notice: a part in the wrong place, a part missing, an extra part that isn't in the plan, the buildings or setting changing from the scene description, anything that contradicts what the voiceover says (THE PLAN), garbled text or labels.
Do not fail an image for taste, realism or colour choices that follow the house style.

pass = every checklist line is ok AND no clear defect. If it fails, "fix" is one or two short sentences telling the image editor exactly what to change; otherwise "".`;

/**
 * The vision check. An empty reply (no checklist results) means the check didn't run, not that
 * the image failed: it is re-run up to 2 times; if it is still empty, the image is "unchecked".
 * Returns {pass: true|false|null, fix, checks, costUsd, emptyReplies}.
 */
export async function checkImage({ apiKey, imageUrl, description, checks, plan = "" }) {
  let costUsd = 0;
  let emptyReplies = 0;
  for (let attempt = 0; attempt <= 2; attempt++) {
    const { data, costUsd: c } = await callTool({
      apiKey, system: VISION_SYSTEM, name: "image_check", schema: VISION_SCHEMA, maxTokens: 1500, timeoutMs: 90_000,
      content: [
        { type: "image", source: { type: "url", url: imageUrl } },
        { type: "text", text: `THE PLAN (what the video shows and says around this image):\n${plan}\n\nWhat THIS image should show: ${description}\n\nChecklist:\n${checks.map((x) => `- ${x}`).join("\n")}` },
      ],
    });
    costUsd += c;
    const results = Array.isArray(data?.checks) ? data.checks.filter((x) => x && typeof x.ok === "boolean") : [];
    if (results.length) return { pass: Boolean(data.pass) && results.every((x) => x.ok), fix: String(data.fix ?? "").replace(/^"+|"+$/g, ""), checks: results, costUsd: Number(costUsd.toFixed(5)), emptyReplies };
    emptyReplies += 1;
  }
  return { pass: null, fix: "", checks: [], costUsd: Number(costUsd.toFixed(5)), emptyReplies };
}
