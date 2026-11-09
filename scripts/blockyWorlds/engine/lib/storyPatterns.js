// Blocky Worlds STORY PATTERNS (STORY-PATTERNS agent, 2026-11-07): the whole-video layer on top of the single-shot
// style rules (lib/style.js). How the reference videos of our format establish their world, return to a wide of the
// creature / town, turn each story beat into a short sequence of shots, move light / pace / distance across the story,
// and introduce and bring back their characters. PATTERNS ONLY: lib/data/storyPatterns.json holds abstract rules and
// numbers (generic roles like "narrator kid", "giant creature"), never a reference video's story, names or characters.
//   The data file is built by scripts/blockyWorlds/shotlib/story.mjs: a placeholder from the free stats first, the
//   per-video story analyses + one synthesis (paid, guarded, owner's go) later.
//
//   loadStoryPatterns()                -> the patterns object (the data file, else DEFAULT_PATTERNS)
//   storyPatternsForPrompt(patterns?)  -> a compact STORY PATTERNS block for the director's system prompt
//   storyReport(tl, patterns?)         -> { metrics, score, problems: [{ rule, msg, shots? }] }   ADVISORY (never fails a run)
//   roleOfShot(shot) / distanceOfShot(shot)   our timeline shot -> the shared sequence role / distance index
// Shared vocab (story.mjs uses the same lists): BEATS, SEQ_ROLES, CATEGORY_ROLE, DISTANCE_INDEX.
// Node only (reads the data file with fs; lib/style.js stays browser-pure).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** the seven parts of the protocol (supabase/functions/_shared/blockyWorlds/script.js PARTS; keep in step) and their word share */
export const BEATS = Object.freeze(["rule", "tour", "me", "until", "discovery", "climax", "closer"]);
export const BEAT_SHARES = Object.freeze({ rule: 0.03, tour: 0.17, me: 0.13, until: 0.22, discovery: 0.15, climax: 0.22, closer: 0.08 });

/** what a shot DOES in a sequence (reference shots and our shots map onto the same list) */
export const SEQ_ROLES = Object.freeze(["establish", "explain", "reveal", "creature", "scale", "life", "character", "reaction", "humour", "threat", "cause", "consequence", "chase", "mood", "aftermath", "ending", "transition", "other"]);
/** shotlib/describe.mjs libraryCategory -> role */
export const CATEGORY_ROLE = Object.freeze({
  establishing: "establish", world_rule_explainer: "explain", giant_reveal: "reveal", giant_walk: "creature", giant_action: "cause",
  scale_comparison: "scale", town_life: "life", people_reaction: "reaction", kid_or_family_moment: "character", funny_beat: "humour",
  threat_arrives: "threat", attack: "cause", chain_or_tether: "cause", defence_or_weapon: "cause", destruction: "consequence",
  town_shakes: "consequence", chase_or_escape: "chase", night_scene: "mood", aftermath: "aftermath", twist_or_ending: "ending",
  transition: "transition", other: "other",
});
/** describe.mjs distance -> 0 (farthest) .. 4 (closest) */
export const DISTANCE_INDEX = Object.freeze({ extreme_wide: 0, wide: 1, medium: 2, close: 3, extreme_close: 4 });
/** our cameras -> the same distance index (insert = a card: no distance) */
const CAMERA_DISTANCE = Object.freeze({ aerial: 0, establish: 0, behind_army: 1, wide: 1, duel: 1, track: 2, medium: 2, over_shoulder: 2, low: 3, hero_low: 3, giant_close: 3, closeup: 3 });
const WIDE_CAMERAS = new Set(["aerial", "establish", "behind_army", "wide"]);

/**
 * Used when the data file is missing or unreadable: the turtle target study's numbers (docs/blocky-worlds-protocol.md
 * section 8) and the protocol's beat shapes. The real file replaces every field it has.
 */
