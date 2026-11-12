// Blocky Worlds shot library, step 2 (PAID, guarded): describe every analysed reference shot with Claude Haiku vision.
//   node scripts/blockyWorlds/shotlib/describe.mjs                       # DRY RUN (default, free): counts + exact price
//   node scripts/blockyWorlds/shotlib/describe.mjs --paid --yes --max-usd 1.50 [--batch 10] [--frames auto|1|2|3] [--only <videoId>] [--limit-shots N]
// Needs ANTHROPIC_API_KEY (or ANTHROPIC_KEY) for the paid run. Refuses to call the API without ALL of --paid, --yes and --max-usd.
// Reads  reference/blocky-worlds/analysis/<videoId>/{shots.json, frames/}   (analyse.py output)
// Writes reference/blocky-worlds/analysis/<videoId>/descriptions.json      (git-ignored; incremental: described shots are skipped)
// PATTERNS ONLY: the descriptions feed a library of shot PATTERNS (labels like "giant walks through forest"). The prompt
// forbids names; never copy a reference video's story, characters, names, footage or exact shots into customer videos.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const OUT = path.join(ROOT, "reference", "blocky-worlds", "analysis");
const MODEL = "claude-haiku-5-5";
export const DESCRIBE_VERSION = 1;

// USD per 1M tokens. The engine's copy (engine/lib/builder/design.js PRICE) wins when it loads; this fallback mirrors it.
let PRICE = { [MODEL]: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 } };
try { const m = await import("../engine/lib/builder/design.js"); if (m.PRICE?.[MODEL]) PRICE = m.PRICE; } catch { /* engine mid-edit: keep the fallback */ }

/** image tokens Claude bills for a still (w x h / 750; same maths as engine/lib/vision/judge.js) */
export const imageTokens = (w, h) => Math.ceil((w * h) / 750);
export const textTokens = (s) => Math.ceil(String(s ?? "").length / 4);

export const LIBRARY_CATEGORIES = Object.freeze([
  "establishing", "world_rule_explainer", "giant_reveal", "giant_walk", "giant_action", "scale_comparison", "town_life",
  "people_reaction", "kid_or_family_moment", "funny_beat", "threat_arrives", "attack", "chain_or_tether", "defence_or_weapon",
  "destruction", "town_shakes", "chase_or_escape", "night_scene", "aftermath", "twist_or_ending", "transition", "other",
]);
const DISTANCE = ["extreme_wide", "wide", "medium", "close", "extreme_close"];
const HEIGHT = ["ground_low", "eye_level", "high", "aerial", "top_down", "fpv"];
const MOVE = ["static", "pan", "tilt", "push_in", "pull_out", "orbit", "track", "flyover", "crane", "shake", "roll", "mixed"];
const WHO = ["people_only", "creature_only", "people_and_creature", "town_or_place_only", "object_only", "other"];
const TIME = ["day", "golden_hour", "dusk", "night", "storm", "unclear"];

export const SYSTEM = `You label shots from short 9:16 narrated "world" videos (blocky / toy-like 3D game-engine look: towns, giant
creatures, little people) so a shot LIBRARY of reusable PATTERNS can be built. You see 1-3 frames per shot (start, mid,
end of the same shot, labelled with the shot id), the narration words spoken during the shot, the line they belong to,
and a measured camera move from optical flow (a hint: trust the frames when they clearly disagree).

For every shot, describe what is ON SCREEN, not the story:
- shotType: distance (extreme_wide..extreme_close) and camera height (ground_low, eye_level, high, aerial, top_down, fpv).
- cameraMove as seen across the frames (static, pan, tilt, push_in, pull_out, orbit, track, flyover, crane, shake, roll,
  mixed) and how it serves the line (reveal, follow, emphasise scale...).
- subject: the main thing in frame and how big it is in frame; scaleCues: what shows how huge or small it is (houses
  next to a foot, people as dots, trees up to its knee...).
- action and causeEffect: what happens, and what it causes (foot lands -> dust and houses shake).
- place, timeOfDay, who: people vs creature vs both.
- emotion / tone of the shot (calm, awe, fear, funny...), and whether it is a funny beat.
- coversLine: the narration words this shot illustrates, and how literally it shows them (literal / partial / mood_only).
- libraryLabel: a SHORT generic label of the reusable pattern, 3-7 words, e.g. "giant walks through forest",
  "army attacks giant", "chain snaps", "kid scared at night", "town shakes", "monster reveal from fog",
  "funny neighbour example", "top-down town on creature's back". libraryCategory from the list.
- pattern: one sentence a director could reuse for ANY topic (what the shot does and why it works), no specifics.
RULES: no proper names, no channel names, no on-screen caption text beyond saying captions are visible, no copying of
the story; describe patterns generically ("a giant tortoise" is fine, a character's name is not). Keep every field short.
Return JSON matching the schema, one entry per shot id given, in order.`;

