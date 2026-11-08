// Blocky Worlds SHOT RECIPES, step 1: a DRAFT recipe from one reference video's analysis (free, no API call).
//   node scripts/blockyWorlds/shotlib/recipeFromVideo.mjs <videoId> <storyType> [--out file.json] [--print]
// Reads reference/blocky-worlds/analysis/<id>/{shots.json, descriptions.json} (git-ignored) and maps every shot to its
// beat (the protocol's seven, shotlib/story.mjs segmentBeats on the transcript lines), its ROLE (the description's
// library category), its CAMERA (distance / height / move / speed), its SUBJECT SLOT (creature / town / threat /
// narrator / neighbour / crowd / prop / place), what is in frame for SCALE, its ACTION slot and cause -> effect links.
// PATTERNS ONLY: the draft holds enums and numbers; no description text, transcript words, names or frame paths are
// copied (lib/recipes/schema.js validateRecipe refuses free text in slots). The drafts are hand-tuned into
// scripts/blockyWorlds/engine/lib/recipes/data/<id>.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { segmentBeats, ANALYSIS_DIR } from "./story.mjs";
import { CATEGORY_ROLE } from "../engine/lib/storyPatterns.js";
import { BEATS, RECIPE_VERSION, validateRecipe } from "../engine/lib/recipes/schema.js";

const r2 = (x) => Math.round(x * 100) / 100;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const mode = (a) => { const m = {}; for (const x of a) if (x != null) m[x] = (m[x] ?? 0) + 1; return Object.entries(m).sort((p, q) => q[1] - p[1])[0]?.[0] ?? null; };

const MOVE = { tilt: "tilt_up", track: "track", pull_out: "pull_out", push_in: "push_in", orbit: "orbit", static: "static", roll: "orbit", pan: "pan", shake: "shake", mixed: "push_in", unknown: "static" };
const DIST = new Set(["extreme_wide", "wide", "medium", "close", "extreme_close"]);
const HEIGHT = new Set(["aerial", "high", "eye_level", "ground_low"]);
const THREAT_CAT = new Set(["threat_arrives", "attack", "chase_or_escape", "destruction", "defence_or_weapon", "chain_or_tether"]);
const KID = /\b(kid|child|boy|girl|narrator|teen)\b/i;
const NEIGHBOUR = /\b(mom|mum|mother|dad|father|parent|grandma|grandpa|grandmother|grandfather|elder|old (man|woman)|neighbou?r|villager|shopkeeper|baker|farmer|teacher|doctor|man|woman|lady|guard|king|queen|mayor)\b/i;
const CROWD = /\b(crowd|townsfolk|villagers|citizens|people|soldiers|army|knights|kids|children|families|residents)\b/i;
const SCALE = [["person", /\b(person|kid|child|man|woman|figure|character|people|villager|human)s?\b/i], ["houses", /\b(house|houses|building|buildings|roof|roofs|homes)\b/i],
  ["trees", /\b(tree|trees|forest)\b/i], ["town", /\b(town|city|village)\b/i], ["crowd", /\b(crowd|army|soldiers|townsfolk)\b/i], ["creature", /\b(creature|giant|turtle|wolf|beast|monster|animal)\b/i]];

/** the move's speed from shots.json (intensity, else speed in % of frame width per second) */
function speedOf(mv) {
  const i = String(mv?.intensity ?? "");
  if (/fast|whip/.test(i)) return "fast";
  if (/slow|subtle|still/.test(i)) return "slow";
  if (Number.isFinite(mv?.speed)) return mv.speed > 25 ? "fast" : mv.speed < 8 ? "slow" : "medium";
  return "medium";
}

/** one described shot -> the slot's subject */
export function subjectOf(d, role) {
  const text = `${d.subject ?? ""} ${d.action ?? ""}`;
  const who = d.who;
  if (who === "object_only") return "prop";
  if (who === "town_or_place_only") return (d.distance === "extreme_wide" || d.height === "aerial" || d.height === "high") ? "town" : "place";
  if (who === "creature_only") return THREAT_CAT.has(d.libraryCategory) || role === "threat" ? "threat" : "creature";
  if (who === "people_and_creature") return THREAT_CAT.has(d.libraryCategory) ? "threat" : "creature";
  if (who === "people_only") {
    if (CROWD.test(text) && !KID.test(String(d.subject ?? "").split(/\s+/).slice(0, 3).join(" "))) return "crowd";
    if (KID.test(text)) return "narrator";
    if (NEIGHBOUR.test(text)) return "neighbour";
    return "narrator";
  }
  return "line";
}

function actionOf(d, role) {
  const e = String(d.emotion ?? "").toLowerCase();
  if (role === "reaction") return /scar|fear|dread|panic|terr|tense|shock|alarm|horr/.test(e) ? "reacts_scared" : /surpris|amaz|awe|wonder|curious/.test(e) ? "reacts_surprised" : /happy|joy|relie|proud|warm|cheer/.test(e) ? "reacts_happy" : "reacts_surprised";
  if (d.libraryCategory === "giant_walk") return "walks";
  if (d.libraryCategory === "attack") return "attacks";
  if (d.libraryCategory === "chase_or_escape") return "runs";
  return "line";
}

