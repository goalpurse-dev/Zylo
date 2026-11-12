// Blocky Worlds builder demo: build + check three things the kit doesn't have, then render them in the engine.
//   node dev/builderDemo.mjs                      FREE: the mock designer + mock vision (lib/builder/mock.js)
//   node dev/builderDemo.mjs --real --yes-paid    PAID: Claude designs + checks (ANTHROPIC_KEY), capped by --max-usd
//        [--design-model claude-sonnet-5-5] [--vision-model claude-sonnet-5-5] [--compare-vision claude-haiku-5-5]
//        [--max-usd 1.00] [--out out/dev/builder/demo]
// Needs: "inside a giant turtle" (world), "a robot dentist" (object), "a ladder" (object; the kit has one since the
// coverage round, so it is designed anyway here to show the path: --kit-first resolves it from the kit instead).
// Writes: <out>/stills/*.jpg (each check still, every attempt), <out>/library/ (the file library), <out>/report.json,
// <out>/engine-*.jpg (frames of a planned timeline with the built world + objects in it, rendered by the real engine).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNeeds } from "../lib/builder/resolve.js";
import { fileCache } from "../lib/builder/cache.js";
import { mockProvider } from "../lib/builder/mock.js";
import { makeStillRenderer } from "../lib/builder/still.mjs";
import { worstCaseUsd, anthropicProvider } from "../lib/builder/design.js";
import { applyResolved, needsFromTimeline } from "../lib/builder/apply.js";
import { planVideo, checkTimeline, checkSubjects, checkVisuals } from "../plan.mjs";
import { renderStills } from "../render.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const REAL = has("real"), OUT = path.resolve(ENGINE, arg("out", `out/dev/builder/${REAL ? "real" : "demo"}`));
const designModel = arg("design-model", "claude-sonnet-5-5"), visionModel = arg("vision-model", "claude-sonnet-5-5"), compare = arg("compare-vision", null);
const MAX_USD = Number(arg("max-usd", 1.0));

export const NEEDS = [
  { id: "turtle", kind: "world", name: "inside a giant turtle", phrase: "inside a giant turtle", line: 0, lineText: "In this world, we all live inside a giant turtle.", mood: "funny" },
  { id: "dentist", kind: "object", name: "robot dentist", phrase: "a robot dentist", line: 2, lineText: "A robot dentist checks everyone's teeth at noon.", mood: "funny" },
  { id: "ladder", kind: "object", name: "ladder", phrase: "a ladder", line: 3, lineText: "I climb the old ladder to the shell's top.", mood: "funny" },
];
const IDEA = { title: "The Shell", opener: NEEDS[0].lineText, premise: "A whole town lives inside a giant walking turtle.", setting: "inside something giant (an animal, a store, a tower)", mood: "funny" };