export function schema() {
  const str = { type: "string" };
  const en = (e) => ({ type: "string", enum: e });
  return {
    type: "object", additionalProperties: false, required: ["shots"],
    properties: {
      shots: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "distance", "height", "cameraMove", "moveRole", "subject", "subjectSize", "scaleCues", "action", "causeEffect",
            "place", "timeOfDay", "who", "emotion", "funnyBeat", "coversLine", "lineFit", "libraryLabel", "libraryCategory", "pattern", "captionsVisible"],
          properties: {
            id: str, distance: en(DISTANCE), height: en(HEIGHT), cameraMove: en(MOVE), moveRole: str,
            subject: str, subjectSize: en(["tiny", "small", "half_frame", "fills_frame", "bigger_than_frame"]), scaleCues: str,
            action: str, causeEffect: str, place: str, timeOfDay: en(TIME), who: en(WHO), emotion: str, funnyBeat: { type: "boolean" },
            coversLine: str, lineFit: en(["literal", "partial", "mood_only", "no_line"]), libraryLabel: str,
            libraryCategory: en([...LIBRARY_CATEGORIES]), pattern: str, captionsVisible: { type: "boolean" },
          },
        },
      },
    },
  };
}

// --------------------------------------------------------------------------------------------- shots -> request items
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

/** frames per shot: auto = 1 (mid) under 0.9 s, 2 (start + end) up to 2.5 s, 3 above */
export function framesFor(shot, mode = "auto") {
  if (mode === "1") return ["mid"];
  if (mode === "2") return ["start", "end"];
  if (mode === "3") return ["start", "mid", "end"];
  return shot.dur < 0.9 ? ["mid"] : shot.dur <= 2.5 ? ["start", "end"] : ["start", "mid", "end"];
}

export function itemText(v, s, lines) {
  const ln = (s.lines ?? []).map((n) => lines.find((l) => l.n === n)?.text).filter(Boolean).join(" / ");
  const m = s.move ?? {};
  return `[${v}:s${s.n}] ${s.dur.toFixed(2)} s; measured move: ${m.type ?? "unknown"} (${m.intensity ?? "?"}, ${m.smooth ?? "?"}${m.secondary ? `, also ${m.secondary}` : ""}); `
    + `words during shot: "${s.words ?? ""}"; line: "${ln}"; cut lands: ${s.cut?.kind ?? "?"} "${s.cut?.word ?? ""}"`;
}

function loadVideos(only) {
  if (!fs.existsSync(OUT)) return [];
  return fs.readdirSync(OUT).filter((d) => !d.startsWith("_") && fs.statSync(path.join(OUT, d)).isDirectory() && (!only || d === only)).map((id) => {
    const dir = path.join(OUT, id);
    const vis0 = readJson(path.join(dir, "visual.json"));
    const sh0 = readJson(path.join(dir, "shots.json"));
    const sh = sh0 && vis0 && sh0.version === vis0.version ? sh0 : null;   // a shots.json older than the visual pass is stale
    const vis = readJson(path.join(dir, "visual.json"));
    const meta = readJson(path.join(dir, "meta.json"));
    const desc = readJson(path.join(dir, "descriptions.json"));
    return { id, dir, sh, vis, meta, desc };
  });
}

const SYS_TOKENS = textTokens(SYSTEM) + textTokens(JSON.stringify(schema()));
const OUT_PER_SHOT = { typical: 190, max: 320 };   // ~21 short fields of JSON per shot
const maxTokensFor = (n) => 1500 + OUT_PER_SHOT.max * n;   // room for thinking + every field

function requestInput(items) {
  let t = SYS_TOKENS + 60;
  for (const it of items) { t += textTokens(it.text) + 10; for (const f of it.frames) t += imageTokens(f.w, f.h) + 12; }
  return t;
}
const usd = (tokens, rate) => (tokens * rate) / 1e6;

/** price of a set of requests: typical (system cached after the first, typical output) and worst (all input at the
 *  dearest input rate + every max_tokens output token) */
