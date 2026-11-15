// Blender kit engine (Studio-Blender): one video, fully automatic after the script. Driver for the owner test and the
// shape the worker step (steps.mjs) follows.
//   1. the script + the narrator take come from the run dir (engine/dev/studio/prepare.mjs --studio: OUR production
//      writer in Studio "no refusals" mode, Scruffy Duck on eleven_v3, studio/pace.mjs 1.25x + pause cuts; optionally
//      trim.mjs). Script approval: auto-approved for the owner test and logged.
//   2. the director (director.mjs) plans + writes shots.py in batches; the static pre-check (shotcheck.py)
//   3. previews on the Blender endpoint (the kit's preview mode + the kit's contact sheets), the free pixel check,
//      the fixed vision checker; at most `rounds` (2) fix rounds, each re-previewing only the fixed shots
//   4. a shot that still crashes is merged into its neighbour (never a hole in the final)
//   5. the final in parallel chunks + the kit's finish (cues, mix with OUR music, captions)
//   6. contact sheet + black / flat frame scan of the real encode; new builds that passed -> the library (pending)
// Every paid step is priced worst-case first on the run's ledger (studio/ledger.mjs, the same costs.json prepare.mjs
// used): the hard per-video cap (--cap) and the model cap (--agent-cap).
//   node pipeline.mjs --run <prepare out dir> [--voice-dir <trim dir>] [--model sonnet|opus] [--rounds 2] [--cap 5]
//                     [--agent-cap 2.5] [--chunks 6] [--slug plane_town] --yes
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger, stepTimes } from "../studio/ledger.mjs";
import { loadEnv } from "../engine/runpod/client.mjs";
import { makeDirector, systemPrompt, tileShots, assemble, staticCheck, wordLines, planLocations, planProblems, shotProblems, heroOf, giantSuspect, MODELS, BATCH, MIN_LOCATIONS, PRICING } from "./director.mjs";
import { captionColors } from "./speakers.mjs";
import { LOCATIONS, DRESS } from "./worlds/locations.mjs";
import { runpod, RATE, BOOT_S, GPU, finalEstimate, previewEstimate, fitLimits, chunkLimitS, chunkFloorS, finishLimitS, finishFloorS } from "./rp.mjs";
import { shotFrames, splitShots } from "./plan.mjs";
import { saveAsset, functionSource, findAssets } from "./library.mjs";
import { makeBed, kitMusicDb } from "./music.mjs";
import { actionsSource, actionDocs } from "./actions/actions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const RUN = path.resolve(arg("run"));
const KIT = path.resolve(arg("kit", process.env.BLOCKY_WORLDS_KIT_DIR || path.join(REPO, "reference/blocky-worlds/roblox-story-kit/unzipped/roblox-story-kit")));
const FIX_PER_CALL = 10;
// --topic "<the topic line>", --notes <file>: the owner's production notes for THIS story (its world, its anchors, its
// final image ...), handed to the director as part of the brief (data, like the script)
const TOPIC = arg("topic", ""), NOTES = has("notes") ? fs.readFileSync(path.resolve(arg("notes")), "utf8").trim() : "";
// --fix-notes <json>: the owner's FIX ORDERS for the fix rounds (owner 2026-11-14): { general: "...", order: [ids, by
// priority], shots: { id: "what this shot must show / how to film it" } }; listed shots join fix round 1 even when the
// checker passed them; each order goes to the director with that shot (data, like the notes)
const FIX_NOTES = has("fix-notes") ? JSON.parse(fs.readFileSync(path.resolve(arg("fix-notes")), "utf8")) : null;
// LIBRARY MODE (--worlds, owner 2026-11-14): the director DRESSES our world library (worlds/worlds.py, pasted above its
// header) instead of building worlds; its instructions carry ONE kit example + the library docs; tighter output limits;
// one fix round by default. --scene-plan <file>: the owner's scene plan ({ scenes: [{ lines: [a, b], location }] }).
const WORLDS = has("worlds") ? fs.readFileSync(path.join(HERE, "worlds", "worlds.py"), "utf8") : "";
// THE ACTION LIBRARY (owner 2026-11-15, actions/actions.py + its catalog actions.mjs): tested action moments (the catch
// ...), pasted after the world library in library mode; the director reads the catalog (actionDocs)
const ACTIONS_SRC = WORLDS ? actionsSource() : "";
const SCENE_PLAN = has("scene-plan") ? JSON.parse(fs.readFileSync(path.resolve(arg("scene-plan")), "utf8")) : null;
const SLUG = arg("slug", "plane_town"), ROUNDS = Math.min(2, Number(arg("rounds", WORLDS ? 1 : 2))), K = Number(arg("chunks", 6));
const MODEL = MODELS[arg("model", "sonnet")] ?? MODELS.sonnet;
const L = ledger(RUN, { capUsd: Number(arg("cap", 5)), agentCapUsd: Number(arg("agent-cap", 2.5)) });
const OUT = path.join(RUN, "blender"); fs.mkdirSync(OUT, { recursive: true });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "pipeline.log"), l + "\n"); };
const py = (code, ...args) => { const r = spawnSync("python", ["-P", "-c", code, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(`python: ${(r.stderr || r.stdout).slice(-600)}`); return r.stdout; };
/** the plan's dress (a JSON string) -> only the known keys, plain values */
function storyDress(raw) {
  let d = {}; try { d = typeof raw === "string" ? (raw.trim() ? JSON.parse(raw) : {}) : (raw ?? {}); } catch { d = {}; }
  const out = {};
  for (const k of ["time", "weather", "landmark"]) if (DRESS[k].includes(d[k])) out[k] = d[k];
  for (const k of ["landmark_text", "billboard", "blimp_text"]) if (typeof d[k] === "string" && d[k].trim()) out[k] = d[k].replace(/[^A-Za-z0-9 !?.,'&$#-]/g, "").slice(0, 24);
  if (Array.isArray(d.signs)) out.signs = d.signs.filter((x) => typeof x === "string").map((x) => x.replace(/[^A-Za-z0-9 !?.,'&$#-]/g, "").slice(0, 12)).filter(Boolean).slice(0, 8);
  if (Array.isArray(d.props)) out.props = d.props.filter((x) => DRESS.props.includes(x));
  if (Number.isFinite(Number(d.people))) out.people = Math.max(0, Math.min(40, Math.round(Number(d.people))));
  return out;
}
/** a plain JSON value -> a Python literal (strings, numbers, lists, dicts, booleans) */
const pyLiteral = (v) => (Array.isArray(v) ? `[${v.map(pyLiteral).join(", ")}]` : v && typeof v === "object" ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pyLiteral(x)}`).join(", ")}}` : typeof v === "boolean" ? (v ? "True" : "False") : v == null ? "None" : JSON.stringify(v));
const state = fs.existsSync(path.join(OUT, "state.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "state.json"), "utf8")) : {};
const save = () => fs.writeFileSync(path.join(OUT, "state.json"), JSON.stringify(state, null, 1));

// ---------------------------------------------------------------- inputs (script + take)
const vdirIn = arg("voice-dir") ? path.resolve(arg("voice-dir")) : path.join(RUN, "voice");
const script = fs.existsSync(path.join(vdirIn, "script.json")) ? JSON.parse(fs.readFileSync(path.join(vdirIn, "script.json"), "utf8")) : JSON.parse(fs.readFileSync(path.join(RUN, "results.json"), "utf8")).results[0].script;
const words = JSON.parse(fs.readFileSync(path.join(vdirIn, "words.json"), "utf8"));
const wav = path.join(vdirIn, "voice.wav");
const builds = fs.existsSync(path.join(RUN, "studio-builds.json")) ? JSON.parse(fs.readFileSync(path.join(RUN, "studio-builds.json"), "utf8")) : [];
const { line: lineOf, exact } = wordLines(script, words);
const dur = words[words.length - 1].end + 0.25;
say(`script "${script.title}": ${script.lines.length} lines, ${words.length} words, voice ${dur.toFixed(1)} s (words ${exact ? "match the lines" : "DO NOT match the lines: proportional"}); spent so far $${L.total()} of $${L.capUsd}`);
if (!state.approved) {
  // SCRIPT APPROVAL: the owner test auto-approves (logged); in the app the customer approves before the run starts
  state.approved = { at: new Date().toISOString(), by: "auto (owner test)", lines: script.lines.length, voiceDir: vdirIn };
  L.log({ step: "script_approval", auto: true, lines: script.lines.length, title: script.title });
  save();
}
if (!has("yes")) { say("dry run: nothing paid (add --yes)"); process.exit(0); }

// overlap with the kit's example (it must not be a remake): shared 3-word runs and shared rare words
{
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  const ours = norm(script.lines.map((l) => l.text).join(" ")), theirs = norm(fs.readFileSync(path.join(KIT, "engine/videos/sneeze_teleport/script.txt"), "utf8").split("\n").filter((l) => !l.startsWith("#")).join(" "));
  const tri = (a) => new Set(a.slice(0, -2).map((_, i) => a.slice(i, i + 3).join(" ")));
  const t1 = tri(ours), t2 = tri(theirs), shared = [...t1].filter((x) => t2.has(x));
  const STOPW = new Set("the a an and to of in on it is was my me i you your he she his her we our they their at as for with that this but so then one up out all every if what when there".split(" "));
  const w2 = new Set(theirs), rare = [...new Set(ours)].filter((w) => !STOPW.has(w) && w.length > 3 && w2.has(w));
  state.overlap = { trigramsShared: shared, trigramShare: +(shared.length / Math.max(1, t1.size)).toFixed(3), contentWordsShared: rare };
  save();
  say(`overlap with sneeze_teleport: ${shared.length} shared 3-word runs (${(state.overlap.trigramShare * 100).toFixed(1)}%): ${shared.slice(0, 12).join(" | ") || "-"}; shared content words: ${rare.join(", ")}`);
}

const env = loadEnv();
// the worker passes its key in the environment (workerSteps.mjs, BLOCKY_WORLDS_KEYS_FROM_ENV); the laptop reads .env.local
const apiKey = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || env.ANTHROPIC_KEY;
if (!apiKey) throw new Error("no Anthropic key in .env.local");
// the run's storage folder is KEPT in state: a resume after a failed finish reuses the paid final segments (the first
// test lost them: every process made a new folder)
state.rpPrefix ??= `blocky-worlds-test/blender-kit/${path.basename(RUN)}-${Date.now().toString(36)}`; save();
const R = runpod({ L, prefix: state.rpPrefix, log: say });
// the GPU money still to come, reserved out of the model's room: previews (round 0 + the fix rounds) and the final
// THE GPU LIMITS ARE THE GPU WORST CASES: every job is cancelled past its limit (rp.mjs), so these prices can never be
// passed. Measured: 0.66 s/frame (12 final chunks, two videos), previews ~1-1.5 s a shot after the first, the finish of
// 73 s in 123 s (+ our loudnorm / captions re-encode). Limits: 1.2 s/frame (1.8x), 6 s a preview shot, finish 300 s + 4x
// the video's length.
export const LIMIT = Object.freeze({ sPerFrame: 1.2, perShotS: 3, chunkS: 180, previewShotS: 6, previewJobS: 180 });
const chunkMax = (g) => chunkLimitS({ frames: g.n, shots: g.ids.length }); // scales with the work x the measured speed (rp.mjs)
const finishMax = () => finishLimitS({ dur });
// THE RESERVE (owner 2026-11-14: priced from the MEASURED rates x a margin, rp.mjs GPU): the final, the previews still
// to come (round 0, every fix round left) and the checker calls still to come; a checker call does not reserve itself.
// The hard stop: every job's limit (cancel) is booked before it is sent, and the final's limits are fitted to the money
// left (fitLimits) before any chunk goes out.
const CHECK_USD = 0.09; // the measured checker call ($0.059 for 76 shots on 5 sheets) x the margin
const finalEst = () => finalEstimate({ frames: Math.round(dur * 30), chunks: K, dur });
const reserve = (kind = "agent") => {
  const roundsLeft = Math.max(0, ROUNDS - (state.round ?? 0));
  const nFix = Math.max(20, Object.keys(state.failing ?? {}).length);
  const checks = (state.previewed ? 0 : 1) + roundsLeft - (kind === "agent_check" ? 1 : 0);
  return finalEst() + (state.previewed ? 0 : previewEstimate({ shots: Math.round((dur / 60) * 55), jobs: 3 })) + roundsLeft * previewEstimate({ shots: nFix, jobs: nFix > 24 ? 3 : 1 }) + Math.max(0, checks) * CHECK_USD;
};
say(`reserved for the GPU + checks: $${reserve().toFixed(3)} (final $${finalEst().toFixed(3)}, priced from the measured rates x ${GPU.margin})`);

// ---------------------------------------------------------------- 2. the director
const kitMap = path.join(OUT, "kitmap.md");
spawnSync("python", ["-I", path.join(HERE, "kitmap.py"), path.join(KIT, "engine"), kitMap], { encoding: "utf8" });
const worldDocs = WORLDS ? [
  "HOW TO USE IT in a shot body (the library code is already in the file):",
  "  ZW_INFO = zw_build(\"downtown_street\", t0, t1, ZW_STORY_DRESS)      # builds the place, dressed for the story; returns its marks",
  "  ZW_INFO = zw_build(\"downtown_street\", t0, t1, dict(ZW_STORY_DRESS, time=\"night\"))   # a per-shot change of the dress",
  "  cam = Cam(); zw_spot(cam, \"downtown_street\", \"close\", t0, t1)     # a TESTED camera spot (wide / street / close / skyline) with a push",
  "  or your own cam.key / cam.push near a tested spot (same height range, never inside a wall); stand characters at ZW_INFO marks, e.g. p = ZW_INFO[\"sidewalk_east\"]",
  "  NEVER rebuild a world or call the kit's set builders yourself for a library place; build ONLY the story's own new props / creatures (header_code functions) and place them in the dressed world.",
  // (first library test: 19 of 21 crashes were chars.Char's default face "eddie", whose texture the kit does not ship)
  "  EVERY chars.Char(...) passes face= one of: hero, kid, girl, mustache, plain, villain, hero_blood (the kit ships only these face textures; the default face crashes). Colours are \"#rrggbb\" strings (never empty).",
  `DRESS (the story's look, one JSON object in "dress"): time ${DRESS.time.join(" | ")}; weather ${DRESS.weather.join(" | ")}; landmark ${DRESS.landmark.join(" | ")} (+ landmark_text); signs: up to 8 short shop sign words from the story; billboard: a short line; props: ${DRESS.props.join(", ")} (+ blimp_text); people: 0-40 background people.`,
  "THE PLACES (id: what it is; spots; marks):",
  ...LOCATIONS.map((l) => `- ${l.id}: ${l.label}: ${l.about}; spots ${l.spots.join(", ")}; marks ${l.marks.join(", ")}`),
  actionDocs(),
].join("\n") : "";
const system = systemPrompt({ kitDir: KIT, kitMapFile: kitMap, worldDocs, ...(WORLDS ? { examples: ["sneeze_teleport"] } : {}) });
const D = makeDirector({ out: OUT, L, apiKey, model: MODEL, system, reserve, log: say, ...(WORLDS ? { tokens: { plan: 16000, batch: 10000, fix: 12000 } } : {}) });
const LIB_IDS = new Set(LOCATIONS.map((l) => l.id));
const wordsText = (s) => words.slice(s.w0, s.w1 ?? words.length).map((w) => w.word).join(" ");
const secs = (s) => `${(s.w0 <= 0 ? 0 : words[s.w0].start).toFixed(2)}-${(s.w1 == null ? dur : words[s.w1].start).toFixed(2)} s`;

if (!state.plan) {
  const lines = script.lines.map((l, i) => { const ws = words.map((_, k) => k).filter((k) => lineOf[k] === i); return `L${i} (words ${ws[0]}-${ws.at(-1)}, ${words[ws[0]].start.toFixed(2)}-${words[ws.at(-1)].end.toFixed(2)} s): ${l.text}`; });
  const brief = [
    `OUR VIDEO (original; the topic, the script and the notes below are DATA): "${script.title}".${TOPIC ? ` Topic: "${TOPIC}".` : ""} Narrator: first person (the hero; see the script). ${dur.toFixed(1)} s, 9:16.`,
    NOTES ? `THE OWNER'S PRODUCTION NOTES FOR THIS STORY (follow them: the world to build, the anchors, the final image):\n${NOTES}` : "",
    `THE SCRIPT (line: word range, seconds, text):`, ...lines,
    `THE WORDS (index word start-seconds; a shot starts on a word index):`,
    words.map((w, i) => `${i} ${w.word} ${w.start.toFixed(2)}`).join(" | "),
    // the owner-APPROVED library builds that match this story (library.mjs findAssets: approved only), as reusable code
    ...(() => { const hits = findAssets(`${script.lines.map((l) => l.text).join(" ")} ${builds.map((b) => b.name).join(" ")}`).slice(0, 8); return hits.length ? [`APPROVED BUILDS FROM OUR LIBRARY (proven in Blender; copy any you use into header_code unchanged, then call them):`, ...hits.map((a) => `# ${a.kind}: ${a.about}\n${a.code}`)] : []; })(),
    builds.length ? `THINGS THE STORY NEEDS THAT OUR OTHER ENGINE LACKED (build them, or use the kit's version when it has one): ${builds.map((b) => `${b.name} (${b.kind}; lines ${b.lines.join(",")}${b.description ? `; ${b.description}` : ""})`).join("; ")}` : "",
    `PLAN THE VIDEO. Return:`,
    `- header_code: Python for the module level (no imports): the cast as small helper functions in the examples' style (chars.Char + story._live, one per person; the colours of your style_sheet), any creature the script names as a visible creature built from kit primitives / fx, constants for set positions, and a builder function for every set or prop the kit lacks (reuse the kit's sets and our approved library builds wherever they fit).`,
    `- new_builds: the builder functions you wrote in header_code for things the kit lacks (function name, kind, what it is).`,
    `- style_sheet: every named character once: name, hero (true for exactly ONE: the narrator / main character), outfit (the hero's is ONE striking outfit worn in every shot), colors (their own distinct colours, e.g. "yellow and black stripes"). The cast helpers in header_code use exactly these.`,
    `- anchors: the recurring places (location names as on the shots) that are set up early and COME BACK in the ending.`,
    ...(WORLDS ? [`- LIBRARY MODE: every shot's location is EXACTLY one library place id (${[...LIB_IDS].join(", ")}); a story may jump between places (street -> moon -> plane). dress: the story's dress JSON (landmark + landmark_text, the shop signs and billboard from the story, time, weather, props, people). header_code: ONLY the cast + the story's own new props / creatures (the worlds are already in the file).`] : []),
    ...(SCENE_PLAN?.scenes?.length ? [`THE OWNER'S SCENE PLAN (use exactly these locations for these lines):`, ...SCENE_PLAN.scenes.map((sc) => `- lines ${sc.lines[0]}-${sc.lines[1]}: ${sc.location}`)] : []),
    `- shots: about ${Math.round((dur / 60) * 50)} shots (about 50 a minute, 0.4-2.5 s each), in order; each = { id (1, 2, ...), w0 = the index of its first word (the first shot 0), desc = what we see (the line's key noun / action LITERALLY), location = the set it is in (short name) }. Use at least ${MIN_LOCATIONS} different locations. A shot lasts until the next shot's first word; the last shot ends with the audio. Cut on the word that brings a new image; every named thing gets its own shot; reaction close-ups on the big beats (the twist: the hero's face up close); the first shot is mid-action; the last shot shows the consequence of the last line.`,
    `You will then write the shot bodies in batches of ${BATCH}. Keep the header complete now: later batches can only add small helpers.`,
  ].filter(Boolean).join("\n");
  let r = await L.step("director_plan", () => D.plan({ brief }));
  // THE PLAN CHECK (director.mjs planProblems): 3+ locations (first test: almost every shot in the same cabin aisle),
  // ~50 cuts a minute, one hero + distinct colours per character, anchors that come back in the ending; one re-plan,
  // then a stop (before any GPU money)
  let probs = planProblems(r.data, dur, { library: WORLDS ? LIB_IDS : null });
  if (probs.length) {
    say(`plan check: ${probs.length} problem(s): ${probs.join(" | ")}`);
    r = await L.step("director_plan", () => D.plan({ brief: `PLAN CHECK FAILED:\n${probs.map((x) => `- ${x}`).join("\n")}\nRe-plan the WHOLE video (same answer format: title, header_code, new_builds, style_sheet, anchors, every shot with id, w0, desc, location) so every point above is met (add any set builders to header_code).` }));
    probs = planProblems(r.data, dur, { library: WORLDS ? LIB_IDS : null });
    if (probs.length) throw new Error(`plan check: still failing after a re-plan: ${probs.join(" | ")}: stopped before any render`);
  }
  const locs = planLocations(r.data.shots ?? []);
  const t = tileShots(r.data.shots ?? [], words);
  state.plan = { title: r.data.title ?? script.title, header: r.data.header_code ?? "", newBuilds: r.data.new_builds ?? [], shots: t.shots, mergedAtPlan: t.merged, cutOff: r.cutOff, locations: locs.list, styleSheet: r.data.style_sheet ?? [], anchors: r.data.anchors ?? [], dress: storyDress(r.data.dress) };
  state.bodies = {};
  state.convo = D.convo; // a resume continues the same conversation (the batches need the plan turn)
  save();
  say(`plan: ${t.shots.length} shots in ${locs.n} locations (${locs.list.join(", ")}) (${t.merged.length} too short, merged), ${state.plan.newBuilds.length} new builds (${state.plan.newBuilds.map((b) => b.function).join(", ")}), header ${state.plan.header.length} chars${r.cutOff ? " (CUT OFF)" : ""}`);
  if (!state.plan.header.trim() || !t.shots.length) throw new Error("the plan came back without a header or shots");
} else D.convo.push(...(state.convo ?? []));

const plan = state.plan;
const shotById = (id) => plan.shots.find((s) => s.id === id);
// AN INTENTIONAL BLACK SCREEN (owner 2026-11-14): up to 2 s, only on a shot whose words or line say black / dark /
// lights out / blackout; the black-frame checks (previews, the final scan) let exactly those through
const DARK = /\b(black(?:ness|out)?|dark(?:ness)?|pitch[- ]black|lights?\s+(?:went\s+|go\s+|goes\s+)?(?:out|off))\b/i;
const t0Of = (s) => (s.w0 <= 0 ? 0 : words[s.w0].start), t1Of = (s) => (s.w1 == null ? dur : words[s.w1].start);
const darkOk = (s) => t1Of(s) - t0Of(s) <= 2.0 && (DARK.test(wordsText(s)) || words.slice(s.w0, s.w1 ?? words.length).some((_, k) => DARK.test(script.lines[lineOf[s.w0 + k]]?.text ?? "")));
/** the lines each shot covers -> per line: { line, text, shots } */
const linesOfShots = (shots) => {
  const m = new Map();
  for (const s of shots) for (let k = s.w0; k < (s.w1 ?? words.length); k++) { const li = lineOf[k]; if (!m.has(li)) m.set(li, new Set()); m.get(li).add(s.id); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([line, ids]) => ({ line, text: script.lines[line]?.text ?? "", shots: [...ids] }));
};
/** shots that cannot render join their neighbour: the shot before runs on to the next shot's first word (the new first
 *  shot starts at word 0); never a hole in the timeline */
function mergeOut(ids, why) {
  if (!ids.length) return;
  if (ids.length >= plan.shots.length) throw new Error("every shot failed: nothing to merge into");
  plan.shots = plan.shots.filter((s) => !ids.includes(s.id));
  plan.shots.forEach((s, i) => { if (i === 0) s.w0 = 0; s.w1 = i + 1 < plan.shots.length ? plan.shots[i + 1].w0 : null; });
  for (const id of ids) delete state.bodies[id];
  (state.merged ??= []).push(...ids.map((id) => ({ id, why })));
  save();
  say(`merged ${ids.length} shot(s) into their neighbours (${why}): ${ids.join(", ")}`);
}
// library mode: the world library + the story's dress above the director's header
const headerOf = () => (WORLDS ? `${WORLDS}\n${ACTIONS_SRC}\nZW_STORY_DRESS = ${pyLiteral(plan.dress ?? {})}\n\n` : "") + plan.header;
const writeFile = () => assemble({ title: plan.title, header: headerOf(), shots: plan.shots, bodies: state.bodies, slug: SLUG });

// batches of <= BATCH shots; a cut-off batch keeps its complete shots, the rest go into the next call
for (let guard = 0; guard < 30; guard++) {
  const todo = plan.shots.filter((s) => !state.bodies[s.id]);
  if (!todo.length) break;
  const batch = todo.slice(0, BATCH);
  const text = [`Write the bodies of shots ${batch.map((s) => s.id).join(", ")} (only these ids). For each shot: the inside of def sNN(t0, t1) (t0 / t1 = its start / end seconds), using the header's helpers and the kit. Keep each body short (about 8-25 lines) like the examples.`,
    ...batch.map((s) => `shot ${s.id} (${secs(s)}; words: "${wordsText(s)}"): ${s.desc}`)].join("\n");
  const r = await L.step("director_batch", () => D.bodies({ label: `batch_${batch[0].id}_${batch.at(-1).id}`, text }));
  let got = 0;
  for (const x of r.data.shots ?? []) if (batch.some((s) => s.id === x.id) && String(x.body ?? "").trim()) { state.bodies[x.id] = x.body; got++; }
  state.convo = D.convo; save();
  say(`batch ${batch[0].id}-${batch.at(-1).id}: ${got} of ${batch.length} bodies${r.cutOff ? " (cut off: the rest go next)" : ""}`);
  if (!got) throw new Error(`batch ${batch[0].id}-${batch.at(-1).id} returned no body`);
}

// the static pre-check; failing shots (or a failing header) get ONE writing fix before any GPU sees the file
const vdir = path.join(OUT, "video"); fs.mkdirSync(path.join(vdir, "audio"), { recursive: true });
fs.copyFileSync(wav, path.join(vdir, "audio", "voice.wav"));
fs.writeFileSync(path.join(vdir, "audio", "words.json"), JSON.stringify(words));
fs.writeFileSync(path.join(vdir, "script.txt"), script.lines.map((l) => l.text).join("\n") + "\n");
const shotsFile = path.join(vdir, "shots.py");
let sc = staticCheck(writeFile(), shotsFile);
if (!sc.ok && !state.prefixed) {
  state.prefixed = true;
  const bad = [...new Set(sc.problems.map((p) => p.shot))];
  const text = [`The static checker refused these parts of the file (it only allows the kit, math, random, Vector and D; no imports, os only as os.path.join(W.TEX, ...), no getattr / open / dunders / bpy.ops). Fix them.`,
    ...sc.problems.slice(0, 40).map((p) => `- ${p.shot == null ? "header" : `shot ${p.shot}`} line ${p.line}: ${p.problem}`),
    bad.includes(null) ? `Return the corrected header parts in header_append (they are added after the header and may redefine its functions).` : `header_append: "" unless a helper must change.`,
    ...bad.filter((x) => x != null).map((id) => `shot ${id} current body:\n${state.bodies[id]}`)].join("\n");
  const r = await L.step("director_prefix", () => D.fix({ label: "static_fix", text }));
  if (r.data.header_append?.trim()) plan.header += `\n\n# --- fix (static check)\n${r.data.header_append}`;
  for (const x of r.data.shots ?? []) if (shotById(x.id)) state.bodies[x.id] = x.body;
  state.convo = D.convo; save();
  sc = staticCheck(writeFile(), shotsFile);
}
if (!sc.ok) {
  const hdr = sc.problems.filter((p) => p.shot == null);
  if (hdr.length) throw new Error(`the header still fails the static check: ${hdr.map((p) => p.problem).join("; ")}`);
  mergeOut([...new Set(sc.problems.map((p) => p.shot))], "static");
  sc = staticCheck(writeFile(), shotsFile);
}
say(`static check: ${sc.ok ? "ok" : `${sc.problems.length} problem(s)`}, ${plan.shots.length} shots`);
// THE SHOT CHECK (director.mjs shotProblems, owner 2026-11-14): no camera spot twice in a row, the hero in at least
// half the shots, no literal camera inside a wall / building of a library place; ONE writing fix before any GPU money
let shp = shotProblems({ shots: plan.shots, bodies: state.bodies, hero: heroOf(plan.styleSheet) });
if (Object.keys(shp).length && !state.shotFixed) {
  state.shotFixed = true;
  const ids = Object.keys(shp).map(Number).slice(0, 2 * BATCH);
  const text = [`THE SHOT CHECK found these problems (never the same camera spot twice in a row; the hero ${heroOf(plan.styleSheet) ?? ""} on screen in at least half the shots; no camera inside or behind a wall / building). Rewrite ONLY these shots' bodies; header_append "" unless a helper must change.`,
    ...ids.map((id) => `- shot ${id}: ${shp[id]}\n  current body:\n${state.bodies[id]}`)].join("\n");
  let r = null;
  // the caps cannot fund the writing fix: never a stop; the problems ride into fix round 1 (as urgent as a crash)
  try { r = await L.step("director_shotfix", () => D.fix({ label: "shot_fix", text })); }
  catch (e) { if (e.code !== "CAP") throw e; state.shotFixed = "skipped"; state.shotLeft = shp; save(); say(`shot fix SKIPPED: the caps cannot fund it (${e.message}); ${Object.keys(shp).length} shot(s) go to fix round 1`); }
  if (r) {
    if (r.data.header_append?.trim()) plan.header += `\n\n# --- fix (shot check)\n${r.data.header_append}`;
    for (const x of r.data.shots ?? []) if (shotById(x.id) && String(x.body ?? "").trim()) state.bodies[x.id] = x.body;
    state.convo = D.convo; save();
    sc = staticCheck(writeFile(), shotsFile);
    if (!sc.ok) mergeOut([...new Set(sc.problems.map((q) => q.shot).filter((x) => x != null))], "static after the shot fix");
    shp = shotProblems({ shots: plan.shots, bodies: state.bodies, hero: heroOf(plan.styleSheet) });
  }
}
say(`shot check: ${Object.keys(shp).length ? `${Object.keys(shp).length} left (${Object.entries(shp).slice(0, 4).map(([k, v]) => `${k}: ${v.slice(0, 60)}`).join(" | ")})` : "ok"}`);

// ---------------------------------------------------------------- 3. previews + checks + fix rounds
const tarVideo = (name) => {
  const file = path.join(OUT, name);
  py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", file, vdir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav", ...["audio/music_bed.wav", "audio/caption_colors.json"].filter((f) => fs.existsSync(path.join(vdir, f))));
  return file;
};
async function uploadVideo(tag) {
  fs.writeFileSync(shotsFile, writeFile());
  const tgz = tarVideo(`video_${tag}.tgz`);
  await R.putFile(`video_${tag}.tgz`, tgz, "application/gzip");
  return R.signGet(`video_${tag}.tgz`);
}
// per preview frame: mean / spread (blocking: black, one flat colour) + the centre box's biggest 16-level share and edge
// density (a FOREGROUND-SLAB suspect for the checker: calibrated on the first test's 69 previews, it caught 8 of the 12
// slab-type shots the checker flagged and 3 big face close-ups, so it only asks the checker to look, it never blocks)
const PIX = "import sys,json,os\nfrom PIL import Image, ImageStat, ImageFilter\nres={}\nfor f in sorted(os.listdir(sys.argv[1])):\n if f.startswith('shot_') and f.endswith('.png'):\n  im=Image.open(os.path.join(sys.argv[1],f)).convert('L')\n  st=ImageStat.Stat(im)\n  lo=im.resize((72,128)).crop((0,38,72,128))\n  lb=[0]*16\n  for v in lo.tobytes(): lb[v//16]+=1\n  le=lo.filter(ImageFilter.FIND_EDGES).tobytes()\n  c=im.resize((72,128)).crop((14,26,58,102))\n  px=c.tobytes()\n  b=[0]*16\n  for v in px: b[v//16]+=1\n  ed=c.filter(ImageFilter.FIND_EDGES).tobytes()\n  res[int(f[5:-4])]={'mean':round(st.mean[0],1),'std':round(st.stddev[0],1),'cflat':round(max(b)/len(px),2),'cedge':round(sum(1 for v in ed if v>24)/len(px),3),'lflat':round(max(lb)/(72*90),2),'ledge':round(sum(1 for v in le if v>24)/(72*90),3)}\nprint(json.dumps(res))";
export const slabSuspect = (p) => (p.cflat >= 0.45 && p.cedge < 0.14) || (p.cflat >= 0.35 && p.cedge < 0.11);

/** a downloaded preview folder -> the job output it came with (the worker's own rules: failures from the kit's log, sheets of
 *  16 rendered shots in order) */
function rebuildPreviewOut(dir) {
  const log = fs.readFileSync(path.join(dir, "render_log_preview.txt"), "utf8").split("\n");
  const failed = {}; let cur = null;
  for (const l of log) {
    const m = l.match(/^shot (\d+) (ok|FAILED)/);
    if (m) { cur = m[2] === "FAILED" ? m[1] : null; if (cur) failed[cur] = []; continue; }
    if (cur && l.trim()) failed[cur].push(l);
  }
  const have = fs.readdirSync(path.join(dir, "preview")).map((f) => f.match(/^shot_(\d+)\.png$/)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
  const sheets = [];
  for (let k = 0; k < have.length; k += 16) { const grp = have.slice(k, k + 16); const f = `sheet_${String(grp[0]).padStart(2, "0")}_${String(grp.at(-1)).padStart(2, "0")}.jpg`; if (fs.existsSync(path.join(dir, f))) sheets.push({ file: f, shots: grp }); }
  return { failed: Object.fromEntries(Object.entries(failed).map(([k, v]) => [k, v.slice(-6).join("\n").slice(0, 900)])), sheets, renderS: 0, rebuilt: true };
}

async function previewRound(tag, ids) {
  const url = await uploadVideo(tag);
  const groups = ids.length > 24 ? [0, 1, 2].map((g) => ids.filter((_, i) => i % 3 === g)) : [ids];
  // the jobs go out in parallel (each books only itself): the whole round's limits are checked against the cap first
  const todoJobs = groups.filter((g, gi) => !fs.existsSync(path.join(OUT, "previews", tag, String(gi), "out.json")));
  L.check(`preview ${tag} (all ${todoJobs.length} jobs)`, todoJobs.reduce((a, g) => a + (g.length * LIMIT.previewShotS + LIMIT.previewJobS + BOOT_S) * RATE, 0));
  const outs = await Promise.all(groups.map(async (g, gi) => {
    const name = `preview_${tag}_${gi}.tgz`;
    const dir = path.join(OUT, "previews", tag, String(gi)); fs.mkdirSync(dir, { recursive: true });
    // a resume: a preview already downloaded (its job's output saved next to it) is never paid for again
    if (fs.existsSync(path.join(dir, "out.json"))) return { ok: true, dir, ids: g, out: JSON.parse(fs.readFileSync(path.join(dir, "out.json"), "utf8")) };
    if (fs.existsSync(path.join(dir, "preview")) && fs.existsSync(path.join(dir, "render_log_preview.txt"))) return { ok: true, dir, ids: g, out: rebuildPreviewOut(dir) };
    const r = await R.job(`preview ${tag}.${gi} (${g.length} shots)`, { role: "preview", slug: SLUG, videoUrl: url, shots: g.join(","), perSheet: 16, cols: 8, upload: await R.signPuts(name, 2) }, { maxRunSec: g.length * LIMIT.previewShotS + LIMIT.previewJobS, ledgerKey: "runpod_preview" });
    if (!r.ok) return { ok: false, error: r.error, ids: g };
    await R.fetchParts(name, r.output.upload.parts, path.join(dir, "p.tgz"));
    py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
    fs.writeFileSync(path.join(dir, "out.json"), JSON.stringify(r.output));
    return { ok: true, dir, ids: g, out: r.output };
  }));
  const bad = outs.filter((o) => !o.ok);
  if (bad.length) throw new Error(`preview failed: ${bad.map((b) => String(b.error).slice(0, 400)).join(" | ")}`);
  const failed = {}, sheets = [], pixel = {};
  for (const o of outs) {
    Object.assign(failed, o.out.failed ?? {});
    for (const s of o.out.sheets ?? []) sheets.push({ file: path.join(o.dir, s.file), shots: s.shots });
    Object.assign(pixel, JSON.parse(py(PIX, path.join(o.dir, "preview"))));
    fs.mkdirSync(path.join(OUT, "previews", "latest"), { recursive: true });
    for (const f of fs.readdirSync(path.join(o.dir, "preview"))) fs.copyFileSync(path.join(o.dir, "preview", f), path.join(OUT, "previews", "latest", f));
  }
  // ids that did not render at all (no png) count as crashed
  for (const id of ids) if (!pixel[id] && !failed[id]) failed[id] = "no preview frame was rendered";
  const slabs = Object.fromEntries(Object.entries(pixel).filter(([id, p]) => slabSuspect(p) && !failed[id]).map(([id, p]) => [id, p]));
  const pixBad = Object.fromEntries(Object.entries(pixel).filter(([id, p]) => (p.mean < 12 || p.std < 4) && !(shotById(Number(id)) && darkOk(shotById(Number(id))))).map(([id, p]) => [id, p.mean < 12 ? `the frame is black (mean ${p.mean})` : `the frame is one flat colour (std ${p.std})`]));
  // GIANT-PROP suspects (director.mjs giantSuspect: one flat region over the screen-share cap below the sky line)
  const giants = Object.fromEntries(Object.entries(pixel).filter(([id, p]) => giantSuspect(p) && !failed[id] && !slabs[id]).map(([id, p]) => [id, p]));
  return { failed, sheets, pixel, pixBad, slabs, giants, renderS: outs.reduce((a, o) => a + (o.out.renderS ?? 0), 0) };
}
async function vision(tag, sheets, ids, suspects = {}, giants = {}) {
  if (!sheets.length) return {};
  const shots = plan.shots.filter((s) => ids.includes(s.id));
  // EVERY LINE LITERALLY: the lines whose every shot is on these sheets (round 0: all of them)
  const seen = new Set(sheets.flatMap((x) => x.shots));
  const lines = linesOfShots(plan.shots).filter((l) => l.shots.every((id) => seen.has(id)));
  const last = plan.shots[plan.shots.length - 1];
  const r = await L.step("vision_check", () => D.check({ label: `check_${tag}`, sheets, shots, wordsText, suspects, giants, lines, lastShot: ids.includes(last.id) ? last.id : null, darkOk: shots.filter(darkOk).map((s) => s.id) }));
  const out = Object.fromEntries((r.data.shots ?? []).filter((x) => !x.ok).map((x) => [x.id, x.problem]));
  for (const l of r.data.lines ?? []) {
    if (l.ok) continue;
    const L0 = lines.find((x) => x.line === l.line); if (!L0) continue;
    const id = L0.shots.includes(l.fix_shot) ? l.fix_shot : L0.shots[0];
    out[id] = `${out[id] ? `${out[id]}; ` : ""}line ${l.line} "${L0.text}" is not shown literally: its key thing "${l.key}" must be clearly on screen in this shot`;
  }
  return out;
}

state.rounds ??= [];
let failing = {};
if (!state.previewed) {
  const p = await L.step("preview_round0", () => previewRound("r0", plan.shots.map((s) => s.id)));
  const vis = await vision("r0", p.sheets, plan.shots.map((s) => s.id).filter((id) => !p.failed[id]), p.slabs, p.giants);
  failing = mergeProblems(p, vis);
  state.previewed = true; state.round = 0;
  state.rounds.push({ round: 0, shots: plan.shots.length, crashed: Object.keys(p.failed).length, pixel: Object.keys(p.pixBad).length, vision: Object.keys(vis).length, failing: Object.keys(failing).length, sheets: p.sheets.map((s) => s.file) });
  state.failing = failing; save();
  say(`round 0: ${plan.shots.length} shots previewed: ${Object.keys(p.failed).length} crashed, ${Object.keys(p.pixBad).length} pixel, ${Object.keys(vis).length} vision -> ${Object.keys(failing).length} to fix`);
} else failing = state.failing ?? {};

function mergeProblems(p, vis) {
  const f = {};
  for (const [id, t] of Object.entries(p.failed)) f[id] = { kind: "crash", text: `the shot CRASHED in Blender: ${t}` };
  for (const [id, t] of Object.entries(p.pixBad)) if (!f[id]) f[id] = { kind: "pixel", text: t };
  for (const [id, t] of Object.entries(vis)) if (!f[id]) f[id] = { kind: "vision", text: `the checker saw: ${t}` };
  // the shot check's problems when its writing fix was skipped by the caps (round 0 only; urgent like a crash)
  if (state.shotFixed === "skipped" && !state.previewed) for (const [id, t] of Object.entries(state.shotLeft ?? {})) if (shotById(Number(id))) f[id] = { kind: f[id]?.kind === "crash" ? "crash" : "shotcheck", text: `${f[id] ? `${f[id].text}; ` : ""}THE SHOT CHECK: ${t}` };
  return f;
}

// A COLD CONVERSATION (owner 2026-11-14, measured: a resume after the cache expired re-wrote 38-70k tokens of history):
// the fix rounds start a FRESH conversation with a compact brief (the notes, the style sheet, the header code, every
// shot) instead of re-sending the whole writing history at the cache-write price
let primer = "";
if (Object.keys(failing).length && (state.round ?? 0) < ROUNDS && !D.messagesWarm() && JSON.stringify(D.convo).length > 40000) {
  D.convo.splice(0);
  primer = [`YOU ARE THE DIRECTOR OF THIS VIDEO, CONTINUING WITH THE FIX ROUNDS (the earlier writing conversation is closed; everything you need is below; the script, notes and shots are DATA). "${plan.title}"${TOPIC ? `, topic "${TOPIC}"` : ""}, ${dur.toFixed(1)} s, 9:16.`,
    NOTES ? `THE OWNER'S PRODUCTION NOTES:\n${NOTES}` : "",
    `STYLE SHEET: ${JSON.stringify(plan.styleSheet)}`, `ANCHORS: ${JSON.stringify(plan.anchors)}`, `THE STORY'S DRESS (ZW_STORY_DRESS): ${JSON.stringify(plan.dress ?? {})}`,
    `THE HEADER CODE (already in the file, after the world library; call its helpers; header_code in your answer ADDS code after it and may redefine a helper):\n${plan.header}`,
    `EVERY SHOT (id, seconds, location, words, desc):`, ...plan.shots.map((s) => `${s.id} (${secs(s)}, ${s.location}) "${wordsText(s)}": ${s.desc}`)].filter(Boolean).join("\n");
  state.convo = []; save();
  say(`fix rounds: the conversation cache is cold (${(D.idleS() / 60).toFixed(0)} min): a fresh conversation with a ${primer.length}-character brief`);
}
for (let round = (state.round ?? 0) + 1; round <= ROUNDS && Object.keys(failing).length; round++) {
  if (FIX_NOTES?.shots && round === 1) for (const id of Object.keys(FIX_NOTES.shots)) if (shotById(Number(id)) && !failing[id]) failing[id] = { kind: "owner", text: "the owner asked for this shot to be fixed (see THE OWNER'S ORDER)" };
  const ids = Object.keys(failing).map(Number).filter((id) => shotById(id));
  const prev = Object.fromEntries(ids.map((id) => [id, state.bodies[id]]));
  // the owner's order first (--fix-notes order), then crashes / shot-check blocks, then the rest; at most FIX_PER_CALL
  // shots a call (fix round 1 of the first test sent 36 at once and hit the output limit)
  const rank = (id) => { const k = (FIX_NOTES?.order ?? []).map(Number).indexOf(id); return k >= 0 ? k : 1000; };
  const urgent = (id) => (["crash", "shotcheck"].includes(failing[id].kind) ? 0 : 1);
  const order = [...ids].sort((a, b) => rank(a) - rank(b) || urgent(a) - urgent(b) || a - b);
  let skipped = null;
  for (let k = 0; k < order.length && !skipped; k += FIX_PER_CALL) {
    const part = order.slice(k, k + FIX_PER_CALL);
    const text = [primer, `FIX ROUND ${round} of ${ROUNDS} (part ${k / FIX_PER_CALL + 1} of ${Math.ceil(order.length / FIX_PER_CALL)}). These shots failed in the preview (the kit's preview mode, middle frame at 25% res). Rewrite each body so it renders and reads clearly; a slab / blocked / cropped frame: pull the camera back to a medium shot with the character's head and shoulders, make the small prop bigger, keep the camera 3.5+ units from the subject and 2+ units from any wall, seat or box. Crashes first: read the traceback and use only kit functions and parameters from the toolkit map. If a header helper is broken, fix it in the added header code (it may redefine the function).`,
      FIX_NOTES?.general ? `THE OWNER'S FIX RULES (they come first):\n${FIX_NOTES.general}` : "",
      ...part.map((id) => { const s = shotById(id); const o = FIX_NOTES?.shots?.[id]; return `shot ${id} (${secs(s)}; ${s.location}; words "${wordsText(s)}"; desc: ${s.desc})${o ? `\nTHE OWNER'S ORDER: ${o}` : ""}\nPROBLEM: ${failing[id].text}\nCURRENT BODY:\n${state.bodies[id]}`; })].filter(Boolean).join("\n\n");
    let r;
    try { r = await L.step(`director_fix_${round}`, () => D.fix({ label: `fix_round_${round}_${k / FIX_PER_CALL + 1}`, text })); primer = ""; }
    catch (e) { if (e.code !== "CAP") throw e; skipped = e.message; break; } // no money left for it: never a stop
    if (r.data.header_append?.trim()) plan.header += `\n\n# --- fix round ${round}\n${r.data.header_append}`;
    for (const x of r.data.shots ?? []) if (part.includes(x.id) && String(x.body ?? "").trim()) state.bodies[x.id] = x.body;
    state.convo = D.convo; save();
  }
  if (skipped && Object.values(prev).every((b, i) => state.bodies[ids[i]] === b)) {
    state.rounds.push({ round, skipped }); save();
    say(`round ${round} SKIPPED: the caps cannot fund it (${skipped}); going on to the final with ${ids.length} shot(s) still flagged`);
    break;
  }
  let c = staticCheck(writeFile(), shotsFile);
  if (!c.ok) { // a fix that breaks the static check: that shot keeps its previous body (the header part is dropped)
    for (const p of c.problems) if (p.shot != null && prev[p.shot]) state.bodies[p.shot] = prev[p.shot];
    if (c.problems.some((p) => p.shot == null)) plan.header = plan.header.split(`\n\n# --- fix round ${round}\n`)[0];
    c = staticCheck(writeFile(), shotsFile);
  }
  save();
  { // the free shot check on the fixed bodies (information: the preview + the checker decide)
    const sp = shotProblems({ shots: plan.shots.filter((s) => ids.includes(s.id)), bodies: state.bodies, hero: null });
    say(`round ${round} shot check after the fixes: ${Object.keys(sp).length ? Object.entries(sp).map(([k, v]) => `${k}: ${v.slice(0, 90)}`).join(" | ") : "ok"}`);
  }
  const p = await L.step(`preview_round${round}`, () => previewRound(`r${round}`, ids));
  const vis = await vision(`r${round}`, p.sheets, ids.filter((id) => !p.failed[id]), p.slabs, p.giants);
  failing = mergeProblems(p, vis);
  state.round = round;
  state.rounds.push({ round, fixed: ids.length, crashed: Object.keys(p.failed).length, pixel: Object.keys(p.pixBad).length, vision: Object.keys(vis).length, failing: Object.keys(failing).length, sheets: p.sheets.map((s) => s.file) });
  state.failing = failing; save();
  say(`round ${round}: ${ids.length} shots re-previewed: ${Object.keys(p.failed).length} crashed, ${Object.keys(p.pixBad).length} pixel, ${Object.keys(vis).length} vision -> ${Object.keys(failing).length} still failing`);
}

// ---------------------------------------------------------------- 4. no holes: a shot that still crashes joins its neighbour
const crashed = Object.entries(failing).filter(([, f]) => f.kind === "crash").map(([id]) => Number(id));
if (crashed.length) mergeOut(crashed, "crash");
fs.writeFileSync(shotsFile, writeFile());
const fsc = staticCheck(writeFile(), shotsFile);
if (!fsc.ok) throw new Error(`the final shots.py fails the static check: ${JSON.stringify(fsc.problems).slice(0, 400)}`);

// ---------------------------------------------------------------- 5. the final (parallel) + the kit's finish
const frames = shotFrames(fs.readFileSync(shotsFile, "utf8"), words);
const NF = frames[frames.length - 1].f1, groups = splitShots(frames, K);
// THE FINAL'S HARD STOP (owner 2026-11-14): the job limits (cancel) fitted to the money left: the hard limits when they fit,
// else scaled down toward the measured time x 1.3 (never below); no money for even that: a clean stop before any chunk
const doneC = groups.map((_, i) => Boolean(state.chunks?.[i]?.done));
const hardL = [...groups.map((g, i) => (doneC[i] ? 0 : chunkMax(g))), finishMax()];
const floorL = [...groups.map((g, i) => (doneC[i] ? 0 : chunkFloorS({ frames: g.n }))), finishFloorS({ dur })];
const fit = fitLimits({ hard: hardL.filter((h) => h > 0), floor: floorL.filter((_, i) => hardL[i] > 0), roomUsd: L.capUsd - L.total() });
if (!fit) throw Object.assign(new Error(`CAP: the final cannot be funded: $${(L.capUsd - L.total()).toFixed(3)} left, the measured final needs more: stopped before any chunk`), { code: "CAP" });
const limits = []; { let k = 0; for (const h of hardL) limits.push(h > 0 ? fit.limits[k++] : 0); }
const chunkLimit = (i) => limits[i], finishLimit = limits[limits.length - 1];
const worstFinal = limits.filter((x) => x > 0).reduce((a, x) => a + (x + BOOT_S) * RATE, 0);
L.check("final render + finish (all jobs)", worstFinal);
if (fit.f < 1) say(`final limits fitted to the money left (x${fit.f} of the way from the measured time to the hard limits)`);
say(`final: ${frames.length} shots, ${NF} frames in ${K} chunks (${groups.map((g) => `${g.shots}:${g.n}`).join(" ")}); worst case $${worstFinal.toFixed(3)}; spent $${L.total()}`);
const tFinal = Date.now();
// OUR music (music.mjs): the engine's bed A at the voice's pace, the level of our #2 video (14 LU under the voice); free
const music = await L.step("music_bed", async () => { await makeBed({ seconds: dur, out: path.join(vdir, "audio", "music_bed.wav") }); return kitMusicDb({ voice: path.join(vdir, "audio", "voice.wav"), bed: path.join(vdir, "audio", "music_bed.wav") }); });
state.music = music; save();
// CAPTIONS PER SPEAKER (speakers.mjs): the narrator white, each speaking character their own colour (the script's
// line.speaker + quotes); the finish burns them in the kit's caption style (finishx.py)
const cap = captionColors(script, words);
fs.writeFileSync(path.join(vdir, "audio", "caption_colors.json"), JSON.stringify(cap.colors));
state.captions = { legend: cap.legend, exact: cap.exact }; save();
say(`captions: narrator white${Object.keys(cap.legend).length ? `, ${Object.entries(cap.legend).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}${cap.exact ? "" : " (the words do not match the lines: all white)"}`);
say(`music: engine bed A x1.25, kit --music-db ${music.musicDb} (voice ${music.voiceLufs} LUFS, bed ${music.bedLufs} LUFS)`);
const finalUrl = await uploadVideo("final");
state.chunks ??= {};
const res = await L.step("final_render", () => Promise.all(groups.map(async (g, i) => {
  if (state.chunks[i]?.done) return { ok: true };
  const name = `seg${String(i).padStart(2, "0")}.mp4`;
  const r = await R.job(`chunk ${i} (shots ${g.shots}, ${g.n} frames)`, { role: "render", slug: SLUG, videoUrl: finalUrl, shots: g.ids.join(","), f0: g.f0, f1: g.f1, upload: await R.signPuts(name, 4) }, { maxRunSec: chunkLimit(i), ledgerKey: "runpod_final" });
  if (r.ok) { state.chunks[i] = { done: true, name, parts: r.output.upload.parts, out: r.output, execS: r.execS, bootS: r.bootS }; save(); say(`chunk ${i}: ${r.output.frames} frames in ${r.output.renderS} s (${r.output.sPerFrame} s/frame)`); }
  return r;
})));
const badC = res.filter((r) => !r.ok);
if (badC.length) throw new Error(`final chunks failed (no paid retry): ${badC.map((r) => String(r.error).slice(0, 500)).join(" | ")}`);
const renderWall = (Date.now() - tFinal) / 1000;
const segments = [];
for (let i = 0; i < groups.length; i++) segments.push(await R.signGetParts(state.chunks[i].name, state.chunks[i].parts));
const uploads = { "final.mp4": await R.signPuts("final.mp4", 4), "final_nocaptions.mp4": await R.signPuts("final_nocaptions.mp4", 4), "final_phone.mp4": await R.signPuts("final_phone.mp4", 2) };
const fin = await L.step("finish", () => R.job("finish", { role: "finish", slug: SLUG, videoUrl: finalUrl, frames: NF, segments, uploads, music: true, musicDb: music.musicDb }, { maxRunSec: finishLimit, ledgerKey: "runpod_final" }));
if (!fin.ok) throw new Error(`finish failed: ${String(fin.error).slice(0, 800)}`);
for (const [name, u] of Object.entries(fin.output.uploads)) await R.fetchParts(name, u.parts, path.join(OUT, name));
const finalWall = (Date.now() - tFinal) / 1000;
say(`final: ${path.join(OUT, "final.mp4")} (${fin.output.duration} s; cues ${fin.output.cues?.count}); render wall ${renderWall.toFixed(0)} s, with finish ${finalWall.toFixed(0)} s`);
await R.cleanup().catch((e) => say(`cleanup: ${e.message}`));

// ---------------------------------------------------------------- 6. contact sheet, black / flat frames, library
const sheet = path.join(OUT, "contact.jpg");
spawnSync("python", [path.join(HERE, "contact.py"), path.join(OUT, "final.mp4"), sheet], { encoding: "utf8" });
const SCAN = "import sys,json,subprocess\nfrom PIL import Image, ImageStat\nimport io\nsrc=sys.argv[1]\nraw=subprocess.run(['ffmpeg','-v','error','-i',src,'-vf','fps=4,scale=108:192,format=gray','-f','rawvideo','-'],capture_output=True).stdout\nn=108*192\nout=[]\nfor k in range(len(raw)//n):\n im=Image.frombytes('L',(108,192),raw[k*n:(k+1)*n])\n st=ImageStat.Stat(im)\n m,s=st.mean[0],st.stddev[0]\n if m<12 or s<4:\n  out.append({'t':round(k/4,2),'mean':round(m,1),'std':round(s,1)})\nprint(json.dumps({'samples':len(raw)//n,'bad':out}))";
const scan = JSON.parse(py(SCAN, path.join(OUT, "final_nocaptions.mp4")));
{ const ok = plan.shots.filter(darkOk).map((s) => [t0Of(s), t1Of(s)]); const allowed = scan.bad.filter((b) => ok.some(([a, z]) => b.t >= a - 0.1 && b.t <= z + 0.1)); scan.allowedDark = allowed.map((b) => b.t); scan.bad = scan.bad.filter((b) => !allowed.includes(b)); }
say(`frame scan (4 per second, no captions): ${scan.bad.length} black / flat of ${scan.samples}${scan.bad.length ? `: ${scan.bad.map((b) => b.t).join(", ")} s` : ""}`);
const passed = new Set(plan.shots.map((s) => s.id).filter((id) => !failing[id]));
const saved = [];
for (const b of plan.newBuilds ?? []) {
  const users = plan.shots.filter((s) => passed.has(s.id) && new RegExp(`\\b${b.function}\\s*\\(`).test(String(state.bodies[s.id] ?? "")));
  if (!users.length) continue;
  const code = functionSource(plan.header, b.function);
  if (!code) continue;
  const thumb = path.join(OUT, "previews", "latest", `shot_${String(users[0].id).padStart(2, "0")}.png`);
  saved.push(saveAsset({ name: b.function, kind: b.kind, about: b.about, code, source: { run: path.basename(RUN), shots: users.map((s) => s.id), title: plan.title }, thumbFrom: fs.existsSync(thumb) ? thumb : null }).id);
}
say(`library: ${saved.length} new build(s) saved PENDING the owner's approval: ${saved.join(", ") || "-"}`);

const report = { title: plan.title, slug: SLUG, model: MODEL, duration: fin.output.duration, shots: plan.shots.length, frames: NF, overlap: state.overlap, approved: state.approved,
  rounds: state.rounds, merged: state.merged ?? [], stillFailing: failing, costs: L.costs, total: L.total(), steps: stepTimes(RUN),
  final: { file: path.join(OUT, "final.mp4"), phone: path.join(OUT, "final_phone.mp4"), contact: sheet, renderWallS: +renderWall.toFixed(0), withFinishS: +finalWall.toFixed(0),
    chunks: Object.values(state.chunks).map((c) => ({ frames: c.out.frames, renderS: c.out.renderS, sPerFrame: c.out.sPerFrame, gpu: c.out.gpu?.renderer })), finish: { finishS: fin.output.finishS, cues: fin.output.cues } },
  frameScan: scan, library: saved, sandbox: fin.output.sandbox };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
say(`done: $${L.total()} of $${L.capUsd}; report ${path.join(OUT, "report.json")}`);