/** the most the real demo can cost: every need uses all 3 attempts at every call's ceiling (+ the compare vision) */
export function worstCaseDemo({ design = designModel, vision = visionModel, comparison = compare } = {}) {
  let usd = 0;
  for (const n of NEEDS) usd += 3 * (worstCaseUsd(design, "design", n.kind) + worstCaseUsd(vision, "vision", n.kind) + (comparison ? worstCaseUsd(comparison, "vision", n.kind) : 0));
  return Number(usd.toFixed(4));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let provider;
  if (REAL) {
    const worst = worstCaseDemo();
    console.log(`REAL demo: design ${designModel}, vision ${visionModel}${compare ? `, compare ${compare}` : ""}; worst case $${worst} (hard cap --max-usd ${MAX_USD})`);
    if (!has("yes-paid")) { console.log("refusing: add --yes-paid (the owner's go) to make paid calls"); process.exit(2); }
    if (!process.env.ANTHROPIC_KEY) { console.log("no ANTHROPIC_KEY in the environment"); process.exit(2); }
    provider = anthropicProvider({ apiKey: process.env.ANTHROPIC_KEY, designModel, visionModel, idea: IDEA });
    if (compare) { // the second opinion on the same still (logged only; the pass/fail uses visionModel)
      const second = anthropicProvider({ apiKey: process.env.ANTHROPIC_KEY, designModel, visionModel: compare, idea: IDEA });
      const v0 = provider.vision, w0 = provider.worstCase;
      provider.vision = async (a) => { const [x, y] = await Promise.all([v0(a), second.vision(a).catch((e) => ({ data: { error: e.message }, costUsd: e.costUsd ?? 0 }))]); x.data.compare = { model: compare, ...y.data }; x.costUsd += y.costUsd ?? 0; return x; };
      provider.worstCase = (k, s) => w0(k, s) + (s === "vision" ? second.worstCase(k, s) : 0);
    }
  } else provider = mockProvider();
  const stills = await makeStillRenderer({ outDir: path.join(OUT, "stills") });
  const cache = fileCache(path.join(OUT, "library"));
  const kit = has("kit-first") ? { has: (n) => (n.name === "ladder" ? "ladder" : null) } : { has: () => null };
  const t0 = Date.now();
  try {
    const { results, report } = await resolveNeeds(NEEDS, { provider, cache, render: (k, s, o) => stills.render(k, s, o), kit, budget: { maxUsd: MAX_USD, maxMs: 300000 }, log: (m) => console.log(m) });
    console.log(`resolved in ${((Date.now() - t0) / 1000).toFixed(1)} s, $${report.costUsd}: ${report.built} built, ${report.cards} cards, ${report.kit} kit`);
    // the engine side: a planned timeline with the built things in it, rendered by the real engine page
    const script = { title: "The Shell", lines: [
      { part: "rule", text: NEEDS[0].lineText }, { part: "tour", text: "Every morning the whole town wakes up to the heartbeat." },
      { part: "tour", text: "A robot dentist checks everyone's teeth at noon." }, { part: "me", text: "I climb the old ladder to the top of the shell." },
      { part: "closer", text: "And the turtle never stops walking." }] };
    const tl = planVideo({ script, idea: IDEA });
    // the planner's own needs + ours (the dentist / ladder lines get their built things as objects in their shots)
    const needs = needsFromTimeline(tl, {});
    const res2 = {};
    for (const n of needs) { const m = NEEDS.find((x) => x.kind === n.kind && (x.name === n.name || (n.kind === "world" && /turtle/.test(n.name)))); if (m) res2[n.id] = results[m.id]; }
    const appliedPlan = applyResolved(tl, needs, res2, { check: (t) => [...checkTimeline(t), ...checkSubjects(t).map((x) => x.problem)] });
    for (const [i, n] of [[2, NEEDS[1]], [3, NEEDS[2]]]) { // put the built objects into their lines' first shot
      const r = results[n.id]; if (r.source !== "built" && r.source !== "cache") continue;
      const s = tl.shots.find((x) => x.line === i && x.camera !== "insert"); if (!s) continue;
      tl.assets ??= {}; tl.assets[r.asset.id] = { kind: "object", name: n.name, aliases: r.asset.aliases, blueprint: r.asset.blueprint };
      const taken = new Set((s.actors ?? []).map((x) => x.spot)), spot = ["right", "left", "back", "center"].find((x) => !taken.has(x)) ?? "far";
      // the built one stands alone in its shot (it replaces the kit stand-ins the planner chose: its ladder, its robot)
      s.objects = [{ name: n.name, asset: r.asset.id, aliases: r.asset.aliases, spot, facing: "camera" }];
    }
    const problems = [...checkTimeline(tl), ...checkSubjects(tl).map((x) => x.problem), ...checkVisuals(tl, script).map((x) => `line ${x.line}: ${x.missing}`)];
    console.log(`timeline: ${tl.shots.length} shots, sets ${[...new Set(tl.shots.map((s) => s.set))].join(", ")}; checks: ${problems.length ? problems.join("; ") : "clean"}; applied ${JSON.stringify(appliedPlan.applied)}`);
    const tlPath = path.join(OUT, "timeline.json");
    fs.writeFileSync(tlPath, JSON.stringify({ ...tl, audio: { voice: "voice.wav", music: "music.wav" } }));
    const times = [0, ...[2, 3].map((i) => { const s = tl.shots.find((x) => x.line === i && x.objects?.some((o) => o.asset)); return s ? +(s.start + 0.3).toFixed(2) : null; }).filter((x) => x != null)];
    const frames = await renderStills({ timelinePath: tlPath, times, outPrefix: path.join(OUT, "engine") });
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ real: REAL, designModel: REAL ? designModel : "mock", visionModel: REAL ? visionModel : "mock", report, results: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { source: r.source, attempts: r.attempts, costUsd: r.costUsd, ms: r.ms, reason: r.reason ?? null, verdicts: r.verdicts }])), frames, checks: problems }, null, 1));
    console.log(`stills: ${path.join(OUT, "stills")}\nengine frames: ${frames.join(", ")}\nreport: ${path.join(OUT, "report.json")}`);
  } finally { await stills.close(); }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) await main();
