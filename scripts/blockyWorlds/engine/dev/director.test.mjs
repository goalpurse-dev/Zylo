// node --test dev/director.test.mjs   (the story director: registry, production list, matcher, gap log, mock director,
// stress aggregation, the paid path with a fake fetch; no network, no cost)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CAPABILITIES, CAPABILITY_IDS, STATUS, supports, installedStatus, registryTable, registryForPrompt } from "../lib/capabilities.js";
import { POSES_N } from "../lib/director/vocab.js";
import { productionSchema, validateProduction, itemsOf } from "../lib/director/spec.js";
import { matchProduction, nodeKit } from "../lib/director/match.js";
import { mockProduction, linesOf } from "../lib/director/mock.js";
import { directStory } from "../lib/director/index.js";
import { DIRECTOR_SYSTEM, DIRECTOR_SYSTEM_JSON, DIRECTOR_LIMITS, directorTokens, callUsd, anthropicDirector } from "../lib/director/design.js";
import { checkProduction } from "../lib/director/check.js";
import { makeGapLog, memoryStore, jsonlStore, supabaseStore, rankGaps, gapRows } from "../lib/gaps.js";
import { runDemo, TURTLE_SCRIPT, TURTLE_IDEA, exists } from "./directorDemo.mjs";
import { makeTopics, standInCard, runFree, costTable, runReal, MODEL_IDS } from "./stress.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bw-director-"));
const prodOf = (raw, n) => validateProduction(raw, { lineCount: n }).production;

// ------------------------------------------------------------------ registry
test("registry: every capability is complete and honest", () => {
  assert.ok(CAPABILITY_IDS.length >= 25);
  for (const id of CAPABILITY_IDS) {
    const c = CAPABILITIES[id];
    assert.equal(c.id, id);
    assert.ok(STATUS.includes(c.status), `${id} status`);
    for (const k of ["group", "does", "module", "owner", "fallback"]) assert.ok(String(c[k] ?? "").length > 2, `${id}.${k}`);
    assert.ok(c.params && typeof c.params === "object", `${id}.params`);
  }
  for (const id of ["fx.fire", "fx.explosion", "fx.transformation", "flying", "event.sky"]) assert.equal(CAPABILITIES[id].status, "planned", id);
  for (const id of ["character", "object", "prop.held", "creature.monster", "sign.card", "camera.basic"]) assert.equal(CAPABILITIES[id].status, "ready", id);
  assert.match(registryForPrompt(), /- crowd: /);
  assert.equal(registryTable().length, CAPABILITY_IDS.length);
});

test("registry: supports() is per parameter", () => {
  assert.deepEqual(supports("crowd", { kind: "townsfolk", action: ["march", "cheer"], count: 400 }), { ok: true, status: "partial", unsupported: [], known: true });
  const frogs = supports("crowd", { kind: "frog", action: "swarm" });
  assert.deepEqual(frogs.unsupported, ["kind=frog", "action=swarm"]);
  assert.equal(frogs.ok, false);
  assert.equal(supports("fx.fire", {}).status, "planned");
  assert.equal(supports("giant", { species: "moose", behaviour: ["walk"] }).ok, true); // any species: the generic giant
  assert.deepEqual(supports("giant", { behaviour: "sleep" }).unsupported, []); // GAPS 2026-11-05: giants sleep now
  assert.deepEqual(supports("giant", { behaviour: "teleport" }).unsupported, ["behaviour=teleport"]);
  assert.deepEqual(supports("character.action", { action: ["hug", "climb", "push", "ride"] }).unsupported, []);
  assert.equal(supports("nope").known, false);
});

test("registry: installedStatus follows the files on disk; poses match the people kit", () => {
  assert.equal(installedStatus("fx.fire", () => true), "planned"); // no files listed: stays planned
  assert.equal(installedStatus("crowd", () => false), "partial");
  const people = fs.readFileSync(path.join(ROOT, "page/kit/people.js"), "utf8");
  const poses = JSON.parse(people.match(/export const POSES = (\[[^\]]*\])/)[1]);
  assert.deepEqual([...POSES_N], poses);
});

