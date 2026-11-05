// STRESS TEST of the story director + matcher: ~200 wild topics, made WITHOUT AI by a combinatorial generator
// (settings x creatures x events x twists x moods), each run through the director, every gap logged, the missing
// capabilities ranked.
//
// FREE (no network):
//   node dev/stress.mjs                    200 topics -> stand-in idea card -> stand-in script -> MOCK director + matcher
//                                          -> out/stress/topics.json, gaps.jsonl, report.json, report.md + the ranked list
//   node dev/stress.mjs --n 50 --seed 7    another sample
//   node dev/stress.mjs --costs            the exact token + USD estimate of every REAL option (no call)
//
// PAID (prepared, NOT run by the agents; the owner's go first). Needs ANTHROPIC_KEY in the environment, --yes, and a
// money cap: every call is started only when its WORST case still fits under --max-usd (the run stops cleanly there).
//   (a) node dev/stress.mjs --real cards  --model haiku  --max-usd 1.00 --yes          topic -> idea card (1 call) + director on the card
//   (b) node dev/stress.mjs --real script --model haiku  --max-usd 2.00 --yes          (a) + a full 90 s script (1 call) + director on the script
//   (c) node dev/stress.mjs --real script --model sonnet --n 20 --max-usd 3.00 --yes   the calibration sample, strong model everywhere
//   --script-model / --director-model override the model of one step (haiku | sonnet); --concurrency 4 (default)
//   -> out/stress/real-<mode>-<model>/: cards.json, scripts.json, productions.json, gaps.jsonl, report.md, spend.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rng } from "../lib/rng.js";
import { directStory } from "../lib/director/index.js";
import { DIRECTOR_SYSTEM, DIRECTOR_MODELS, directorTokens, directorPrompt, callUsd, tokensOf, anthropicDirector } from "../lib/director/design.js";
import { makeGapLog, jsonlStore, rankGaps, formatRanked } from "../lib/gaps.js";
import { registryTable } from "../lib/capabilities.js";
import { PRICE } from "../lib/builder/design.js";
import { standInScript } from "./coverage.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SHARED = path.resolve(ROOT, "../../../supabase/functions/_shared/blockyWorlds");
const OUT = path.join(ROOT, "out/stress");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
export const MODEL_IDS = Object.freeze({ haiku: DIRECTOR_MODELS.fast, sonnet: DIRECTOR_MODELS.strong });