export const DEFAULT_PATTERNS = Object.freeze({
  version: 1, source: "defaults (no data file)", videos: 0,
  patternsOnly: "abstract patterns only: never a reference video's story, names, characters or exact shots",
  // measured numbers come only from the data file (storyReport falls back to: world wide within 3 shots, a wide every <= 12 s)
  measured: {},
  patterns: {
    worldEstablishing: { rule: "Open on the world itself: a wide or aerial of the creature / town in the first 1-3 shots, then a closer detail that proves the rule.", firstShots: ["establish", "scale", "explain"], support: 0 },
    recurringWide: { rule: "Come back to a wide of the creature or the town every 8-12 s so the viewer never forgets where the story stands.", everySecMax: 12, support: 0 },
    beatTemplates: [
      { beat: "tour", sequence: ["establish", "life", "humour"], rule: "World tour: place wide, then people living by the rule, then a funny example.", support: 0 },
      { beat: "until", sequence: ["threat", "reveal", "reaction"], rule: "Until one night: the threat far and small, its reveal, then a reaction.", support: 0 },
      { beat: "climax", sequence: ["cause", "consequence", "reaction"], rule: "Climax: the action, what it causes, who reacts.", support: 0 },
    ],
    miniSequences: [
      { sequence: ["reveal", "reaction", "consequence"], rule: "Show the thing, show who sees it, show what it changes.", support: 0 },
      { sequence: ["cause", "consequence", "reaction"], rule: "Every hit is followed by its result and a reaction.", support: 0 },
    ],
    arc: [],
    characters: [{ rule: "The narrator is on screen in 1-2 lines of the me part, then returns doing something at the crisis and the climax.", support: 0 }],
    continuity: [{ rule: "One world: the same town, buildings and creature in every shot; recurring places come back from the same side.", support: 0 }],
  },
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STORY_PATTERNS_FILE = path.join(HERE, "data", "storyPatterns.json");

let cached = null;
/** the patterns (cached); a broken / missing file gives DEFAULT_PATTERNS, never throws */
export function loadStoryPatterns({ file = STORY_PATTERNS_FILE, fresh = false } = {}) {
  if (cached && !fresh && file === STORY_PATTERNS_FILE) return cached;
  let p = DEFAULT_PATTERNS;
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    if (j && typeof j === "object" && j.patterns) p = { ...DEFAULT_PATTERNS, ...j, measured: { ...(j.measured ?? {}) }, patterns: { ...DEFAULT_PATTERNS.patterns, ...j.patterns } };
  } catch { /* keep the defaults */ }
  if (file === STORY_PATTERNS_FILE) cached = p;
  return p;
}

const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : "?");
const range = (q, f = (x) => x) => (q && Number.isFinite(q.p25) && Number.isFinite(q.p75) ? `${f(q.p25)}-${f(q.p75)}` : null);

/** the compact STORY PATTERNS block for the director's system prompt (whole-video planning; ~300-700 tokens) */
export function storyPatternsForPrompt(patterns = loadStoryPatterns()) {
  const P = patterns?.patterns ?? {}, M = patterns?.measured ?? {};
  const out = [`STORY PATTERNS (plan the WHOLE video, not only line by line; learned as abstract patterns from ${patterns?.videos || "reference"} videos of this format; never copy their stories, names or characters)`];
  if (P.worldEstablishing?.rule) out.push(`- Establish the world: ${P.worldEstablishing.rule}`);
  if (P.recurringWide?.rule) out.push(`- Recurring wide: ${P.recurringWide.rule}${M.wideGapSec?.p50 ? ` (reference: a wide every ~${r1(M.wideGapSec.p50)} s, rarely more than ${r1(M.wideGapSec.p90 ?? M.wideGapSec.p75)} s apart)` : ""}`);
  const bt = (P.beatTemplates ?? []).slice(0, 9);
  if (bt.length) out.push("- Beat -> shot sequence:", ...bt.map((t) => `  ${t.beat}: ${(t.sequence ?? []).join(" > ")}${t.rule ? ` (${t.rule})` : ""}`));
  const ms = (P.miniSequences ?? []).slice(0, 5);
  if (ms.length) out.push(`- Mini-sequences: ${ms.map((m) => `${(m.sequence ?? []).join(" > ")}${m.rule ? ` = ${m.rule}` : ""}`).join("; ")}`);
  const arc = (P.arc ?? []).slice(0, 7);
  if (arc.length) out.push("- Arc across the beats:", ...arc.map((a) => `  ${a.beat}: ${[a.timeOfDay, a.pace && `pace ${a.pace}`, a.distance && `camera ${a.distance}`, a.focus && `focus ${a.focus}`].filter(Boolean).join(", ")}${a.rule ? ` (${a.rule})` : ""}`));
  const pb = M.perBeat ?? {};
  const pace = BEATS.filter((b) => pb[b]?.meanShot?.p50).map((b) => `${b} ${r1(pb[b].meanShot.p50)} s`);
  if (pace.length) out.push(`- Measured mean shot length per beat: ${pace.join(", ")}.`);
  const cs = BEATS.filter((b) => pb[b]?.creatureShare && Number.isFinite(pb[b].creatureShare.p50)).map((b) => `${b} ${pct(pb[b].creatureShare.p50)}`);
  if (cs.length) out.push(`- Creature on screen per beat (share of shots): ${cs.join(", ")}.`);
  for (const c of (P.characters ?? []).slice(0, 4)) out.push(`- Characters: ${c.rule}`);
  for (const c of (P.continuity ?? []).slice(0, 4)) out.push(`- Continuity: ${c.rule}`);
  out.push("Use these through the lines' camera (reveal / scale / action / shake) and light choices and through who is on screen; the engine checks the plan against them (advisory).");
  return out.join("\n");
}

