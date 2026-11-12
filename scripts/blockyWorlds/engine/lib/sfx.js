// Blocky Worlds SFX placement (SOUND agent). Pure and deterministic (no I/O, no randomness): the same timeline always
// gives the same cues. Works in Node and in the browser.
//
//   sfxCues(timeline) -> [{ t, at, name, gainDb, why, dur? }]
//     t: when the file starts (s); at: the sound's moment (a riser's end, a sneeze's "CHOO"); dur: only for loops
//     (footsteps): how long to play. gainDb: relative to the voice's level (0 = as loud as the narrator).
//
// The rules (from the references: SOME sound effects, not a lot):
//  - only key moments: sound words in the captions (scream, sneeze/achoo, boom, bang, crash, knock, creak, pop,
//    slam, thunder, growl/roar, cheer; whistle only when it is blown), actions in the shots (sneeze pose, blow +
//    whistle, run -> footsteps, a crowd yelling -> cheer, windows going dark / flying open), the monster's reveal
//    (a riser that ends on the reveal shot + a stinger on it, then an impact on a later re-reveal), and a whoosh on
//    a few big part changes (until / discovery / climax).
//  - sparse: about 12 per 100 s at most, never two moments within 1.2 s, the same sound at most twice (screams,
//    cheers...) and not twice within 10 s.
//  - never over the narrator's words at full level: a cue is moved into the nearest gap between words when one is
//    close (<= 0.45 s), else it is ducked by 4 dB; impacts / stingers may sit on a word start but at -12 dB.

/** timing of each sound file: dur (s), anchor (s from the file start). Kept equal to audio/sfx.mjs (tested). */
export const SFX_TIMING = {
  whoosh_1: [0.65, 0.4, -2], whoosh_2: [0.94, 0.47, -2], whoosh_3: [0.41, 0.29, -3],
  riser_short: [1.2, 1.2, -12], riser_long: [2.0, 2.0, -12], impact: [1.6, 0, -2], stinger: [2.85, 0, -3],
  thunder: [4.58, 0, -4], scream: [1.48, 0.05, -8], sneeze: [1.47, 0.07, -6], growl: [2.24, 0.15, -6],
  crowd_murmur: [3.6, 0, -10], crowd_cheer: [2.44, 0.2, -7], pop: [0.12, 0, -8], whistle: [1.4, 0, -6],
  knock: [0.53, 0, -4], crash: [0.6, 0, -5], door_creak: [1.51, 0, -5], door_slam: [0.6, 0, -4],
  footsteps_walk: [2.0, 0, -7], footsteps_run: [1.2, 0, -6],
  // the writer's sound words (Kenney CC0, 2026-11-12)
  bonk: [0.33, 0, -6], clunk: [0.31, 0, -6], tap: [0.14, 0, -6], splat: [0.51, 0, -6], snap: [0.19, 0, -6], click: [0.04, 0, -6], ding: [0.12, 0, -6], zap: [0.23, 0, -6], twang: [0.09, 0, -6], scratch: [0.12, 0, -6], plop: [0.11, 0, -6], drip: [0.13, 0, -6],
  // home-made (2026-11-12)
  beep: [0.18, 0, -6], buzz: [0.7, 0, -6], hiss: [0.6, 0, -6], fizz: [0.9, 0, -6], boing: [0.7, 0, -6], squeak: [0.21, 0, -6], poof: [0.55, 0, -6],
};

// EPIC stories (lib/epic.js): giants, armies and beats add their own candidates and sounds (audio/sfxEpic.mjs)
import { epicSfxCandidates, EPIC_SFX_TIMING } from "./epic.js";
const TIMING = { ...SFX_TIMING, ...EPIC_SFX_TIMING };

// sparse on purpose (owner, 2026-11-04: "don't overdo the sound effects"): ~8 per 100 s, every sound once
const MIN_GAP = 1.2, SAME_GAP = 10, MAX_SAME = 1, PER_100S = 8, DUCK = 4, TAIL_DUCK = 3, HIT_ON_WORD = -12, GAP_SNAP = 0.45, MOMENT = 0.28;