// ------------------------------------------------------------------------------------------------ the topic generator
const V = {
  animal: ["turtle", "whale", "snail", "elephant", "crab", "frog", "wolf", "bear", "octopus", "cat", "dog", "moose", "pigeon", "ant", "shark", "giraffe", "beetle", "goat", "owl", "hamster"],
  creature: ["robot", "ghost", "alien", "dragon", "goblin", "yeti", "zombie", "mermaid", "troll", "vampire", "scarecrow", "snowman", "mummy", "wizard"],
  job: ["dentist", "mayor", "teacher", "baker", "mailman", "chef", "librarian", "barber", "lifeguard", "judge", "firefighter", "bus driver", "zookeeper", "principal"],
  place: ["volcano", "moon", "desert", "glacier", "swamp", "junkyard", "castle", "lighthouse", "island", "mall", "hospital", "zoo", "carnival", "factory", "library", "bakery", "train station", "museum", "farm", "beach"],
  sky: ["the moon", "the sun", "a star", "the sky", "a comet", "the clouds"],
  water: ["the lake", "the ocean", "the river", "the town pool", "the bathtub", "the fountain"],
  food: ["cheese", "pancakes", "jelly", "soup", "popcorn", "ice cream", "spaghetti", "pickles", "toast", "pudding"],
  time: ["noon", "midnight", "bedtime", "dawn", "sunset", "lunchtime", "recess", "dinner"],
  thing: ["mail", "pizza", "homework", "newspapers", "birthday cakes", "milk", "groceries", "library books", "umbrellas", "sandwiches"],
  vehicle: ["rockets", "submarines", "trains", "hot air balloons", "pirate ships", "helicopters", "school buses", "bicycles", "sleds", "tractors"],
  crowd: ["army", "herd", "swarm", "pack", "flock", "parade"],
  crowdAct: ["marches through", "charges into", "floods into", "stampedes across", "takes over", "invades"],
  weather: ["it rains frogs", "it snows upward", "a tornado visits", "lightning picks a new mayor", "the fog eats sounds", "a flood comes", "an earthquake rocks", "a blizzard buries", "the volcano erupts", "the ocean freezes"],
  effect: ["catches fire", "explodes into confetti", "starts to glow", "turns to stone", "shrinks to the size of a mouse", "grows ten times bigger", "vanishes", "turns into a frog"],
  prop: ["a rubber duck", "a tin whistle", "a jar of honey", "a broken compass", "a roll of tape", "a squeaky shoe", "a glow stick", "a paper crown", "a fishing net", "a kazoo"],
  name: ["Pip", "Mo", "Juno", "Rex", "Tilly", "Ozzie", "Bea", "Kit", "Nell", "Zed"],
  neighbor: ["Mr. Plunk", "Mrs. Fig", "Coach Bolt", "Old Gus", "Grandma Ida", "Dr. Pepperell", "Mayor Hoot", "Miss Tansy"],
};
const TEMPLATES = [
  ["our whole town lives inside a giant {animal}", "inside something giant"],
  ["our city sits on the back of a giant {animal}", "on a giant creature"],
  ["the {job} is a {creature}", "town square"],
  ["{creature}s deliver the {thing}", "suburb street"],
  ["{sky} falls into {water} every night", "town square"],
  ["everyone turns into {food} at {time}", "suburb street"],
  ["our school is built inside a {place}", "school"],
  ["an {crowd} of {animal}s {crowdAct} town at {time}", "town square"],
  ["{weather} every {time}", "suburb street"],
  ["a giant {animal} sleeps under the {place}", "woods"],
  ["the whole town is underwater on weekends", "underwater"],
  ["kids fly {vehicle} to school", "suburb street"],
  ["the {place} {effect} whenever someone lies", "town square"],
  ["{creature}s run the {place}", "town square"],
  ["our town floats above the clouds and {weather}", "sky"],
  ["kids ride {animal}s to school", "suburb street"],
  ["the moon is made of {food} and we mine it", "on the moon"],
  ["every pet {effect} when it hears music", "home"],
  ["a {creature} {job} visits every house at {time}", "home"],
  ["giant {animal}s guard the {place}", "woods"],
  ["{vehicle} are pulled by {animal}s", "suburb street"],
  ["the town lives in a cave under a sleeping {creature}", "underground"],
  ["a {crowd} of {creature}s cheers whenever a kid wins", "school"],
  ["our town is on a {place} that walks", "on a giant creature"],
];
const TWIST_LINES = [
  "Then a {crowd} of {animal}s {crowdAct} the town square.", "The {creature} roared and stomped down the street.", "{weather}, and everyone ran.",
  "The {place} {effect}.", "Suddenly {sky} fell into {water}.", "The giant {animal} woke up and started to walk.", "A hundred {creature}s marched out of the fog.",
  "Our {vehicle} flew over the {place}.", "The whole town cheered as the {vehicle} landed.", "I hid behind {neighbor}'s fence while the ground shook.",
];
const fill = (s, R) => s.replace(/\{(\w+)\}/g, (_, k) => R.pick(V[k]));
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** ~n distinct wild topics, deterministic per seed: [{ id, topic, setting, mood, template }] */
export function makeTopics(n = 200, seed = 11) {
  const R = rng(seed), out = [], seen = new Set();
  const moods = ["horror", "funny", "wholesome", "epic"];
  for (let k = 0; out.length < n && k < n * 50; k++) {
    const ti = Math.floor(R() * TEMPLATES.length);
    const [tpl, setting] = TEMPLATES[ti];
    const topic = fill(tpl, R).replace(/\ban ([^aeiou])/g, "a $1").replace(/\ba ([aeiou])/g, "an $1");
    if (seen.has(topic)) continue;
    seen.add(topic);
    out.push({ id: `t${String(out.length + 1).padStart(3, "0")}`, topic, setting, mood: moods[Math.floor(R() * 4)], template: ti });
  }
  return out;
}