// ------------------------------------------------------------------------------------------------ our shots -> roles
const isCard = (s) => s?.camera === "insert" || !!s?.insert;
const isCreatureSet = (s) => /^creature:/.test(s?.set ?? "");
const dur = (s) => Math.max(0, (s?.end ?? 0) - (s?.start ?? 0));
const showsGiant = (s) => !isCard(s) && ((s.giants ?? []).length > 0 || /^(giant:|world$)/.test(s.focus ?? "") || (isCreatureSet(s) && ["establish", "aerial", "giant_close", "hero_low", "duel"].includes(s.camera)));
const CAUSE_BEATS = new Set(["attack", "charge", "stomp", "roar", "march"]);
const CONSEQ_BEATS = new Set(["impact", "fall"]);
const CHASE_BEATS = new Set(["chase", "flee", "swim_away"]);
const REACT_POSES = /scared|look_up|cheer|gasp|point|shock|cry|wave|jump|hug/;

/** distance index of our shot (0 farthest .. 4 closest; null for a card) */
export const distanceOfShot = (s) => (isCard(s) ? null : CAMERA_DISTANCE[s?.camera] ?? 2);
/** is this an anchor wide: a far view of the creature / the town (the "recurring wide") */
// (a hero insert framed "wide" is the object alone, never the world's wide: lib/shotGrammar.js)
export const isAnchorWide = (s) => !isCard(s) && !s?.hero && WIDE_CAMERAS.has(s?.camera);

/** what our shot does in a sequence (same SEQ_ROLES as the reference descriptions) */
export function roleOfShot(s, i = 1) {
  if (!s) return "other";
  if (isCard(s)) return "explain";
  // VISUAL-FIX 2026-11-08: a shot the story-shape pass directed as a role (lib/shotFlow.js) is that role
  if (s.seq && SEQ_ROLES.includes(s.seq)) return s.seq;
  const bt = s.beat?.type;
  if ((s.tethers ?? []).some((t) => ["snap", "fire"].includes(t.state)) || (s.siege ?? []).length || CAUSE_BEATS.has(bt) || (s.giants ?? []).some((g) => /attack|bite|stomp|charge|fire|lunge|headbutt|grab/.test(g.action ?? ""))) return "cause";
  if (CONSEQ_BEATS.has(bt) || s.shake) return "consequence";
  if (CHASE_BEATS.has(bt)) return "chase";
  if (bt === "cheer") return "reaction";
  const ms = s.monsterState?.state;
  if (ms === "reveal") return "reveal";
  if (ms === "lurk" || ms === "reach") return "threat";
  if (ms === "flee") return "aftermath";
  // a far view is the world (establish) unless a giant visibly does something in it (the creature walking / acting)
  if (isAnchorWide(s)) return i > 0 && (s.giants ?? []).some((g) => g.action && g.action !== "idle") ? "creature" : "establish";
  if ((s.actors ?? []).some((a) => REACT_POSES.test(a.pose ?? ""))) return "reaction";
  if (["giant_close", "hero_low", "duel", "track"].includes(s.camera) && showsGiant(s)) return "creature";
  if (s.camera === "closeup" && (s.actors ?? []).length) return "character";
  if ((s.actors ?? []).length || (s.crowds ?? []).length) return "life";
  return "other";
}

/**
 * Roles of a whole timeline: roleOfShot, plus the reveal ladder of a rival giant / monster (any giant but the world
 * creature): its first appearance is the threat when far (a wide) or the reveal when close; the first closer shot after
 * a far threat is the reveal.
 */
