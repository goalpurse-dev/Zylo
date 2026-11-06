// M3: the 40-topic scoreboard (the owner's rule of 2026-11-05: every report starts with it). Free.
// For each benchmark topic (the any-topic plan's 40, by category): its saved real plans (m3/sweep/plans) through the
// pipeline's own free code, as a paid run takes them after planning: the plan checks (solveLayout), the timeline and its
// checks (timelineChecks), and three rendered stills. A topic PASSES when one of its plans has no problem and renders.
// A topic with no saved plan is "no plan yet": it needs a paid planning run first. The vision check is not run (paid).
//   node m3/scoreboard.mjs --proto PROTO [--out DIR] [--no-render]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), M2 = path.join(here, "../m2");
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const PROTO = path.resolve(a.proto), OUT = path.resolve(a.out ?? path.join(PROTO, "..", "scoreboard"));
fs.mkdirSync(OUT, { recursive: true });
const imp = (f) => import(pathToFileURL(path.join(M2, f)).href);
const { layoutRules } = await imp("layoutRules.js"), { solveLayout } = await imp("solver.js"), { compile } = await imp("compile.mjs");
const { draftWords } = await imp("plan.js"), { preparePage } = await imp("make.mjs"), { timelineChecks } = await imp("checks.mjs");

// the 40 benchmark topics (the any-topic plan of 2026-11-04) and their saved plans
export const BENCH = [
  ["Swimming pool", "Yard, house & water", ["swimming_pool"]], ["Toilet", "Yard, house & water", ["toilet"]],
  ["Road", "Yard, house & water", []], ["Septic tank", "Yard, house & water", []], ["Roof", "Yard, house & water", []],
  ["Water well", "Yard, house & water", ["to_build_a_water_well"]], ["Pond", "Yard, house & water", ["backyard_pond", "garden_pond"]],
  ["Garden shelter", "Yard, house & water", []], ["Gas station tank", "Yard, house & water", []], ["Traffic light", "Yard, house & water", ["traffic_light"]],
  ["Sewage treatment plant", "Utilities & energy", []], ["Electricity to your outlet", "Utilities & energy", []], ["Nuclear power plant", "Utilities & energy", []],
  ["Stove", "Appliances", ["real_stove_rerun", "real_stove_first", "gas_stove", "cuisiniere"]], ["Washing machine", "Appliances", ["real_washer", "hand_washer"]],
  ["Fridge", "Appliances", []], ["Air conditioner", "Appliances", []], ["Water heater / shower", "Appliances", []], ["Microwave", "Appliances", []],
  ["Four-wheel steering", "Vehicles & engines", ["four_wheel_steering_turns_a_giant_car_li", "kitplan_steering"]],
  ["Air suspension", "Vehicles & engines", ["air_suspension_bagged_cars_works_the_sim", "kitplan_air_saved"]],
  ["Car engine", "Vehicles & engines", ["hand_engine"]], ["Car brakes", "Vehicles & engines", []], ["Airplane", "Vehicles & engines", ["airplane"]], ["Submarine", "Vehicles & engines", []],
  ["Chainsaw clutch", "Machines & tools", ["chainsaw_clutch_stops_you_from_dying", "kitplan_chainsaw"]], ["Elevator", "Machines & tools", ["whow_an_elevator_works"]], ["Escalator", "Machines & tools", []],
  ["Skyscraper", "Buildings & bridges", ["to_build_a_skyscraper"]], ["Nuclear bunker", "Buildings & bridges", ["real_bunker_rerun", "nuclear_bunker"]],
  ["Arch bridge", "Buildings & bridges", ["ancient_bridge", "bridge"]], ["Suspension bridge", "Buildings & bridges", []], ["Dam", "Buildings & bridges", []],
  ["Tunnel under a river", "Buildings & bridges", []], ["Lighthouse", "Buildings & bridges", []],
  ["Smoke detector", "Electronics & factories", []], ["Chip factory", "Electronics & factories", ["puddle_of_mud_can_become_a_semiconductor"]],
  ["Volcano", "Body, animals & nature", []], ["Heart stent", "Body, animals & nature", []], ["Fish", "Body, animals & nature", ["fish"]],
].map(([name, cat, plans]) => ({ name, cat, plans }));
if (BENCH.length !== 40) throw new Error(`need 40 topics, have ${BENCH.length}`);