/** a stand-in idea card for a topic (no AI): the topic in the opener + generated examples, escalation and twist */
export function standInCard(t, seed = 1) {
  const R = rng(seed);
  const nar = R.pick(V.name), prop = R.pick(V.prop);
  const lines = [fill(R.pick(TWIST_LINES), R), fill(R.pick(TWIST_LINES), R), fill(R.pick(TWIST_LINES), R)];
  return {
    title: cap1(t.topic.split(" ").slice(0, 4).join(" ")), mood: t.mood, setting: t.setting, formula: "F2", twistType: "T1",
    opener: `In this world, ${t.topic}.`,
    premise: `In a town where ${t.topic}, ${nar} is the only kid who notices what is really going on.`,
    price: fill(R.pick(["If you break the rule, {weather} on your house.", "Break the rule and your {thing} turn into {food}.", "Break the rule and a {creature} moves into your room.", "Break the rule and you sleep in the {place}."]), R),
    examples: [fill(`{neighbor} keeps ${R.pick(V.thing)} in a jar by the door.`, R), fill(R.pick(["The {job} waves at {sky} at {time}.", "The {job} counts {thing} at {time}.", "The {job} hides from {sky} at {time}."]), R), fill("{neighbor}'s {animal} refuses to go outside.", R)],
    narrator: `${nar}, the kid nobody listens to.`, prop,
    twist: `${lines[0]} ${lines[1]} ${lines[2]} In the end ${prop} saves everyone.`,
    teaser: "Nobody believed me until it was too late.", closer: `Now ${t.topic.split(" ").slice(0, 6).join(" ")}, and I am in charge.`,
  };
}

// ------------------------------------------------------------------------------------------------ the free run
export async function runFree({ n = 200, seed = 11, outDir = OUT, quiet = false } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const topics = makeTopics(n, seed);
  fs.writeFileSync(path.join(outDir, "topics.json"), JSON.stringify(topics, null, 1));
  const gapsFile = path.join(outDir, "gaps.jsonl");
  fs.rmSync(gapsFile, { force: true });
  const gapLog = makeGapLog({ store: jsonlStore(gapsFile) });
  const results = [];
  for (const t of topics) {
    const idea = standInCard(t, seed * 1000 + Number(t.id.slice(1)));
    const script = standInScript(idea);
    const r = await directStory({ script, idea, provider: "mock", gapLog, storyId: t.id, source: "stress", exists });
    results.push({ id: t.id, topic: t.topic, lines: script.lines.length, summary: r.match.summary, worlds: r.production.worlds.map((w) => `${w.kind}${w.creature.relation !== "none" ? `:${w.creature.relation}` : ""}`), capabilities: [...new Set(r.match.calls.map((c) => c.capability))], problems: r.problems.length });
  }
  return { topics, results, ...(await aggregate({ results, gapLog, outDir, quiet, title: `FREE stress run: ${topics.length} topics, mock director (seed ${seed})` })) };
}