// ------------------------------------------------------------------ the production list
test("schema: structured-outputs safe (every object closed + all required, no maxItems)", () => {
  const walk = (s, at = "$") => {
    assert.ok(!("maxItems" in s), `${at} maxItems`);
    if (s.type === "object") { assert.equal(s.additionalProperties, false, at); assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), at); for (const [k, v] of Object.entries(s.properties)) walk(v, `${at}.${k}`); }
    if (s.type === "array") walk(s.items, `${at}[]`);
  };
  walk(productionSchema());
});

test("validateProduction: never throws, fills every line, drops unknown ids, adds the narrator", () => {
  for (const junk of [null, 7, "x", [], { lines: "no" }]) { const v = validateProduction(junk, { lineCount: 3 }); assert.equal(v.production.lines.length, 3); assert.ok(v.problems.length); }
  const v = validateProduction({ worlds: [{ id: "w", kind: "volcano?" }], cast: [{ id: "Mr Plunk", role: "adult" }], props: [{ id: "tape", name: "tape", size: "hand", heldBy: "nobody" }],
    lines: [{ line: 0, world: "w", subject: "mr_plunk", who: ["mr_plunk", "ghost"], needs: ["tape", "dragon"], camera: "zoom" }, { line: 9 }] }, { lineCount: 2 });
  const p = v.production;
  assert.equal(p.worlds[0].kind, "outdoor");
  assert.ok(p.cast.some((c) => c.role === "narrator"));
  assert.deepEqual(p.lines[0].who, ["mr_plunk"]);
  assert.deepEqual(p.lines[0].needs, ["tape"]);
  assert.equal(p.lines[0].camera, "normal");
  assert.equal(p.props[0].heldBy, "");
  assert.ok(v.problems.some((x) => /dragon/.test(x)) && v.problems.some((x) => /line 9/.test(x)) && v.problems.some((x) => /line 1 has no entry/.test(x)));
});

// ------------------------------------------------------------------ the matcher
test("matcher: kit / set / builder / card routes, builder needs in resolveNeeds' shape, gaps with the line", () => {
  const raw = {
    worlds: [{ id: "town", name: "the town", kind: "outdoor", base: "street" }, { id: "dentist_office", name: "dentist office", kind: "indoor", base: "school" }],
    cast: [{ id: "me", role: "narrator", kind: "human" }, { id: "robo", name: "Dr. Bolt", kind: "robot", look: "chrome", job: "dentist" }],
    props: [{ id: "ladder", name: "ladder", size: "object" }, { id: "kazoo", name: "golden kazoo", size: "hand", heldBy: "me" }],
    effects: [{ id: "fire", kind: "fire", target: "bakery" }],
    lines: [{ line: 0, world: "town", subject: "me", who: ["me"], needs: ["ladder"] }, { line: 1, world: "dentist_office", subject: "robo", who: ["me"], needs: ["robo", "kazoo", "fire"], camera: "shake" }],
  };
  const script = { lines: [{ text: "In this town, I climb a ladder." }, { text: "The robot dentist set my kazoo on fire." }] };
  const m = matchProduction(prodOf(raw, 2), { script, mood: "funny" });
  const call = (id) => m.calls.find((c) => c.item === id);
  assert.equal(call("town").route, "set");
  assert.equal(call("ladder").route, "kit"); assert.equal(call("ladder").kitName, "ladder");
  assert.equal(call("dentist_office").route, "builder");
  assert.equal(call("robo").route, "builder");
  assert.equal(call("kazoo").route, "builder");
  assert.equal(call("fire").route, "card"); assert.equal(call("fire").card.icon, "🔥");
  for (const n of m.builderNeeds) for (const k of ["id", "kind", "name", "phrase", "line", "lineText", "mood", "fallbackSet"]) assert.ok(k in n, `need.${k}`);
  assert.ok(m.builderNeeds.some((n) => n.kind === "world" && n.name === "dentist office" && n.fallbackSet === "school"));
  const fireGap = m.gaps.find((g) => g.capability === "fx.fire");
  assert.equal(fireGap.line, 1); assert.match(fireGap.lineText, /on fire/);
  assert.equal(m.perLine.length, 2);
  assert.ok(m.perLine[1].required.some((r) => r.id === "fire" && r.route === "card"));
});