/** one video's analysis -> a DRAFT recipe (pure: the parsed files in, the recipe out) */
export function draftRecipe({ id, storyType, sh, desc, name = null, what = null }) {
  const shots = sh?.shots ?? [], lines = sh?.lines ?? [], D = sh?.duration ?? shots.at(-1)?.t1 ?? 0;
  const beats = segmentBeats(lines, D);
  const lineBeat = new Map();
  for (const b of beats) for (let i = b.from; i < b.to; i++) lineBeat.set(lines[i].n ?? i + 1, b.beat);
  const DS = desc?.shots ?? {};
  const rows = shots.filter((s) => s.dur >= 0.25).map((s) => {
    const n = (s.lines ?? [])[0];
    const mid = (s.t0 + s.t1) / 2;
    const beat = (n != null && lineBeat.get(n)) || beats.find((b) => mid >= b.t0 - 1e-6 && mid < b.t1 + 1e-6)?.beat || beats.at(-1)?.beat;
    return { s, beat, d: DS[s.n] ?? DS[String(s.n)] ?? null };
  });
  const out = {
    version: RECIPE_VERSION, id: storyType, storyType, name: name ?? storyType.replace(/_/g, " "), what: what ?? "",
    source: { video: String(id), shots: shots.length, duration: r2(D), note: "internal only: camera + structure; never the story, characters, names or footage" },
    aliases: [],
    pace: { targetShot: r2(median(rows.map((r) => r.s.dur)) ?? 1.1), minShot: 0.8, maxShot: 2.2, maxPerLine: 4 },
    beats: {},
    stats: {},
  };
  for (const b of BEATS) {
    const own = rows.filter((r) => r.beat === b);
    const bInfo = beats.find((x) => x.beat === b);
    const sec = own.reduce((a, r) => a + r.s.dur, 0) || 1;
    const slots = own.map((r, k) => {
      const d = r.d ?? {};
      let role = (d.funnyBeat ? "humour" : CATEGORY_ROLE[d.libraryCategory]) ?? "other";
      const subject = r.d ? subjectOf(d, role) : "line";
      let move = MOVE[d.cameraMove] ?? MOVE[r.s.move?.family] ?? "static";
      const height = HEIGHT.has(d.height) ? d.height : "eye_level";
      const distance = DIST.has(d.distance) ? d.distance : "medium";
      if (move === "track" && (height === "aerial" || height === "high") && (subject === "town" || subject === "creature")) move = "flyover";
      if (move === "tilt_up" && subject === "narrator") move = "push_in";
      const scale = SCALE.filter(([, re]) => re.test(String(d.scaleCues ?? ""))).map(([k]) => k).filter((k) => k !== subject).slice(0, 2);
      const next = own[k + 1]?.d;
      const nextRole = next ? (next.funnyBeat ? "humour" : CATEGORY_ROLE[next.libraryCategory]) : null;
      const slot = {
        role, share: r2(r.s.dur / sec),
        cam: { distance, height, move, speed: speedOf(r.s.move) },
        subject, ...(scale.length ? { scale } : {}), action: actionOf(d, role),
        cutOn: r.s.cut?.lineStart ? "line" : "word",
        ...(d.causeEffect && ["consequence", "reaction", "aftermath", "cause"].includes(nextRole) ? { causes: true } : {}),
      };
      return slot;
    });
    const night = own.filter((r) => ["night", "dusk"].includes(r.d?.timeOfDay)).length / Math.max(1, own.length);
    const nLines = bInfo ? bInfo.to - bInfo.from : 0;
    out.beats[b] = { mode: "flow", targetShot: r2(Math.min(4, Math.max(0.5, median(own.map((r) => r.s.dur)) ?? out.pace.targetShot))), light: night >= 0.6 ? "night" : "keep", slots: slots.length ? slots : [{ role: "establish", share: 1, cam: { distance: "wide", height: "eye_level", move: "push_in", speed: "slow" }, subject: "line", action: "line", cutOn: "line" }] };
    out.stats[b] = { shots: own.length, lines: nLines, sec: r2(sec), shotsPerLine: nLines ? r2(own.length / nLines) : null, medianShot: out.beats[b].targetShot, moves: mode(slots.map((s) => s.cam.move)), subjects: mode(slots.map((s) => s.subject)), night: r2(night) };
  }
  return out;
}

export function loadAnalysis(id, dir = ANALYSIS_DIR) {
  const j = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, String(id), f), "utf8")); } catch { return null; } };
  return { sh: j("shots.json"), desc: j("descriptions.json") };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const [id, storyType] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!id || !storyType) { console.error("usage: recipeFromVideo.mjs <videoId> <storyType> [--out file] [--print]"); process.exit(2); }
  const { sh, desc } = loadAnalysis(id);
  if (!sh) { console.error(`no shots.json for ${id}`); process.exit(1); }
  const r = draftRecipe({ id, storyType, sh, desc });
  const probs = validateRecipe(r);
  const oi = process.argv.indexOf("--out");
  if (oi > 0) { fs.mkdirSync(path.dirname(process.argv[oi + 1]), { recursive: true }); fs.writeFileSync(process.argv[oi + 1], JSON.stringify(r, null, 1)); }
  console.log(`${storyType} <- ${id}: ${sh.shots.length} shots, ${r.source.duration} s, median ${r.pace.targetShot} s; problems: ${probs.length ? probs.join("; ") : "none"}`);
  for (const b of BEATS) console.log(`  ${b.padEnd(9)} ${JSON.stringify(r.stats[b])}`);
  if (process.argv.includes("--print")) console.log(JSON.stringify(r.beats, null, 0));
}