/** the aggregate report: usage per capability, coverage shares, the ranked gaps */
export async function aggregate({ results, gapLog, outDir, quiet = false, title = "stress run" }) {
  const rows = await gapLog.list();
  const byCap = rankGaps(rows, { by: "capability" }), byDetail = rankGaps(rows, { by: "detail" });
  const N = results.length || 1;
  const avg = (f) => Number((results.reduce((a, r) => a + f(r), 0) / N).toFixed(3));
  const usage = new Map();
  for (const r of results) for (const c of r.capabilities) usage.set(c, (usage.get(c) ?? 0) + 1);
  const stats = {
    stories: results.length, avgLines: avg((r) => r.lines), avgItems: avg((r) => r.summary.items), avgBuilderNeeds: avg((r) => r.summary.builderNeeds),
    avgGaps: avg((r) => r.summary.gaps), avgDirectorMs: avg((r) => r.ms ?? 0), avgDirectorUsd: Number((results.reduce((a, r) => a + (r.costUsd ?? 0), 0) / N).toFixed(5)), storiesWithGaps: results.filter((r) => r.summary.gaps > 0).length,
    shownShare: avg((r) => r.summary.shownShare), fullShare: avg((r) => r.summary.fullShare), cardShare: avg((r) => r.summary.lineItemsCard / Math.max(1, r.summary.lineItems)),
    worldKinds: Object.fromEntries([...results.flatMap((r) => r.worlds).reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])),
    usage: Object.fromEntries([...usage].sort((a, b) => b[1] - a[1])),
  };
  const text = [
    `# ${title}`, "",
    `stories ${stats.stories}, avg lines ${stats.avgLines}, avg items ${stats.avgItems}, avg builder needs ${stats.avgBuilderNeeds}, avg gaps ${stats.avgGaps} (${stats.storiesWithGaps} stories with a gap)`,
    `line items shown by a real system or the builder: ${(stats.shownShare * 100).toFixed(1)}%; met in full: ${(stats.fullShare * 100).toFixed(1)}%; picture cards: ${(stats.cardShare * 100).toFixed(1)}%`,
    `world kinds: ${Object.entries(stats.worldKinds).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `director per story: ${stats.avgDirectorMs} ms, $${stats.avgDirectorUsd}; fell back to the mock: ${results.filter((r) => r.fellBack).length}`,
    `capabilities used (stories): ${Object.entries(stats.usage).map(([k, v]) => `${k} ${v}`).join(", ")}`, "",
    "## Missing capabilities, ranked (by capability)", "", formatRanked(byCap, { top: 20, totalStories: stats.stories }), "",
    "## Missing capabilities, ranked (capability + exactly what)", "", formatRanked(byDetail, { top: 30, totalStories: stats.stories }), "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "report.md"), text);
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ stats, byCapability: byCap, byDetail, results }, null, 1));
  if (!quiet) console.log(text);
  return { stats, byCap, byDetail, text };
}

// ------------------------------------------------------------------------------------------------ costs (no call)
async function sharedPrompts() {
  const ideas = await import(pathToFileURL(path.join(SHARED, "ideas.js")).href);
  const script = await import(pathToFileURL(path.join(SHARED, "script.js")).href);
  return { ideas, script };
}
/** a real 90 s script's line count (protocol: ~330 words, lines of ~8-12 words) */
export const REAL_SCRIPT_LINES = 34;
/** thinking allowances on top of the visible answer (adaptive thinking; effort low ~ +25%, medium ~ +100%) */
const THINK = { low: 1.25, medium: 2.0 };
const usd = (model, inTok, outTok, sysTok, cached) => callUsd(model, { system: sysTok, user: inTok, output: outTok }, { cached });

/** measured token sizes of every call in the real run (from the real prompts + the mock's answers) */
export async function measure({ n = 200, seed = 11 } = {}) {
  const { ideas, script } = await sharedPrompts();
  const topics = makeTopics(n, seed);
  const ideasSys = tokensOf(ideas.IDEAS_SYSTEM) + tokensOf(JSON.stringify(ideas.ideasSchema()), true);
  const topicUser = Math.ceil(topics.reduce((a, t) => a + tokensOf(ideas.topicPrompt({ topic: t.topic }).text), 0) / topics.length);
  const sample = topics.map((t) => standInCard(t, seed * 1000 + Number(t.id.slice(1))));
  const cardOut = Math.ceil(sample.reduce((a, c) => a + tokensOf(JSON.stringify(c), true), 0) / sample.length) * 3; // 3 cards a topic call
  const scriptSys = tokensOf(script.SCRIPT_SYSTEM) + tokensOf(JSON.stringify(script.scriptSchema()), true);
  const scriptUser = Math.ceil(sample.reduce((a, c) => a + tokensOf(script.scriptPrompt({ idea: c, lengthSec: 90 })), 0) / sample.length);
  const scriptOut = tokensOf(JSON.stringify({ title: "x", lines: Array.from({ length: 34 }, () => ({ part: "tour", text: "x".repeat(46) })), post: { title: "x".repeat(60), description: "x".repeat(220), hashtags: Array(5).fill("#blockyworld") } }), true);
  // the director: on the card (topic-only) and on a full script; output = the mock's production JSON x 1.3 (an AI lists more)
  let dCard = { input: 0, output: 0, system: 0 }, dScript = { input: 0, output: 0, system: 0 };
  for (const c of sample) {
    const mc = (await directStory({ idea: c, provider: "mock", exists })).production;
    const tc = directorTokens({ lines: (await import("../lib/director/mock.js")).linesOf({ idea: c }), idea: c, outputJson: JSON.stringify(mc).repeat(1) });
    // a real 90 s script has ~34 lines (~330 words at 220 wpm, ~9.7 words a line); the stand-in has ~15, so the
    // script is sized by repeating its lines to 34 and the per-line part of the answer scaled the same way
    const s = standInScript(c);
    const L = REAL_SCRIPT_LINES;
    const lines34 = Array.from({ length: L }, (_, i) => s.lines[i % s.lines.length]);
    const ms = (await directStory({ script: s, idea: c, provider: "mock", exists })).production;
    const perLine = JSON.stringify(ms.lines).length / Math.max(1, ms.lines.length);
    const scaled = JSON.stringify({ ...ms, lines: [] }) + "x".repeat(Math.ceil(perLine * L));
    const ts = directorTokens({ lines: lines34, idea: c, outputJson: scaled });
    dCard = { system: tc.system, input: dCard.input + tc.user, output: dCard.output + tc.output };
    dScript = { system: ts.system, input: dScript.input + ts.user, output: dScript.output + ts.output };
  }
  const k = sample.length;
  return {
    topicCard: { system: ideasSys, user: topicUser, output: Math.ceil(cardOut * THINK.low), effort: "low" },
    script: { system: scriptSys, user: scriptUser, output: Math.ceil(scriptOut * THINK.medium), effort: "medium" },
    directorOnCard: { system: dCard.system, user: Math.ceil(dCard.input / k), output: Math.ceil((dCard.output / k) * 1.3), effort: "low" },
    directorOnScript: { system: dScript.system, user: Math.ceil(dScript.input / k), output: Math.ceil((dScript.output / k) * 1.3), effort: "low" },
  };
}

/** the cost of one option: { calls, usd (expected: system prompt cached after the first call), worst (no cache hits) } */
export function optionCost(T, { n, mode, cardModel, scriptModel, directorModel }) {
  const steps = [["topicCard", cardModel]];
  if (mode === "script") steps.push(["script", scriptModel], ["directorOnScript", directorModel]);
  else steps.push(["directorOnCard", directorModel]);
  let exp = 0, worst = 0;
  const per = [];
  for (const [k, m] of steps) {
    const t = T[k];
    const first = usd(m, t.user, t.output, t.system, false), later = usd(m, t.user, t.output, t.system, true);
    const e = first + later * (n - 1), w = first * n;
    exp += e; worst += w;
    per.push({ step: k, model: m, inTok: t.system + t.user, outTok: t.output, perCall: Number(later.toFixed(5)), firstCall: Number(first.toFixed(5)), total: Number(e.toFixed(4)) });
  }
  return { n, mode, calls: n * steps.length, usd: Number(exp.toFixed(3)), worst: Number(worst.toFixed(3)), per };
}

export async function costTable({ n = 200, seed = 11 } = {}) {
  const T = await measure({ n, seed });
  const H = MODEL_IDS.haiku, S = MODEL_IDS.sonnet;
  const opts = [
    ["(a) cards, Haiku everywhere", { n, mode: "cards", cardModel: H, scriptModel: H, directorModel: H }],
    ["(a) cards, Haiku card + Sonnet director", { n, mode: "cards", cardModel: H, scriptModel: H, directorModel: S }],
    ["(b) scripts, Haiku everywhere", { n, mode: "script", cardModel: H, scriptModel: H, directorModel: H }],
    ["(b) scripts, Sonnet script (as production) + Haiku director", { n, mode: "script", cardModel: H, scriptModel: S, directorModel: H }],
    ["(b) scripts, Sonnet everywhere", { n, mode: "script", cardModel: S, scriptModel: S, directorModel: S }],
    ["(c) 20 topics, Sonnet everywhere (calibration)", { n: 20, mode: "script", cardModel: S, scriptModel: S, directorModel: S }],
    ["(c) 20 topics, Sonnet script + Sonnet director, Haiku card", { n: 20, mode: "script", cardModel: H, scriptModel: S, directorModel: S }],
  ];
  return { tokens: T, options: opts.map(([name, o]) => ({ name, ...optionCost(T, o) })), price: PRICE };
}

// ------------------------------------------------------------------------------------------------ the paid run
async function callJson({ apiKey, model, system, user, schema, effort, maxTokens = 12000 }) {
  const sonnet = model.startsWith("claude-sonnet-5-5");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(sonnet ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}) },
    body: JSON.stringify({ model, max_tokens: maxTokens, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: user }], output_config: { effort, format: { type: "json_schema", schema } }, ...(sonnet ? { fallbacks: "default" } : {}) }),
    signal: AbortSignal.timeout(180000),
  });
  const body = await res.json().catch(() => null);
  const p = PRICE[body?.model ?? model] ?? PRICE[model];
  const u = body?.usage ?? {};
  const costUsd = ((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6;
  if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 200)}`), { costUsd, fatal: res.status === 400 && /credit balance/i.test(JSON.stringify(body?.error ?? "")) || res.status === 401 });
  if (body?.stop_reason !== "end_turn" && body?.stop_reason !== "stop_sequence") throw Object.assign(new Error(`stop ${body?.stop_reason}`), { costUsd });
  const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
  return { data: JSON.parse(text), costUsd, usage: u, ms: 0 };
}
const worstOf = (model, maxTokens, inTok = 9000) => { const p = PRICE[model]; return (maxTokens * p.output + inTok * p.cacheWrite) / 1e6; };