test("matcher: never throws on an empty or odd production list", () => {
  const p = prodOf({ creatures: [{ id: "x", species: "", scale: "colossal", behaviours: ["fly"] }], crowds: [{ id: "c", member: "vehicle", count: 9999 }], events: [{ id: "e", kind: "falling", what: "" }] }, 1);
  const m = matchProduction(p, {});
  assert.ok(m.calls.length >= 4);
  assert.equal(m.perLine.length, 1);
});

test("matcher: EPIC routes follow the files on disk (exists), the builder otherwise", () => {
  const raw = { worlds: [{ id: "on", name: "on a giant whale", kind: "creature", base: "street", creature: { species: "whale", relation: "on", heightM: 150 } }], creatures: [{ id: "whale", species: "whale", scale: "colossal", heightM: 150, behaviours: ["swim"] }], lines: [{ line: 0, world: "on", subject: "whale", needs: ["whale"] }] };
  const off = matchProduction(prodOf(raw, 1), { exists: () => false });
  assert.equal(off.calls.find((c) => c.item === "on").route, "builder");
  assert.equal(off.calls.find((c) => c.item === "whale").route, "builder");
  assert.ok(off.builderNeeds.find((n) => n.kind === "object" && n.giant && n.heightM === 150));
  const on = matchProduction(prodOf(raw, 1), { exists: () => true });
  assert.equal(on.calls.find((c) => c.item === "on").route, "epic");
  assert.deepEqual(on.calls.find((c) => c.item === "whale").epic, { kind: "whale", size: 150, actions: ["swim"] });
  assert.equal(on.builderNeeds.length, 0);
});

// ------------------------------------------------------------------ the mock director + the turtle-vs-wolf example
test("turtle vs wolf army: world.creature + giant + crowd + camera.shake / action, no special code", async () => {
  const r = await runDemo();
  const caps = new Set(r.match.calls.map((c) => c.capability));
  for (const c of ["world.creature", "giant", "crowd", "character", "prop.held"]) assert.ok(caps.has(c), c);
  const beats = new Set(r.match.perLine.flatMap((l) => l.extras.map((e) => e.capability)));
  for (const c of ["camera.shake", "camera.action", "camera.scale"]) assert.ok(beats.has(c), c);
  const p = r.production;
  assert.equal(p.worlds[0].kind, "creature"); assert.equal(p.worlds[0].creature.species, "turtle"); assert.equal(p.worlds[0].creature.relation, "on");
  assert.ok(p.worlds.some((w) => w.creature.relation === "outside"));
  const turtle = p.creatures.find((c) => c.species === "turtle");
  assert.equal(turtle.scale, "colossal"); assert.ok(turtle.behaviours.includes("stomp"));
  const wolves = p.crowds.find((c) => c.of === "wolf");
  assert.ok(wolves && wolves.actions.includes("march") && wolves.actions.includes("charge"));
  assert.equal(r.match.calls.find((c) => c.item === wolves.id).crowdKind, "wolf_soldier");
  assert.equal(r.production.lines.length, TURTLE_SCRIPT.lines.length);
  assert.ok(r.match.summary.shownShare >= 0.9);
});

test("mock director: other wild worlds map by the same rules", () => {
  const kind = (opener, setting = "") => prodOf(mockProduction({ idea: { opener, setting, title: "x" } }), linesOf({ idea: { opener, setting } }).length).worlds[0];
  assert.equal(kind("In this world, our school is on the moon.").kind, "space");
  assert.equal(kind("In this town, everyone lives under the sea.").kind, "underwater");
  assert.equal(kind("In this world, we all live inside a giant refrigerator.").kind, "enclosed");
  const whale = kind("In this world, our city sits on the back of a giant whale.");
  assert.equal(whale.kind, "creature"); assert.equal(whale.creature.species, "whale");
  assert.equal(kind("In this town, the baker sells bread.", "school").base, "school");
  // a robot dentist is one cast member (a robot with a job), not a robot creature + a dentist
  const p = prodOf(mockProduction({ script: { lines: [{ part: "rule", text: "In this town, the robot dentist pulls teeth at noon." }] }, idea: { title: "x" } }), 1);
  assert.ok(p.cast.some((c) => c.kind === "robot" && c.job === "dentist"));
});