const PLANS = path.join(here, "sweep", "plans");
const SERIOUS = /not in the frame|main subject is out of the frame|does nothing in this beat|crash/;
function check(file, dir = PLANS) {
  const P = JSON.parse(fs.readFileSync(path.join(dir, `${file}.json`), "utf8")), S = P.sentences, roles = S.map((s) => s.role);
  let layout = { ...P.layout, roles, key: `score_${file}` };
  if (!layout.codeShots && !layout.camera) layout = layoutRules(layout).layout;
  const solved = solveLayout(layout, S), words = draftWords(S), tl = compile(layout, words, words.at(-1).e + 0.1, { roles }), tc = timelineChecks(layout, tl);
  // (the timeline checks only report in a real run, and the live swimming pool premade has some: a SERIOUS one is what the
  // vision check refuses, a thing the sentence names that is not seen or does nothing; the rest are minor)
  // (calibrated on the four live premades, 2026-11-05: "the main subject is out of the frame" fires on every line of the
  // approved car wash, whose frames show the part each line is about; it is serious only when that line's own part is
  // also missing or small)
  const all = [...(solved.problems ?? []), ...(tc.problems ?? [])];
  const roleOf = (p) => p.match(/^sentence (\w+):/)?.[1], ownBad = new Set(all.filter((p) => / is not in the frame at its moment| is only \d+% of the frame width/.test(p)).map(roleOf));
  const isSerious = (p) => (/main subject is out of the frame/.test(p) ? ownBad.has(roleOf(p)) : SERIOUS.test(p));
  const serious = all.filter(isSerious), minor = all.filter((p) => !isSerious(p));
  const problems = serious;
  let frames = null;
  if (!a["no-render"]) {
    preparePage({ layout, tl, proto: PROTO });
    const dir = path.join(OUT, file); fs.rmSync(dir, { recursive: true, force: true });
    const L = tl.marks?.lengthEnd ?? 10, times = [0.5, L * 0.5, Math.max(0.6, L - 1)].map((t) => t.toFixed(2)).join(",");
    spawnSync(process.execPath, [path.join(PROTO, "m2", "stills.mjs"), `m2_${layout.key}.html`, dir, times], { cwd: PROTO, encoding: "utf8", timeout: 180000 });
    frames = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".png")).length : 0;
  }
  return { file, problems, minor, frames, pass: !problems.length && (frames == null || frames === 3), clean: !all.length };
}

// --known: the live, owner-approved premades (m3/sweep/known) first: every problem they raise is a false alarm of a check
const KNOWN = path.join(here, "sweep", "known");
if (a.known) {
  for (const f of fs.readdirSync(KNOWN).filter((x) => x.endsWith(".json"))) { const r = check(f.replace(/.json$/, ""), KNOWN); console.log(`[known] ${r.file}: ${r.pass ? "pass" : "FAIL"} frames ${r.frames} | serious: ${r.problems.join("; ") || "-"} | minor: ${r.minor.join("; ").slice(0, 600) || "-"}`); }
  if (a.known === "only") process.exit(0);
}
const rows = [];
for (const t of BENCH) {
  const results = t.plans.filter((f) => fs.existsSync(path.join(PLANS, `${f}.json`))).map((f) => { try { return check(f); } catch (e) { return { file: f, problems: [`crash: ${e.message}`], frames: 0, pass: false }; } });
  rows.push({ ...t, results, status: !results.length ? "no plan" : results.some((r) => r.pass) ? "pass" : "fail" });
  console.log(`[score] ${t.name}: ${rows.at(-1).status}${results.filter((r) => !r.pass).map((r) => ` | ${r.file}: ${r.problems.slice(0, 2).join("; ").slice(0, 160)}`).join("")}`);
}
const cats = [...new Set(BENCH.map((t) => t.cat))].map((c) => { const R = rows.filter((r) => r.cat === c); return { cat: c, topics: R.length, pass: R.filter((r) => r.status === "pass").length, fail: R.filter((r) => r.status === "fail").length, noPlan: R.filter((r) => r.status === "no plan").length }; });
fs.writeFileSync(path.join(OUT, "scoreboard.json"), JSON.stringify({ at: new Date().toISOString(), cats, rows }, null, 1));
console.log(`SCORE ${JSON.stringify(cats)}`);