export function priceOf(batches) {
  const p = PRICE[MODEL];
  let typ = 0, worst = 0, inTok = 0, outTyp = 0, imgs = 0;
  batches.forEach((b, i) => {
    const inp = requestInput(b);
    inTok += inp;
    imgs += b.reduce((a, it) => a + it.frames.length, 0);
    // + ~400 thinking tokens a request (Haiku 5.5 thinks by default; effort low keeps it short)
    const o = OUT_PER_SHOT.typical * b.length + 60 + 400;
    outTyp += o;
    // the ~1k-token system prompt may sit under Haiku's minimum cacheable prefix: billed at the plain input rate
    typ += usd(inp, p.input) + usd(o, p.output);
    worst += usd(inp, Math.max(p.input, p.cacheWrite)) + usd(maxTokensFor(b.length), p.output);
  });
  return { requests: batches.length, images: imgs, inputTokens: inTok, outputTokensTypical: outTyp, typicalUsd: typ, worstUsd: worst };
}

function buildItems(videos, frameMode, { includeDone = false } = {}) {
  const items = [];
  const pending = [];
  for (const v of videos) {
    const src = v.sh ?? v.vis;   // visual.json is enough to count before the transcript is in
    if (!src?.shots) { pending.push(v.id); continue; }
    const done = new Set(includeDone ? [] : Object.keys(v.desc?.shots ?? {}).map(Number));
    const [w, h] = src.frameSize ?? [270, 480];
    for (const s of src.shots) {
      if (done.has(s.n)) continue;
      const frames = framesFor(s, frameMode).map((tag) => ({ tag, rel: s.frames[tag], w, h }));
      const text = v.sh ? itemText(v.id, s, v.sh.lines ?? []) : itemText(v.id, { ...s, words: "x".repeat(30), lines: [] }, []) + " ".repeat(60);
      items.push({ video: v.id, n: s.n, id: `${v.id}:s${s.n}`, text, frames, final: !!v.sh });
    }
  }
  return { items, pending };
}

/** consecutive shots of one video per request, `size` shots each */
export function batchesOf(items, size) {
  const out = [];
  let cur = [];
  for (const it of items) {
    if (cur.length && (cur.length >= size || cur[0].video !== it.video)) { out.push(cur); cur = []; }
    cur.push(it);
  }
  if (cur.length) out.push(cur);
  return out;
}

// --------------------------------------------------------------------------------------------- main
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