// ------------------------------------------------------------------ directStory + the gap log
test("directStory: an AI answer is used; a failing AI falls back to the mock; one retry with the problems", async () => {
  const lines = TURTLE_SCRIPT.lines;
  const good = mockProduction({ script: TURTLE_SCRIPT, idea: TURTLE_IDEA });
  const seen = [];
  const ai = { model: "fake", direct: async ({ feedback }) => { seen.push(feedback); return { data: seen.length === 1 ? { lines: [] } : good, costUsd: 0.001, model: "fake" }; } };
  const r = await directStory({ script: TURTLE_SCRIPT, idea: TURTLE_IDEA, provider: ai, exists });
  assert.equal(r.provider, "anthropic"); assert.equal(seen.length, 2); assert.ok(seen[1].length > 0); assert.equal(r.costUsd, 0.002);
  assert.equal(r.production.lines.length, lines.length);
  const bad = { direct: async () => { throw Object.assign(new Error("boom"), { costUsd: 0.0005 }); } };
  const f = await directStory({ script: TURTLE_SCRIPT, idea: TURTLE_IDEA, provider: bad, exists });
  assert.equal(f.fellBack, true); assert.equal(f.provider, "mock"); assert.equal(f.costUsd, 0.001); assert.ok(f.match.calls.length);
  const broke = { record: async () => { throw new Error("db down"); } };
  const g = await directStory({ script: TURTLE_SCRIPT, idea: TURTLE_IDEA, provider: "mock", gapLog: broke, exists });
  assert.ok(g.production); // bookkeeping never fails a run
});

test("gap log: rows, ranking by distinct stories, JSONL round trip, the Supabase adapter's requests", async () => {
  const log = makeGapLog({ store: memoryStore() });
  const gap = (capability, detail, line) => ({ capability, detail, item: "x", itemKind: "effect", name: capability, line, lineText: `line about ${capability}` });
  await log.record([gap("fx.fire", "planned", 1), gap("fx.fire", "planned", 2)], { storyId: "a" });
  await log.record([gap("crowd", "kind=frog", 0)], { storyId: "a" });
  await log.record([gap("crowd", "kind=frog", 3)], { storyId: "b" });
  const ranked = await log.rank();
  assert.deepEqual(ranked.map((g) => [g.capability, g.stories, g.requests]), [["crowd", 2, 2], ["fx.fire", 1, 2]]);
  assert.ok(ranked[0].examples.length >= 1 && ranked[0].lastAt);
  const rows = gapRows([gap("a", "b", 1)], { runId: "r", storyId: "s", source: "mock", at: "2026-11-05T00:00:00Z" });
  assert.deepEqual(Object.keys(rows[0]).sort(), ["capability", "created_at", "detail", "item", "item_kind", "line", "line_text", "name", "run_id", "source", "story_id", "title"]);
  const file = path.join(tmp(), "g.jsonl");
  const j = makeGapLog({ store: jsonlStore(file) });
  await j.record([gap("flying", "who=vehicle", 0)], { storyId: "t1" });
  await j.record([gap("flying", "who=vehicle", 1)], { storyId: "t2" });
  assert.equal((await j.list()).length, 2);
  assert.equal(rankGaps(await j.list())[0].stories, 2);
  const calls = [];
  const fakeFetch = async (url, init = {}) => { calls.push({ url, init }); return { ok: true, json: async () => [] }; };
  const sb = supabaseStore({ url: "https://x.supabase.co", serviceKey: "k", fetchFn: fakeFetch });
  await sb.append(rows); await sb.ranked();
  assert.match(calls[0].url, /\/rest\/v1\/blocky_worlds_capability_gaps$/); assert.equal(calls[0].init.method, "POST");
  assert.ok(!("created_at" in JSON.parse(calls[0].init.body)[0]));
  assert.match(calls[1].url, /blocky_worlds_capability_gap_rank/);
});