export async function runReal({ mode, n, seed, apiKey, cardModel, scriptModel, directorModel, maxUsd, concurrency = 4, outRoot = OUT, log = console.log }) {
  const { ideas, script } = await sharedPrompts();
  const dir = path.join(outRoot, `real-${mode}-${directorModel.includes("haiku") ? "haiku" : "sonnet"}${n !== 200 ? `-${n}` : ""}`);
  fs.mkdirSync(dir, { recursive: true });
  const gapsFile = path.join(dir, "gaps.jsonl");
  fs.rmSync(gapsFile, { force: true });
  const gapLog = makeGapLog({ store: jsonlStore(gapsFile) });
  const topics = makeTopics(n, seed);
  let spent = 0, reserved = 0, stopped = null;
  const reserve = (w) => { if (spent + reserved + w > maxUsd) return false; reserved += w; return true; };
  const settle = (w, c) => { reserved -= w; spent += c; };
  const paid = async (worst, fn) => {
    if (stopped) throw new Error(stopped);
    if (!reserve(worst)) { stopped = `money cap $${maxUsd} reached (spent $${spent.toFixed(4)})`; throw new Error(stopped); }
    try { const r = await fn(); settle(worst, r.costUsd); return r; } catch (e) { settle(worst, e.costUsd ?? 0); if (e.fatal) stopped = e.message; throw e; }
  };
  const director = { model: directorModel, direct: (args) => paid(worstOf(directorModel, 12000), () => anthropicDirector({ apiKey, model: directorModel }).direct(args)) };
  const results = [], cards = {}, scripts = {}, productions = {}, skips = [];
  let next = 0;
  async function worker() {
    while (next < topics.length && !stopped) {
      const t = topics[next++];
      try {
        const { slots, text } = ideas.topicPrompt({ topic: t.topic, mood: t.mood, seed: Number(t.id.slice(1)) });
        const c = await paid(worstOf(cardModel, 8000), () => callJson({ apiKey, model: cardModel, system: ideas.IDEAS_SYSTEM, user: text, schema: ideas.ideasSchema(), effort: "low", maxTokens: 8000 }));
        const usable = ideas.usableIdeas(c.data, slots);
        const idea = usable[0] ?? ideas.normalizeIdea(c.data?.ideas?.[0] ?? {});
        cards[t.id] = idea;
        let sc = null;
        if (mode === "script") {
          const s = await paid(worstOf(scriptModel, 12000), () => callJson({ apiKey, model: scriptModel, system: script.SCRIPT_SYSTEM, user: script.scriptPrompt({ idea, lengthSec: 90 }), schema: script.scriptSchema(), effort: "medium", maxTokens: 12000 }));
          sc = script.normalizeScript(s.data);
          scripts[t.id] = sc;
        }
        const r = await directStory({ script: sc, idea, provider: director, gapLog, storyId: t.id, source: "stress", exists });
        productions[t.id] = { production: r.production, problems: r.problems, fellBack: r.fellBack, error: r.error };
        results.push({ id: t.id, topic: t.topic, ms: r.ms, costUsd: r.costUsd, lines: r.production.lines.length, summary: r.match.summary, worlds: r.production.worlds.map((w) => `${w.kind}${w.creature.relation !== "none" ? `:${w.creature.relation}` : ""}`), capabilities: [...new Set(r.match.calls.map((x) => x.capability))], problems: r.problems.length, fellBack: r.fellBack });
        log(`${t.id} ${r.fellBack ? "FELL BACK" : "ok"} gaps ${r.match.summary.gaps}  spent $${spent.toFixed(4)}  ${t.topic}`);
      } catch (e) { skips.push({ id: t.id, topic: t.topic, error: String(e.message).slice(0, 300) }); log(`${t.id} skipped: ${e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  for (const [f, v] of [["cards.json", cards], ["scripts.json", scripts], ["productions.json", productions]]) fs.writeFileSync(path.join(dir, f), JSON.stringify(v, null, 1));
  fs.writeFileSync(path.join(dir, "spend.json"), JSON.stringify({ spent: Number(spent.toFixed(5)), maxUsd, stopped, done: results.length, of: topics.length, skipped: skips.length, skipReasons: Object.entries(skips.reduce((m, s) => { const k = s.error.replace(/\d+/g, "N").slice(0, 120); m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]), skips }, null, 1));
  const agg = await aggregate({ results, gapLog, outDir: dir, quiet: log !== console.log, title: `REAL stress run (${mode}; card ${cardModel}, script ${mode === "script" ? scriptModel : "-"}, director ${directorModel}): ${results.length}/${topics.length} topics, $${spent.toFixed(4)}` });
  log(`\nspent $${spent.toFixed(4)} of the $${maxUsd} cap${stopped ? ` (stopped: ${stopped})` : ""}`);
  return { ...agg, spent, stopped, dir };
}

// ------------------------------------------------------------------------------------------------ CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const opt = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
  const seed = Number(opt("seed", 11));
  if (a.includes("--costs")) {
    const n = Number(opt("n", 200));
    const c = await costTable({ n, seed });
    console.log("measured tokens per call (input incl. the cached system prompt / output incl. a thinking allowance):");
    for (const [k, t] of Object.entries(c.tokens)) console.log(`  ${k.padEnd(18)} system ${t.system}, user ${t.user}, output ${t.output} (effort ${t.effort})`);
    console.log("\noptions (expected: system prompts cached after the first call; worst: no cache hits):");
    for (const o of c.options) {
      console.log(`  ${o.name}: ${o.calls} calls, ~$${o.usd} (worst $${o.worst})`);
      for (const p of o.per) console.log(`      ${p.step.padEnd(18)} ${p.model.padEnd(18)} in ${p.inTok} out ${p.outTok}  $${p.perCall}/call  -> $${p.total}`);
    }
  } else if (opt("real", null)) {
    const mode = opt("real"), apiKey = process.env.ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY;
    const m = (k, d) => MODEL_IDS[opt(k, d)] ?? MODEL_IDS[d];
    const base = opt("model", "haiku");
    const n = Number(opt("n", 200)), maxUsd = Number(opt("max-usd", 0));
    const cardModel = m("card-model", "haiku"), scriptModel = m("script-model", base), directorModel = m("director-model", base);
    if (!["cards", "script"].includes(mode)) { console.error("--real cards | script"); process.exit(2); }
    const est = optionCost(await measure({ n, seed }), { n, mode, cardModel, scriptModel, directorModel });
    console.log(`REAL ${mode}: ${n} topics, card ${cardModel}, script ${mode === "script" ? scriptModel : "-"}, director ${directorModel}: ${est.calls} calls, estimate ~$${est.usd} (worst $${est.worst}), cap $${maxUsd}`);
    if (!a.includes("--yes") || !apiKey || !(maxUsd > 0)) { console.error("Not run: needs --yes, --max-usd > 0 and ANTHROPIC_KEY (the owner's go first)."); process.exit(2); }
    await runReal({ mode, n, seed, apiKey, cardModel, scriptModel, directorModel, maxUsd, concurrency: Number(opt("concurrency", 4)) });
  } else {
    await runFree({ n: Number(opt("n", 200)), seed });
  }
}
