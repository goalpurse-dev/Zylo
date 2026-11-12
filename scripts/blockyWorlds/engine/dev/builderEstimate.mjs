// Blocky Worlds builder: the cost + wait estimate per new object / world, from OUR prompts and a sample design, with
// llm.js's PRICE table. Makes no calls (free). Token counts are estimated from characters (prose ~3.6 chars a token,
// JSON ~2.9); image tokens = w x h / 750. Speeds are assumptions until the first paid demo measures them.
//   node dev/builderEstimate.mjs [--json]
import { OBJECT_SYSTEM, WORLD_SYSTEM, objectPrompt, worldPrompt, PRICE, MAX_TOKENS, blueprintSchema, worldSchema } from "../lib/builder/design.js";
import { VISION_SYSTEM, visionText, imageTokens } from "../lib/builder/vision.js";
import { MOCK_OBJECTS, MOCK_WORLDS } from "../lib/builder/mock.js";
import { validateBlueprint, validateWorld } from "../lib/builder/spec.js";

const prose = (s) => Math.ceil(s.length / 3.6), json = (o) => Math.ceil(JSON.stringify(o).length / 2.9);
// the reply in the schema's full form (every part carries every field, as structured outputs require)
const full = (bp) => ({ ...bp, parts: bp.parts.map((p) => ({ shape: "box", rot: [0, 0, 0], material: "matte", pattern: "none", parent: "", pivot: [], ...p })), labels: (bp.labels ?? []).map((l) => ({ bg: "", face: "front", ...l })), anims: bp.anims ?? [], focus: bp.focus ?? [0, 1, 0] });
const sampleObject = full(validateBlueprint(MOCK_OBJECTS["robot dentist"]).blueprint);
const w = validateWorld(MOCK_WORLDS["inside a giant turtle"]).spec;
const sampleWorld = { ...w, landmark: full(w.landmark), props: w.props.map((p) => ({ kit: "", spot: p.spot, count: p.count, blueprint: full(p.blueprint) })) };
const need = { name: "robot dentist", phrase: "a robot dentist", lineText: "A robot dentist checks everyone's teeth at noon.", mood: "funny" };
const idea = { title: "The Shell", opener: "In this world, we all live inside a giant turtle.", premise: "A whole town lives inside a giant walking turtle.", setting: "inside something giant" };

const T = {
  object: { sys: prose(OBJECT_SYSTEM) + json(blueprintSchema()), user: prose(objectPrompt({ need, idea })), out: json(sampleObject), think: 700, img: imageTokens(768, 768) },
  world: { sys: prose(WORLD_SYSTEM) + json(worldSchema()), user: prose(worldPrompt({ need: { ...need, name: "inside a giant turtle" }, idea })), out: json(sampleWorld), think: 900, img: imageTokens(432, 768) },
};
const vis = { sys: prose(VISION_SYSTEM) + 60, user: prose(visionText({ need, kind: "object" })), out: 90, think: 250 };
// speeds (assumed): time to first token, output tokens a second
const SPEED = { "claude-sonnet-5-5": { ttft: 1.5, tps: 70 }, "claude-haiku-5-5": { ttft: 0.6, tps: 180 } };
const STILL_S = { gpu: [1.5, 3], laptop: [1.4, 5] };

const usd = (model, inp, out, cachedSys = 0) => { const p = PRICE[model]; return ((inp - cachedSys) * p.input + cachedSys * p.cacheRead + out * p.output) / 1e6; };
function per(kind, designModel, visionModel) {
  const t = T[kind];
  const dIn = t.sys + t.user, dOut = t.out + t.think;
  const vIn = vis.sys + vis.user + t.img, vOut = vis.out + vis.think;
  const design = { cold: usd(designModel, dIn, dOut), warm: usd(designModel, dIn, dOut, t.sys) }; // warm: the system prompt read from the cache
  const vision = usd(visionModel, vIn, vOut); // its prompt is below the cache minimum: never cached
  const sp = SPEED[designModel], vp = SPEED[visionModel];
  const dS = sp.ttft + dOut / sp.tps, vS = vp.ttft + vOut / vp.tps;
  const worstDesign = (PRICE[designModel].output * MAX_TOKENS[kind] + PRICE[designModel].cacheWrite * (dIn + 1500)) / 1e6; // a retry carries the fix text
  const worstVision = (PRICE[visionModel].output * MAX_TOKENS.vision + PRICE[visionModel].input * vIn) / 1e6;
  return {
    kind, designModel, visionModel,
    tokens: { designIn: dIn, designOut: dOut, systemCached: t.sys, visionIn: vIn, visionOut: vOut, imageTokens: t.img },
    typicalUsd: +(design.warm + vision).toFixed(4), coldUsd: +(design.cold + vision).toFixed(4),
    oneRetryUsd: +(2 * (design.warm + vision)).toFixed(4),
    worstUsd: +(3 * (worstDesign + worstVision)).toFixed(4),
    waitS: { typical: +(dS + STILL_S.gpu[1] + vS).toFixed(1), oneRetry: +(2 * (dS + STILL_S.gpu[1] + vS)).toFixed(1), worst: +(3 * (sp.ttft + MAX_TOKENS[kind] / sp.tps + STILL_S.gpu[1] + vp.ttft + MAX_TOKENS.vision / vp.tps)).toFixed(1) },
  };
}

const combos = [["claude-sonnet-5-5", "claude-sonnet-5-5"], ["claude-sonnet-5-5", "claude-haiku-5-5"], ["claude-haiku-5-5", "claude-haiku-5-5"]];
const rows = combos.flatMap(([d, v]) => ["object", "world"].map((k) => per(k, d, v)));
if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 1));
else {
  console.log(`tokens (est.): object design in ${T.object.sys + T.object.user} (system ${T.object.sys} cacheable) / out ${T.object.out} + thinking ~${T.object.think}; world design in ${T.world.sys + T.world.user} / out ${T.world.out} + ~${T.world.think}; vision in ${vis.sys + vis.user} + image ${T.object.img} (768x768) or ${T.world.img} (432x768) / out ~${vis.out + vis.think}`);
  console.log("\n| need | design / vision | typical $ (1 try) | 1 retry $ | worst $ (3 tries at the ceilings) | wait typical / 1 retry / worst (s) |\n|---|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.kind} | ${r.designModel.replace("claude-", "")} / ${r.visionModel.replace("claude-", "")} | ${r.typicalUsd} (cold ${r.coldUsd}) | ${r.oneRetryUsd} | ${r.worstUsd} | ${r.waitS.typical} / ${r.waitS.oneRetry} / ${r.waitS.worst} |`);
  console.log(`\nassumed speeds: ${JSON.stringify(SPEED)}; still ${STILL_S.gpu.join("-")} s on the GPU (${STILL_S.laptop.join("-")} s measured on this laptop)`);
}