test("checkProduction: an item on screen passes, a missing one is reported (advisory)", () => {
  const raw = { cast: [{ id: "me", role: "narrator", kind: "human" }], props: [{ id: "ladder", name: "ladder", size: "object" }], lines: [{ line: 0, world: "", subject: "me", who: ["me"], needs: ["ladder"] }] };
  const m = matchProduction(prodOf(raw, 1), { script: { lines: [{ text: "I climb a ladder." }] } });
  const tl = (objects) => ({ shots: [{ line: 0, set: "street", actors: [{ id: "me" }], objects }] });
  assert.deepEqual(checkProduction(tl([{ name: "ladder" }]), m), []);
  assert.deepEqual(checkProduction(tl([]), m)[0].missing.map((x) => x.id), ["ladder"]);
});

// ------------------------------------------------------------------ the stress harness
test("stress: topics are distinct and deterministic; the free run aggregates and ranks", async () => {
  const a = makeTopics(200, 11), b = makeTopics(200, 11);
  assert.equal(a.length, 200); assert.deepEqual(a, b);
  assert.equal(new Set(a.map((t) => t.topic)).size, 200);
  assert.notDeepEqual(makeTopics(20, 12), makeTopics(20, 11));
  assert.match(standInCard(a[0], 1).opener, /^In this world, /);
  const dir = tmp();
  const r = await runFree({ n: 30, seed: 5, outDir: dir, quiet: true });
  assert.equal(r.stats.stories, 30);
  assert.ok(r.byCap.length > 0 && r.byCap[0].stories >= r.byCap.at(-1).stories);
  for (const f of ["topics.json", "gaps.jsonl", "report.md", "report.json"]) assert.ok(fs.existsSync(path.join(dir, f)), f);
  assert.ok(r.stats.shownShare > 0.8);
});

test("stress: the cost table is measured from the real prompts; Haiku is far cheaper than Sonnet", async () => {
  const c = await costTable({ n: 20, seed: 11 });
  assert.ok(c.tokens.directorOnScript.system > 3000 && c.tokens.directorOnScript.output > 1500);
  const by = Object.fromEntries(c.options.map((o) => [o.name, o]));
  const hb = c.options.find((o) => /\(b\) scripts, Haiku everywhere/.test(o.name)), sb = c.options.find((o) => /\(b\) scripts, Sonnet everywhere/.test(o.name));
  assert.ok(hb.usd > 0 && hb.usd * 10 < sb.usd);
  for (const o of c.options) assert.ok(o.worst >= o.usd, o.name);
  assert.ok(Object.keys(by).length >= 6);
  // the director's own call: a real 90 s video on Haiku costs well under a cent, on Sonnet ~5 cents
  const t = c.tokens.directorOnScript;
  assert.ok(callUsd(MODEL_IDS.haiku, t) < 0.01 && callUsd(MODEL_IDS.sonnet, t) < 0.1);
  assert.ok(directorTokens({ lines: TURTLE_SCRIPT.lines, idea: TURTLE_IDEA }).system > 3000 && DIRECTOR_SYSTEM.includes("PERMANENT RULE"));
});