export function rolesOf(shots) {
  const roles = shots.map((s, i) => roleOfShot(s, i)), seen = new Map();
  const soft = new Set(["establish", "creature", "life", "other"]);
  shots.forEach((s, i) => {
    if (isCard(s)) return;
    for (const g of s.giants ?? []) {
      if (!g?.id || g.id === "world") continue;
      const prev = seen.get(g.id), far = isAnchorWide(s);
      if (!prev) { seen.set(g.id, far ? "threat" : "reveal"); if (soft.has(roles[i])) roles[i] = far ? "threat" : "reveal"; }
      else if (prev === "threat" && !far) { seen.set(g.id, "reveal"); if (soft.has(roles[i])) roles[i] = "reveal"; }
    }
  });
  return roles;
}

// ------------------------------------------------------------------------------------------------ the plan check
const has = (arr, sub) => {   // sub is an ordered subsequence of arr (gaps allowed, at most 2 other shots between)
  let j = 0, gap = 0;
  for (const x of arr) { if (x === sub[j]) { j++; gap = 0; if (j === sub.length) return true; } else if (j > 0 && ++gap > 2) { j = x === sub[0] ? 1 : 0; gap = 0; } }
  return false;
};

/**
 * Scores a planned timeline against the story patterns. ADVISORY: planVideo stores it as tl.story; it never changes the
 * plan or fails a run. Rules: S1 world established early, S2 recurring wide, S3 beat sequences present, S4 arc in range
 * (pace + creature share per beat), S5 characters (narrator intro + return, side characters introduced recognisably).
 */