async function main() {
  const size = Number(opt("--batch", "10"));
  const frameMode = opt("--frames", "auto");
  const only = opt("--only", null);
  const limit = Number(opt("--limit-shots", "0"));
  const videos = loadVideos(only);
  const { items: all, pending } = buildItems(videos, frameMode);
  const items = limit > 0 ? all.slice(0, limit) : all;
  const doneShots = videos.reduce((a, v) => a + Object.keys(v.desc?.shots ?? {}).length, 0);
  const fmt = (x) => `$${x.toFixed(4)}`;
  const line = (label, pr) => console.log(`${label.padEnd(34)} ${String(pr.requests).padStart(5)} req ${String(pr.images).padStart(6)} imgs ${String(pr.inputTokens).padStart(9)} in ${String(pr.outputTokensTypical).padStart(8)} out  typical ${fmt(pr.typicalUsd)}  worst ${fmt(pr.worstUsd)}`);

  if (!(flag("--paid") && flag("--yes") && opt("--max-usd", null))) {
    if (flag("--paid") || flag("--yes")) console.log("REFUSED: a paid run needs ALL of --paid --yes --max-usd <usd>. Showing the dry run instead.\n");
    console.log(`DRY RUN (no API call). Model ${MODEL}, price/1M: in $${PRICE[MODEL].input} out $${PRICE[MODEL].output} cache-write $${PRICE[MODEL].cacheWrite} cache-read $${PRICE[MODEL].cacheRead}`);
    console.log(`videos with shots: ${videos.length - pending.length}/${videos.length}${pending.length ? ` (no visual pass yet: ${pending.join(", ")})` : ""}; already described: ${doneShots} shots`);
    console.log(`shots to describe: ${items.length} (${items.filter((i) => i.final).length} with transcript, ${items.filter((i) => !i.final).length} visual-only, text estimated); system prompt+schema ~${SYS_TOKENS} tokens; still ${items[0]?.frames[0]?.w ?? 270}x${items[0]?.frames[0]?.h ?? 480} = ${imageTokens(items[0]?.frames[0]?.w ?? 270, items[0]?.frames[0]?.h ?? 480)} tokens\n`);
    for (const fm of ["1", "auto", "2", "3"]) for (const b of [8, 10, 12]) {
      const it = buildItems(videos, fm).items;
      line(`frames ${fm.padEnd(4)} batch ${b}`, priceOf(batchesOf(limit > 0 ? it.slice(0, limit) : it, b)));
    }
    const chosen = priceOf(batchesOf(items, size));
    const vidsWithShots = videos.filter((v) => (v.sh ?? v.vis)?.shots);
    const meanShots = vidsWithShots.reduce((a, v) => a + (v.sh ?? v.vis).shots.length, 0) / Math.max(1, vidsWithShots.length);
    const per = chosen.typicalUsd / Math.max(1, items.length) * meanShots;
    const perW = chosen.worstUsd / Math.max(1, items.length) * meanShots;
    console.log(`\nCHOSEN (frames ${frameMode}, batch ${size}): typical ${fmt(chosen.typicalUsd)}, worst ${fmt(chosen.worstUsd)}; per new video (~${meanShots.toFixed(0)} shots): typical ${fmt(per)}, worst ${fmt(perW)}`);
    console.log(`paid command (after the owner's go): node scripts/blockyWorlds/shotlib/describe.mjs --paid --yes --max-usd ${Math.max(0.05, Math.ceil(chosen.worstUsd * 1.1 * 100) / 100).toFixed(2)} --batch ${size} --frames ${frameMode}`);
    return;
  }

  // ------------------------------------------------------------------------------------------- PAID
  const maxUsd = Number(opt("--max-usd", "0"));
  if (!(maxUsd > 0)) throw new Error("--max-usd must be a positive number");
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
  if (!apiKey) throw new Error("no ANTHROPIC_API_KEY / ANTHROPIC_KEY in the environment");
  const notFinal = items.filter((i) => !i.final);
  if (notFinal.length) console.log(`skipping ${notFinal.length} shots whose video has no transcript yet (run analyse.py first)`);
  const ready = items.filter((i) => i.final);
  const batches = batchesOf(ready, size);
  const est = priceOf(batches);
  console.log(`PAID run: ${ready.length} shots, ${batches.length} requests; estimate typical $${est.typicalUsd.toFixed(4)}, worst $${est.worstUsd.toFixed(4)}; cap $${maxUsd}`);
  const { callClaude } = await import("../engine/lib/builder/design.js");
  let spent = 0;
  for (const [k, b] of batches.entries()) {
    const worstNext = priceOf([b]).worstUsd;
    if (spent + worstNext > maxUsd) { console.log(`STOP: spent $${spent.toFixed(4)}, the next request could cost $${worstNext.toFixed(4)} (cap $${maxUsd})`); break; }
    const content = [{ type: "text", text: `Shots (${b.length}), consecutive in one video:` }];
    for (const it of b) {
      content.push({ type: "text", text: it.text });
      for (const f of it.frames) {
        const v = videos.find((x) => x.id === it.video);
        content.push({ type: "text", text: `${it.id} ${f.tag}` });
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(path.join(v.dir, f.rel)).toString("base64") } });
      }
    }
    let r;
    try {
      r = await callClaude({ apiKey, model: MODEL, system: SYSTEM, content, schema: schema(), effort: "low", maxTokens: maxTokensFor(b.length) });
    } catch (e) {
      spent += e.costUsd ?? 0;
      console.log(`request ${k + 1}/${batches.length} failed: ${e.message} (spent $${spent.toFixed(4)}); stopping (no paid retries)`);
      break;
    }
    spent += r.costUsd;
    const v = videos.find((x) => x.id === b[0].video);
    const p = path.join(v.dir, "descriptions.json");
    const cur = readJson(p) ?? { version: DESCRIBE_VERSION, model: MODEL, patternsOnly: "never copy story, characters, names, footage or exact shots", shots: {} };
    // match each answer to its shot by id; when the model rewrote the ids (whole batches were lost on 2026-11-07),
    // fall back to the answer's position in the batch (the answers come back in the order the shots were sent)
    const answers = r.data?.shots ?? [], used = new Set();
    const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    answers.forEach((d, i) => {
      let it = b.find((x) => x.id === d.id) ?? b.find((x) => norm(x.id) === norm(d.id));
      if (!it || used.has(it)) it = answers.length === b.length ? b[i] : null;
      if (it && !used.has(it)) { used.add(it); cur.shots[it.n] = { ...d, frames: it.frames.map((f) => f.tag), at: new Date().toISOString() }; }
    });
    if (used.size < b.length) console.log(`  warning: ${b.length - used.size} of ${b.length} shots in this batch got no description`);
    cur.costUsd = Number(((cur.costUsd ?? 0) + r.costUsd).toFixed(6));
    fs.writeFileSync(p + ".tmp", JSON.stringify(cur, null, 1));
    fs.renameSync(p + ".tmp", p);
    console.log(`request ${k + 1}/${batches.length} ${b[0].video} shots ${b[0].n}-${b.at(-1).n}: $${r.costUsd.toFixed(5)} (total $${spent.toFixed(4)})`);
  }
  console.log(`done: spent $${spent.toFixed(4)}`);
}

if (isMain) main().catch((e) => { console.error(e.message); process.exit(1); });