test("stress: the paid path runs end to end on a FAKE fetch and stops at the money cap", async () => {
  const real = globalThis.fetch;
  const usage = { input_tokens: 3000, output_tokens: 2000 };
  const idea = { ...TURTLE_IDEA, examples: ["Mr. Oak waters the moss.", "The baker bakes on the shell.", "Coach Bolt jogs around the rim."], price: "Fall off and you swim home.", teaser: "x", formula: "F4", twistType: "T3" };
  const reply = (body) => ({ ok: true, status: 200, json: async () => body });
  let n = 0;
  globalThis.fetch = async (url, init) => {
    n++;
    const b = JSON.parse(init.body);
    const sys = b.system[0].text;
    const data = /STORY DIRECTOR/.test(sys) ? mockProduction({ script: TURTLE_SCRIPT, idea })
      : /narration/.test(sys) && /title/.test(JSON.stringify(b.output_config.format.schema.required)) && b.output_config.format.schema.properties.lines ? { title: "t", lines: TURTLE_SCRIPT.lines, post: { title: "t", description: "d", hashtags: ["#a"] } }
      : { ideas: [idea, idea, idea] };
    return reply({ model: b.model, stop_reason: "end_turn", usage, content: [{ type: "text", text: JSON.stringify(data) }] });
  };
  try {
    const dir = tmp();
    const r = await runReal({ mode: "script", n: 3, seed: 11, apiKey: "fake", cardModel: MODEL_IDS.haiku, scriptModel: MODEL_IDS.haiku, directorModel: MODEL_IDS.haiku, maxUsd: 1, concurrency: 2, outRoot: dir, log: () => {} });
    assert.equal(n, 9); assert.equal(r.stats.stories, 3); assert.ok(r.spent > 0 && r.spent < 0.05); assert.equal(r.stopped, null);
    const capped = await runReal({ mode: "script", n: 3, seed: 11, apiKey: "fake", cardModel: MODEL_IDS.sonnet, scriptModel: MODEL_IDS.sonnet, directorModel: MODEL_IDS.sonnet, maxUsd: 0.15, concurrency: 1, outRoot: dir, log: () => {} });
    assert.match(String(capped.stopped), /money cap/); assert.ok(capped.spent <= 0.15);
  } finally { globalThis.fetch = real; }
});

test("stress CLI: the paid run refuses without --yes / a cap / a key (no network)", () => {
  const env = { ...process.env }; delete env.ANTHROPIC_KEY; delete env.ANTHROPIC_API_KEY;
  const r = spawnSync(process.execPath, [path.join(ROOT, "dev/stress.mjs"), "--real", "script", "--n", "3"], { env, encoding: "utf8" });
  assert.equal(r.status, 2); assert.match(r.stderr, /Not run/);
});

test("anthropicDirector: plain JSON straight away (no free 400 grammar try), roomy first ceiling, the retry without thinking", async () => {
  const bodies = [];
  let n = 0;
  const fetchFn = async (url, init) => {
    const b = JSON.parse(init.body); bodies.push(b); n++;
    // the first answer misses lines (a structural problem -> one retry with feedback), the second is the mock's full list
    const data = n === 1 ? { ...mockProduction({ script: TURTLE_SCRIPT, idea: TURTLE_IDEA }), lines: [] } : mockProduction({ script: TURTLE_SCRIPT, idea: TURTLE_IDEA });
    return { ok: true, status: 200, json: async () => ({ model: "claude-haiku-5-5", stop_reason: "end_turn", usage: null, content: [{ type: "text", text: JSON.stringify(data) }] }) };
  };
  const d = await directStory({ script: TURTLE_SCRIPT, idea: TURTLE_IDEA, provider: anthropicDirector({ apiKey: "fake", model: "claude-haiku-5-5", fetchFn }), exists });
  assert.equal(d.provider, "anthropic"); assert.equal(d.fellBack, false);
  assert.equal(bodies.length, 2, "one first try + one retry, no 400 round trips");
  assert.ok(bodies.every((b) => !b.output_config?.format), "no json_schema format sent");
  assert.equal(bodies[0].system[0].text, DIRECTOR_SYSTEM_JSON); assert.match(DIRECTOR_SYSTEM_JSON, /"lines":\[\{"line":num/);
  assert.equal(bodies[0].max_tokens, DIRECTOR_LIMITS.first); assert.equal(bodies[0].thinking, undefined); assert.equal(bodies[0].output_config.effort, "low");
  assert.equal(bodies[1].max_tokens, DIRECTOR_LIMITS.retry); assert.deepEqual(bodies[1].thinking, { type: "disabled" });
  assert.match(bodies[1].messages[0].content, /FIX THESE PROBLEMS/);
  assert.ok(DIRECTOR_SYSTEM_JSON.startsWith(DIRECTOR_SYSTEM));
});