export function storyReport(tl, patterns = loadStoryPatterns()) {
  const shots = (tl?.shots ?? []).filter(Boolean), problems = [], checks = [];
  const P = patterns?.patterns ?? {}, M = patterns?.measured ?? {};
  const T = Math.max(1e-6, tl?.duration ?? shots.at(-1)?.end ?? 0);
  const ok = (rule, pass, msg, extra = {}) => { checks.push({ rule, pass }); if (!pass) problems.push({ rule, msg, ...extra }); };
  const roles = rolesOf(shots);
  const metrics = { shots: shots.length, roles: Object.fromEntries(SEQ_ROLES.map((r) => [r, roles.filter((x) => x === r).length]).filter(([, n]) => n)) };
  if (!shots.length) return { metrics, score: null, problems };

  // S1 the world is established in the first shots (a far view of the creature / town)
  const firstWide = shots.findIndex(isAnchorWide);
  const maxShots = Math.max(1, Math.ceil(M.establish?.shotsToWide?.p75 ?? 3));
  metrics.firstWideShot = firstWide < 0 ? null : firstWide + 1;
  ok("S1 world established", firstWide >= 0 && firstWide < maxShots, firstWide < 0 ? "no wide / aerial of the world anywhere" : `the first wide of the world is shot ${firstWide + 1} (reference: within the first ${maxShots})`, firstWide >= 0 ? { shots: [firstWide] } : {});

  // S2 a wide of the creature / town comes back regularly
  const wides = shots.map((s, i) => [s, i]).filter(([s]) => isAnchorWide(s));
  const maxGap = Math.max(6, P.recurringWide?.everySecMax ?? M.wideGapSec?.p90 ?? M.wideGapSec?.p75 ?? 12);
  const marks = [0, ...wides.map(([s]) => s.start), T];
  let worst = 0, worstAt = null;
  for (let k = 1; k < marks.length; k++) { const g = marks[k] - marks[k - 1]; if (g > worst) { worst = g; worstAt = marks[k - 1]; } }
  metrics.wides = wides.length; metrics.maxWideGapSec = r1(worst);
  ok("S2 recurring wide", worst <= maxGap + 1e-6, `${r1(worst)} s without a wide of the creature / town (from ${r1(worstAt)} s; reference: every <= ${r1(maxGap)} s)`);

  // S3 each beat's template sequence (or any mini-sequence) appears in that beat's shots
  const byBeat = Object.fromEntries(BEATS.map((b) => [b, shots.map((s, i) => [s, i]).filter(([s]) => s.part === b)]));
  const seqHits = {};
  for (const t of P.beatTemplates ?? []) {
    const own = byBeat[t.beat] ?? [];
    if (own.length < 2 || !(t.sequence ?? []).length) continue;
    const r = own.map(([, i]) => roles[i]);
    // the template's core: its first two roles in order (the full template is a target, not a must)
    const core = t.sequence.slice(0, Math.min(2, t.sequence.length));
    const hit = has(r, t.sequence) ? "full" : has(r, core) ? "core" : null;
    seqHits[t.beat] = hit ?? "none";
    ok("S3 beat sequence", !!hit, `${t.beat}: no ${core.join(" > ")} (template ${t.sequence.join(" > ")}; ours ${r.join(" ")})`, { shots: own.map(([, i]) => i) });
  }
  metrics.beatSequences = seqHits;
  const mini = (P.miniSequences ?? []).filter((m) => (m.sequence ?? []).length >= 2);
  if (mini.length) {
    const found = mini.filter((m) => has(roles, m.sequence)).length;
    metrics.miniSequences = `${found}/${mini.length}`;
    ok("S3 mini-sequences", found >= Math.min(2, mini.length), `${found} of ${mini.length} mini-sequences in the whole video (e.g. ${mini[0].sequence.join(" > ")})`);
  }

  // S4 the arc: pace and creature share per beat within the reference range (p10-p90 when known, else p25-p75 widened)
  const pb = M.perBeat ?? {}, creatureStory = shots.some(isCreatureSet) || shots.some((s) => (s.giants ?? []).length);
  const arc = {};
  for (const b of BEATS) {
    const own = byBeat[b];
    if (!own?.length || !pb[b]) continue;
    const real = own.filter(([s]) => !isCard(s));
    const meanShot = own.reduce((a, [s]) => a + dur(s), 0) / own.length;
    const cShare = real.length ? real.filter(([s]) => showsGiant(s)).length / real.length : 0;
    arc[b] = { meanShot: r1(meanShot), creatureShare: +cShare.toFixed(2) };
    const q = pb[b].meanShot;
    if (q && Number.isFinite(q.p75)) {
      const hi = Number.isFinite(q.p90) ? q.p90 : q.p75 * 1.3;
      ok("S4 arc pace", meanShot <= hi + 0.05 || own.length < 2, `${b}: mean shot ${r1(meanShot)} s (reference ${range(q, r1) ?? "?"} s, at most ~${r1(hi)} s)`, { shots: own.map(([, i]) => i) });
    }
    const c = pb[b].creatureShare;
    if (creatureStory && c && Number.isFinite(c.p25) && real.length >= 2) {
      const lo = Number.isFinite(c.p10) ? c.p10 : c.p25 * 0.7;
      ok("S4 arc creature", cShare >= lo - 1e-6, `${b}: the creature is in ${pct(cShare)} of the shots (reference ${range(c, pct) ?? "?"})`, { shots: real.map(([, i]) => i) });
    }
  }
  metrics.arc = arc;

  // S5 characters: the narrator is introduced on screen (me part, or early) and comes back later; every side character
  // is introduced with a medium / close shot (recognisable) before it is only a dot in a wide
  const appear = new Map();
  shots.forEach((s, i) => { if (isCard(s)) return; for (const a of s.actors ?? []) { if (!a?.id) continue; if (!appear.has(a.id)) appear.set(a.id, []); appear.get(a.id).push(i); } });
  const me = appear.get("me") ?? [];
  if (byBeat.me?.length) {
    const inMe = me.filter((i) => shots[i].part === "me").length;
    const later = me.filter((i) => ["until", "discovery", "climax", "closer"].includes(shots[i].part)).length;
    metrics.narrator = { shots: me.length, inMe, later };
    ok("S5 narrator intro", inMe >= 1, "the narrator is never on screen in the me part");
    ok("S5 narrator returns", later >= 1, "the narrator does not come back on screen after the me part");
  }
  const side = [...appear.entries()].filter(([id, list]) => id !== "me" && list.length >= 1);
  const flat = side.filter(([, list]) => (distanceOfShot(shots[list[0]]) ?? 2) < 2).map(([id]) => id);
  metrics.sideCharacters = side.length;
  if (side.length) ok("S5 character intro", !flat.length, `introduced only in a wide (not recognisable): ${flat.join(", ")}`);

  const passed = checks.filter((c) => c.pass).length;
  return { metrics, score: checks.length ? +(passed / checks.length).toFixed(2) : null, problems, source: patterns?.source ?? null };
}