// caption sound words -> sound. `needs`: another word that must be within 3 words before (blew/blow for whistle).
const WORDS = [
  { re: /^(scream|screamed|screams|screaming|shriek|shrieked)$/, name: "scream", prio: 6 },
  { re: /^(sneeze|sneezed|sneezes|sneezing|achoo|choo)$/, name: "sneeze", prio: 8 },
  { re: /^(boom|kaboom|bang|banged|thud)$/, name: "impact", prio: 7 },
  { re: /^(crash|crashed|smash|smashed|shattered)$/, name: "crash", prio: 7 },
  { re: /^(knock|knocked|knocking|knocks)$/, name: "knock", prio: 7 },
  { re: /^(creak|creaked|creaking|creaks|creaky)$/, name: "door_creak", prio: 7 },
  { re: /^(slam|slammed|slams)$/, name: "door_slam", prio: 7 },
  { re: /^(pop|popped|pops)$/, name: "pop", prio: 5 },
  { re: /^(thunder|thundered|lightning)$/, name: "thunder", prio: 6 },
  { re: /^(growl|growled|growls|roar|roared|roars|snarl|snarled)$/, name: "growl", prio: 6 },
  { re: /^(cheer|cheered|cheering|cheers)$/, name: "crowd_cheer", prio: 4 },
  { re: /^(whistle|whistled)$/, name: "whistle", prio: 8, needs: /^(blew|blow|blows|blowing|whistled)$/ },
];
const NEGATION = /^(never|no|not|nobody|nothing|without|don't|didn't|can't|couldn't|won't)$/;
const BIG_PARTS = ["until", "discovery", "climax"];
const WHOOSHES = ["whoosh_2", "whoosh_1", "whoosh_3"];

const norm = (w) => String(w ?? "").toLowerCase().replace(/[^a-z']/g, "");
const round = (x) => Math.round(x * 1000) / 1000;

/** speech intervals [start, end] from the captions, merged across tiny gaps (< 0.15 s) */
export function speechSpans(captions = []) {
  const out = [];
  for (const c of captions) {
    if (!(c.end > c.start)) continue;
    const last = out[out.length - 1];
    if (last && c.start - last[1] < 0.15) last[1] = Math.max(last[1], c.end);
    else out.push([c.start, c.end]);
  }
  return out;
}
const overlaps = (spans, a, b) => spans.some(([s, e]) => s < b && e > a);

/** nearest gap start/end to time t where [t, t + need] has no speech; null if none within GAP_SNAP */
function snapToGap(spans, t, need, duration) {
  if (!overlaps(spans, t, t + need)) return t;
  const cands = [];
  for (const [s, e] of spans) { cands.push(e + 0.03); cands.push(s - need - 0.03); }
  let best = null;
  for (const c of cands) {
    if (c < 0 || c + need > duration || Math.abs(c - t) > GAP_SNAP) continue;
    if (overlaps(spans, c, c + need)) continue;
    if (best == null || Math.abs(c - t) < Math.abs(best - t)) best = c;
  }
  return best;
}

/** all candidate moments, before the sparseness rules */
export function sfxCandidates(tl) {
  const shots = tl.shots ?? [], caps = tl.captions ?? [], out = [];
  const shotAt = (t) => shots.find((s) => t >= s.start && t < s.end) ?? null;
  // 1. sound words in the captions
  caps.forEach((c, i) => {
    const w = norm(c.word);
    for (const rule of WORDS) {
      if (!rule.re.test(w)) continue;
      const before = caps.slice(Math.max(0, i - 4), i).map((x) => norm(x.word));
      if (before.some((b) => NEGATION.test(b))) continue;                     // "never heard a cheer"
      if (rule.needs) {
        const shot = shotAt(c.start);
        const blown = before.slice(-3).some((b) => rule.needs.test(b)) || rule.needs.test(w) || shot?.actors?.some((a) => a.pose === "blow");
        if (!blown) continue;
      }
      out.push({ at: c.end + 0.02, name: rule.name, prio: rule.prio, why: `caption "${c.word}" @${c.start.toFixed(2)}`, wordAt: c.start });
    }
  });
  // 2. actions in the shots
  let prevMonster = null, reveals = 0;
  shots.forEach((s, i) => {
    const prev = shots[i - 1];
    const actors = s.actors ?? [];
    const sneezer = actors.find((a) => a.pose === "sneeze");
    if (sneezer) out.push({ at: s.start + 0.35, name: "sneeze", prio: 7, why: `shot ${i}: ${sneezer.id} sneezes` });
    const blower = actors.find((a) => a.pose === "blow" && /whistle/.test(String(a.hold ?? "")));
    if (blower) out.push({ at: s.start + 0.25, name: "whistle", prio: 7, why: `shot ${i}: ${blower.id} blows the whistle` });
    const yellers = actors.filter((a) => a.pose === "yell");
    const prevYellers = (prev?.actors ?? []).filter((a) => a.pose === "yell").length;
    if (yellers.length >= 3 && prevYellers < 3) out.push({ at: s.start + 0.1, name: "crowd_cheer", prio: 5, why: `shot ${i}: ${yellers.length} people yell together` });
    if (actors.some((a) => a.pose === "run") && !(prev?.actors ?? []).some((a) => a.pose === "run")) {
      let j = i; while (j + 1 < shots.length && (shots[j + 1].actors ?? []).some((a) => a.pose === "run")) j++;
      const dur = Math.min(4.5, shots[j].end - s.start);
      if (dur >= 1.2) out.push({ at: s.start, name: "footsteps_run", prio: 4, dur, why: `shots ${i}-${j}: running` });
    }
    const ws = s.setState?.windows ?? null, pws = prev?.setState?.windows ?? null;
    if (ws === "open" && pws !== "open") out.push({ at: s.start + 0.2, name: "crowd_cheer", prio: 4, why: `shot ${i}: windows fly open` });
    // the monster: the first reveal gets riser + stinger, a later fresh reveal an impact
    const ms = s.monsterState?.state ?? null;
    if (ms === "reveal" && prevMonster !== "reveal") {
      reveals++;
      // only the first big reveal gets a hit; later ones stay quiet
      if (reveals === 1) out.push({ at: s.start, name: "stinger", prio: 9, riser: true, why: `shot ${i}: the monster's reveal` });
    }
    // a low growl when the monster comes for someone (it reaches): offered on each such shot, used once (MAX_SAME)
    if (ms === "reach" && BIG_PARTS.includes(s.part)) { out.push({ at: s.start + 0.3, name: "growl", prio: 6, why: `shot ${i}: the monster comes closer` }); }
    prevMonster = ms;
  });
  // 3. a whoosh on the first cut into each big part
  let wi = 0;
  shots.forEach((s, i) => {
    if (i === 0 || s.part === shots[i - 1].part || !BIG_PARTS.includes(s.part)) return;
    if (shots.slice(0, i).some((x) => x.part === s.part)) return;
    out.push({ at: s.start, name: WHOOSHES[wi++ % WHOOSHES.length], prio: 3, why: `part change -> ${s.part}` });
  });
  return out;
}

/** the cues: candidates filtered by the sparseness rules, placed around the words, with gains */
export function sfxCues(tl, opts = {}) {
  const duration = tl.duration ?? Math.max(0, ...(tl.shots ?? []).map((s) => s.end));
  const spans = speechSpans(tl.captions ?? []);
  const cap = opts.max ?? Math.max(3, Math.round((duration / 100) * PER_100S));
  const cands = [...sfxCandidates(tl), ...epicSfxCandidates(tl)]
    .filter((c) => c.at >= 0.3 && c.at < duration - 0.3)
    .sort((a, b) => b.prio - a.prio || a.at - b.at || a.name.localeCompare(b.name));
  const taken = [];
  const free = (at) => !taken.some((x) => Math.abs(x.at - at) < MIN_GAP);
  for (const c of cands) {
    if (taken.length >= cap) break;
    const [dur, anchor, baseDb] = TIMING[c.name];
    const same = taken.filter((x) => x.name === c.name);
    if (same.length >= MAX_SAME || same.some((x) => Math.abs(x.at - c.at) < SAME_GAP)) continue;
    if (c.name.startsWith("whoosh") && taken.some((x) => x.name.startsWith("whoosh") && Math.abs(x.at - c.at) < 5)) continue;
    let at = c.at, gainDb = baseDb + (c.gainAdj ?? 0), how = "";
    const isHit = c.name === "impact" || c.name === "stinger" || c.name === "impact_big" || c.name === "giant_stomp" || c.name === "giant_thud";
    const sync = isHit || c.name.startsWith("whoosh") || c.name.startsWith("footsteps") || c.name === "army_march" || c.name === "giant_steps" || c.riser;
    const active = Math.min(0.7, dur - anchor);
    if (isHit) {
      if (overlaps(spans, at - 0.05, at + 0.35)) { gainDb = Math.min(gainDb, HIT_ON_WORD); how = "on a word, -12 dB"; }
    } else if (c.name.startsWith("footsteps") || c.dur) {
      if (overlaps(spans, at, at + (c.dur ?? dur))) { gainDb -= DUCK; how = "under the words"; }
    } else {
      // the sound's moment (its first ~0.3 s from the anchor) should land between words
      const snapped = sync ? null : snapToGap(spans, at - 0.03, MOMENT, duration);
      if (snapped != null) {
        if (Math.abs(snapped + 0.03 - at) > 0.005) how = "moved into a gap";
        at = snapped + 0.03;
        if (overlaps(spans, at + MOMENT, at + active)) { gainDb -= TAIL_DUCK; how = (how ? how + ", " : "") + "tail under the words"; }
      } else if (overlaps(spans, at - 0.03, at + MOMENT)) { gainDb -= DUCK; how = "ducked under the words"; }
    }
    // spacing: never two moments within 1.2 s; a riser also keeps its own 1.2 s run-up clear
    if (!free(at)) continue;
    if (c.riser && taken.some((x) => x.at > at - SFX_TIMING.riser_short[0] - 0.3 && x.at < at)) continue;
    const cue = { t: round(Math.max(0, at - anchor)), at: round(at), name: c.name, gainDb, why: c.why + (how ? ` (${how})` : "") };
    if (c.dur) cue.dur = round(c.dur);
    taken.push(cue);
    if (c.riser) taken.push({ t: round(at - SFX_TIMING.riser_short[1]), at: round(at), name: "riser_short", gainDb: SFX_TIMING.riser_short[2], why: `run-up to: ${c.why}`, riserOf: c.name });
  }
  return taken.sort((a, b) => a.t - b.t || a.name.localeCompare(b.name)).map(({ riserOf, ...c }) => c);
}
