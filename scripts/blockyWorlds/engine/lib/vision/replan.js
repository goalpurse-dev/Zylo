// Blocky Worlds shot review: from the judge's misses to re-plan fixes in the PLANNER's vocabulary, a default patcher
// that applies them to the timeline (each shot's change re-checked; a change that adds a check problem is undone), and
// the permanent-rule fallback after the last round (a missing thing -> a picture card of that very thing). Pure.
//   suggestFixes(verdict, req, tl) -> [fix]
//   applyFixes(tl, fixes, { check }) -> { applied, reverted, unapplied, changedShots }      (tl is changed in place)
//   finalFallback(tl, verdicts, reqs, { check, maxCards }) -> { cards, unresolved, changedShots }
// fix = { op, shot, reason, ...params }; ops:
//   castFix     { id, look? }          the line's subject in focus (added at center if absent); look: the hint the cast
//                                       needs (age / gender) -- not applied here: the cast's look is the planner's
//   focusFix    { focus, camera? }     frame the subject closer (subject_hidden)
//   actionPose  { actor, pose }        the line's verb as a pose (plan.mjs POSES)
//   crowdAction { index, action }      a crowd performs the verb (lib/epic.js CROWD_ACTIONS)
//   exprFix     { actor, expr }        the feeling on the face (plan.mjs EXPRS)
//   propHeld    { actor, hold }        a missing hand-sized thing held by the subject (pose carry unless it has one)
//   needObject  { name }               a missing thing stands in the shot (kit name, or the noun: the builder's safety
//                                       net turns an object the kit lacks into a need: kit -> library -> builder -> card)
//   needCrowd   { kind, count, action } a missing army / crowd
//   setOverride { set }                the story's place (the set the line's world uses elsewhere in the video)
//   timeOfDay   { light }              day / night / warm from the story clock
//   replaceCard { name }               a picture card where the thing itself was needed (the builder's need, if any)
import { heldKind, objectForNoun, iconFor } from "../visuals.js";
import { cardLabel } from "../planText.js";

export const FIX_OPS = Object.freeze(["castFix", "focusFix", "actionPose", "crowdAction", "exprFix", "propHeld", "needObject", "needCrowd", "setOverride", "timeOfDay", "replaceCard"]);
const POSES = new Set(["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer", "yell", "sneeze", "blow", "hug", "climb", "push", "eat", "fall", "jump", "ride", "hide", "throw", "fly", "swim", "build", "dig", "dance", "kick", "fight", "drive"]);
const VERB_POSE = [
  [/^(run|runs|ran|running|chase\w*|flee\w*|fled|rush\w*|race\w*|raced|sprint\w*)$/, "run"], [/^(walk\w*|march\w*|hunt\w*|wander\w*|stroll\w*)$/, "walk"],
  [/^(carr\w*|drag\w*|haul\w*|lift\w*|pull\w*)$/, "carry"], [/^(point\w*)$/, "point"], [/^(wave\w*|waving)$/, "wave"], [/^(cheer\w*)$/, "cheer"],
  [/^(yell\w*|scream\w*|shout\w*)$/, "yell"], [/^(sleep\w*|slept|asleep|yawn\w*|nap\w*)$/, "sleep"], [/^(sit|sits|sat|sitting)$/, "sit"],
  [/^(fall\w*|fell)$/, "fall"], [/^(jump\w*|leap\w*)$/, "jump"], [/^(climb\w*)$/, "climb"], [/^(swim\w*|swam)$/, "swim"], [/^(throw\w*|threw)$/, "throw"],
  [/^(kick\w*)$/, "kick"], [/^(fight\w*|fought|attack\w*|punch\w*)$/, "fight"], [/^(push\w*|pound\w*|bang\w*|knock\w*|shove\w*)$/, "push"],
  [/^(hide\w*|hid|hidden)$/, "hide"], [/^(danc\w*)$/, "dance"], [/^(hug\w*)$/, "hug"], [/^(eat\w*|ate)$/, "eat"], [/^(drive\w*|drove)$/, "drive"],
  [/^(ride\w*|rode)$/, "ride"], [/^(fly|flies|flew|flying)$/, "fly"], [/^(dig\w*|dug)$/, "dig"], [/^(build\w*|built)$/, "build"],
  [/^(shiver\w*|trembl\w*|cower\w*)$/, "scared"], [/^(talk\w*|whisper\w*|said|say\w*|tell\w*|told)$/, "talk"], [/^(look\w*|stare\w*|listen\w*|hear\w*|heard|watch\w*)$/, "look_up"],
];
const CROWD_VERB = [[/^(march\w*|hunt\w*)$/, "march"], [/^(charg\w*|attack\w*|storm\w*)$/, "charge"], [/^(run\w*|ran|rush\w*|chase\w*)$/, "run"], [/^(flee\w*|fled)$/, "flee"], [/^(cheer\w*)$/, "cheer"], [/^(fight\w*|fought)$/, "fight"], [/^(wav\w*)$/, "wave"]];
const EXPR = [[/scared|afraid|fear|terrif|panic|nervous|worried|shiver|trembl|gasp/, "scared"], [/happy|glad|smil|laugh|grin|lucky/, "happy"], [/sad|cry|cried|tears|lonely|left out/, "sad"], [/angry|mad|furious|frown/, "angry"], [/proud|brave/, "smirk"], [/surprised|shock/, "surprised"], [/excited/, "excited"], [/sleepy|yawn/, "sleepy"], [/quiet|silent/, "shush"]];
const CROWD_WORD = /\b(army|armies|soldier|soldiers|troop|troops|knight|knights|crowd|crowds|townsfolk|people|everyone|villagers|mob|guards?)\b/i;
const GENERIC_SETS = new Set(["street", "school", "bedroom", "woods"]);

export const poseForVerb = (w) => { const s = String(w ?? "").toLowerCase(); return VERB_POSE.find(([re]) => re.test(s))?.[1] ?? null; };
export const crowdActionForVerb = (w) => { const s = String(w ?? "").toLowerCase(); return CROWD_VERB.find(([re]) => re.test(s))?.[1] ?? null; };
export const exprForFeeling = (f) => { const s = String(f ?? "").toLowerCase(); return EXPR.find(([re]) => re.test(s))?.[1] ?? null; };
const crowdKindOf = (w) => (/knight/i.test(w) ? "knight" : /army|soldier|troop|guard/i.test(w) ? "soldier" : "townsfolk");

/** the set the story's place uses: the most used set among shots of lines with the same place, a creature / built world first */
export function setForPlace(tl, req, reqs) {
  const lines = new Set((reqs ?? []).filter((r) => r.place && r.place === req.place).map((r) => r.line));
  const count = new Map();
  for (const s of tl.shots ?? []) {
    if (!(s.lines ?? [s.line]).some((l) => lines.has(l)) || s.camera === "insert") continue;
    count.set(s.set, (count.get(s.set) ?? 0) + (GENERIC_SETS.has(s.set) ? 1 : 3));
  }
  // "inside" / "outside" / "on" in the place words pick the creature world's view
  const view = /\binside|\bin a\b|\bin the\b/i.test(req.place ?? "") ? "inside" : /\boutside|\baround\b/i.test(req.place ?? "") ? "outside" : /\bon (top|the back)/i.test(req.place ?? "") ? "on" : null;
  if (view && tl.worlds) for (const [k, w] of Object.entries(tl.worlds)) if (w?.view === view) count.set(`creature:${k}`, (count.get(`creature:${k}`) ?? 0) + 5);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** the shots of a line to fix: the judge's bad shots, else the line's shots; inserts (cards) last */
const targetShots = (v, req, tl) => {
  const list = (v.bad_shots?.length ? v.bad_shots : req.shots ?? []).filter((i) => tl.shots[i]);
  return list.sort((a, b) => (tl.shots[a].camera === "insert") - (tl.shots[b].camera === "insert") || (tl.shots[b].end - tl.shots[b].start) - (tl.shots[a].end - tl.shots[a].start));
};

/** the fixes for one judged line (empty for a match) */
export function suggestFixes(v, req, tl, reqs = null) {
  if (!v || v.verdict === "match" || v.verdict === "unjudged") return [];
  const out = [], shots = targetShots(v, req, tl), main = shots.find((i) => tl.shots[i].camera !== "insert") ?? shots[0];
  if (main == null) return out;
  const who = req.who?.id ?? null, isCast = !!(who && tl.cast?.[who]);
  const types = new Set(v.types ?? []);
  const reason = (t) => `${t}: ${v.fix || v.shows || ""}`.slice(0, 200);
  if (types.has("wrong_character")) {
    if (isCast) out.push({ op: "castFix", shot: main, id: who, ...(req.who?.hint ? { look: req.who.hint } : {}), reason: reason("wrong_character") });
    else if (who && CROWD_WORD.test(req.who?.name ?? "")) out.push({ op: "needCrowd", shot: main, kind: crowdKindOf(req.who.name), count: 120, action: crowdActionForVerb(req.action) ?? "stand", reason: reason("wrong_character") });
  }
  if (types.has("subject_hidden") && who) out.push({ op: "focusFix", shot: main, focus: isCast ? who : "group", camera: "medium", reason: reason("subject_hidden") });
  if (types.has("missing_object") || types.has("missing_crowd")) {
    for (const m of v.missing ?? []) {
      if (CROWD_WORD.test(m)) { out.push({ op: "needCrowd", shot: main, kind: crowdKindOf(m), count: 120, action: crowdActionForVerb(req.action) ?? "stand", reason: reason(`missing ${m}`) }); continue; }
      const word = String(m).toLowerCase().replace(/^(a|an|the|his|her|their|my|our)\s+/, "").trim();
      const last = word.split(/\s+/).at(-1);
      if (isCast && (heldKind(word) || heldKind(last))) out.push({ op: "propHeld", shot: main, actor: who, hold: heldKind(word) ? word : last, reason: reason(`missing ${m}`) });
      else out.push({ op: "needObject", shot: main, name: objectForNoun(word) ?? objectForNoun(last) ?? word, noun: word, reason: reason(`missing ${m}`) });
    }
  }
  if (types.has("wrong_action") || types.has("static_pose")) {
    const s = tl.shots[main];
    const crowdIdx = (s.crowds ?? []).findIndex(() => true);
    const ca = crowdActionForVerb(req.action);
    const actorIsSubject = isCast && (s.actors ?? []).some((a) => a.id === who);
    if (ca && crowdIdx >= 0 && !actorIsSubject) out.push({ op: "crowdAction", shot: main, index: crowdIdx, action: ca, reason: reason("action") });
    else {
      const verb = (req.action ?? (req.text.match(/\b\w+(ed|ing|s)\b/g) ?? []).find((w) => poseForVerb(w))) ?? null;
      const pose = poseForVerb(verb);
      if (pose && (isCast || (s.actors ?? []).length)) out.push({ op: "actionPose", shot: main, actor: isCast ? who : s.actors[0].id, pose, reason: reason("action") });
    }
  }
  if (types.has("wrong_place") && req.place) {
    const set = setForPlace(tl, req, reqs);
    if (set) for (const i of shots) if (tl.shots[i].camera !== "insert" && tl.shots[i].set !== set) out.push({ op: "setOverride", shot: i, set, reason: reason("wrong_place") });
  }
  if (types.has("wrong_time") && req.light) for (const i of shots) if (tl.shots[i].light !== req.light) out.push({ op: "timeOfDay", shot: i, light: req.light, reason: reason("wrong_time") });
  if (types.has("wrong_emotion") && req.emotion && isCast) { const expr = exprForFeeling(req.emotion); if (expr) out.push({ op: "exprFix", shot: main, actor: who, expr, reason: reason("emotion") }); }
  if (types.has("picture_card")) for (const i of shots) if (tl.shots[i].insert?.kind === "card") out.push({ op: "replaceCard", shot: i, name: tl.shots[i].visuals?.[0] ?? tl.shots[i].insert.text, reason: reason("picture_card") });
  // one fix per (op, shot, target)
  const seen = new Set();
  return out.filter((f) => { const k = `${f.op}|${f.shot}|${f.id ?? f.actor ?? f.name ?? f.kind ?? f.set ?? f.light ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const SPOTS = ["center", "left", "right", "back", "door", "far"];
const freeSpot = (s) => { const taken = new Set([...(s.actors ?? []).map((a) => a.spot), ...(s.objects ?? []).map((o) => o.spot)]); return SPOTS.find((x) => !taken.has(x)) ?? "far"; };
const clone = (o) => JSON.parse(JSON.stringify(o));

/** one fix on one shot; -> true when it changed the shot, a string when it can't be applied here */
function applyOne(tl, s, f) {
  switch (f.op) {
    case "castFix": {
      if (!tl.cast?.[f.id]) return "not a cast member";
      if (s.camera === "insert") return "an insert shot";
      let a = (s.actors ?? []).find((x) => x.id === f.id);
      if (!a) { s.actors = [{ id: f.id, spot: "center", pose: "stand", expr: "neutral", facing: "camera", hold: null }, ...(s.actors ?? []).map((x) => (x.spot === "center" ? { ...x, spot: freeSpot(s) } : x))].slice(0, 4); a = s.actors[0]; }
      else if (s.focus === f.id && s.subject === f.id) return f.look ? `the cast's look (${f.look}) is the planner's: not changed here` : "already in focus";
      s.focus = f.id; s.subject = f.id;
      return true;
    }
    case "focusFix": if (s.camera === "insert") return "an insert shot"; s.focus = f.focus; if (["wide", "establish", "aerial"].includes(s.camera)) s.camera = f.camera ?? "medium"; return true;
    case "actionPose": {
      if (!POSES.has(f.pose)) return `unknown pose ${f.pose}`;
      const a = (s.actors ?? []).find((x) => x.id === f.actor);
      if (!a) return "the actor is not in the shot";
      if (a.pose === f.pose) return "already that pose";
      a.pose = f.pose; return true;
    }
    case "crowdAction": { const c = s.crowds?.[f.index]; if (!c) return "no such crowd"; if (c.action === f.action) return "already that action"; c.action = f.action; if (f.action === "march" && c.formation === "block") c.formation = "march"; return true; }
    case "exprFix": { const a = (s.actors ?? []).find((x) => x.id === f.actor); if (!a) return "the actor is not in the shot"; if (a.expr === f.expr) return "already that face"; a.expr = f.expr; return true; }
    case "propHeld": {
      const a = (s.actors ?? []).find((x) => x.id === f.actor);
      if (!a) return "the actor is not in the shot";
      if (a.hold === f.hold) return "already held";
      a.hold = f.hold; if (!["carry", "point", "blow", "eat", "throw", "dig", "hug", "build", "walk", "run"].includes(a.pose)) a.pose = "carry";
      s.visuals = [...new Set([...(s.visuals ?? []), f.hold])];
      return true;
    }
    case "needObject": {
      if (s.camera === "insert") return "an insert shot";
      if ((s.objects ?? []).some((o) => o.name === f.name)) return "already in the shot";
      if ((s.objects ?? []).length >= 3) return "the shot already has 3 objects";
      s.objects = [...(s.objects ?? []), { name: f.name, spot: freeSpot(s), facing: "camera", aliases: [f.noun ?? f.name].filter(Boolean) }];
      s.visuals = [...new Set([...(s.visuals ?? []), f.noun ?? f.name])];
      return true;
    }
    case "needCrowd": {
      if (s.camera === "insert") return "an insert shot";
      if ((s.crowds ?? []).some((c) => c.kind === f.kind)) return "that crowd is already in the shot";
      s.crowds = [...(s.crowds ?? []), { kind: f.kind, count: f.count ?? 120, formation: f.action === "march" ? "march" : "block", action: f.action ?? "stand", spot: "back", facing: "camera", seed: (s.seed ?? 1) + 7 }];
      return true;
    }
    case "setOverride": { if (s.set === f.set) return "already that set"; s.set = f.set; return true; }
    case "timeOfDay": { if (!["day", "night", "warm"].includes(f.light)) return `unknown light ${f.light}`; if (s.light === f.light) return "already that light"; s.light = f.light; return true; }
    case "replaceCard": return "a card is replaced by the builder (its need), not here";
    default: return `unknown op ${f.op}`;
  }
}

/** a check problem that only says the kit can't build an object (plan.mjs checkTimeline / the worker's kit check) */
const KIT_GAP_RE = /unknown object|the kit has no object/i;
const problemList = (check, tl) => { try { return (check?.(tl) ?? []).map((p) => (typeof p === "string" ? p : JSON.stringify(p))); } catch (e) { return [`check threw (${++threw}): ${e.message}`]; } };
let threw = 0; // a check that throws is never "no new problem": every throw counts as a new one
// problems compared without their shot / line numbers (a card cut in shifts every later shot), as a multiset
const norm = (p) => p.replace(/\b(shot|shots|line|subject|visual)\s+\d+/gi, "$1 #").replace(/"(shot|line)":\d+/g, '"$1":#');
const problemKeys = (check, tl) => { const m = new Map(); for (const p of problemList(check, tl)) { const k = norm(p); m.set(k, [...(m.get(k) ?? []), p]); } return m; };
/** the problems in after that were not in before (by kind, counted) */
const addedProblems = (before, after) => [...after].flatMap(([k, list]) => list.slice(before.get(k)?.length ?? 0));

/**
 * Apply the fixes shot by shot; after each shot's fixes `check(tl)` runs (checkTimeline + checkVisuals + checkSubjects
 * + checkProduction: the PERMANENT RULE's checks, never bypassed): a problem that was not there before undoes that
 * shot's change.
 */
export function applyFixes(tl, fixes, { check = null } = {}) {
  const applied = [], reverted = [], unapplied = [], pendingObjects = [], changed = new Set();
  let before = check ? problemKeys(check, tl) : null;
  // one fix at a time, each re-checked on its own (one bad fix never takes the good ones on its shot with it)
  for (const f of fixes ?? []) {
    const s = tl.shots?.[f.shot];
    if (!s) { unapplied.push({ ...f, why: "no such shot" }); continue; }
    const keep = clone(s);
    let r;
    try { r = applyOne(tl, s, f); } catch (e) { r = `error: ${e.message}`; }
    if (r !== true) { unapplied.push({ ...f, why: r }); continue; }
    if (check) {
      const after = problemKeys(check, tl);
      const added = addedProblems(before, after);
      // a thing the kit can't build yet is the builder's (kit -> library -> builder -> card): it stays, marked, until
      // settleObjects runs after the builder; any other new problem undoes the fix
      const kitOnly = f.op === "needObject" && added.length && added.every((p) => KIT_GAP_RE.test(p) && p.toLowerCase().includes(String(f.name).toLowerCase()));
      if (added.length && !kitOnly) { tl.shots[f.shot] = keep; reverted.push({ ...f, why: `the check: ${added[0].slice(0, 160)}` }); continue; }
      if (kitOnly) pendingObjects.push({ shot: f.shot, name: f.name });
      before = after;
    }
    applied.push(f); changed.add(f.shot);
  }
  return { applied, reverted, unapplied, pendingObjects, changedShots: [...changed] };
}

/**
 * After the builder ran over the new needs: an object a fix added that is still unknown to the kit (the builder made
 * no asset of it) is taken out again, so the timeline the pre-render checks see is clean; it stays "missing" for the
 * final fallback (a picture card).
 */
export function settleObjects(tl, pending, { check = null } = {}) {
  const removed = [];
  if (!pending?.length || !check) return { removed };
  const unknown = () => problemList(check, tl).filter((p) => KIT_GAP_RE.test(p));
  for (const p of pending) {
    const s = tl.shots?.[p.shot];
    if (!s) continue;
    const still = unknown().some((x) => x.toLowerCase().includes(String(p.name).toLowerCase()));
    const o = (s.objects ?? []).find((x) => x.name === p.name);
    if (still && o && !o.asset) { s.objects = s.objects.filter((x) => x !== o); s.visuals = (s.visuals ?? []).filter((v) => v !== p.name && !(o.aliases ?? []).includes(v)); removed.push(p); }
  }
  return { removed };
}

/**
 * After the last round: what is still missing gets the permanent rule's last fallback, a clear picture card of that
 * very thing, cut into the end of the line's longest shot (>= 1.6 s, the card gets 40%), at most `maxCards` in the video
 * and one a line; each re-checked (undone if it adds a problem). Everything else is recorded, never a failure.
 */
export function finalFallback(tl, verdicts, reqs, { check = null, maxCards = null } = {}) {
  const cards = [], unresolved = [], changed = new Set();
  const limit = maxCards ?? Math.max(1, Math.ceil((tl.duration ?? 60) / 30));
  let before = check ? problemKeys(check, tl) : null;
  for (const v of verdicts ?? []) {
    if (!v || v.verdict === "match" || v.verdict === "unjudged") continue;
    const req = (reqs ?? []).find((r) => r.line === v.line);
    const noun = (v.missing ?? [])[0];
    if (!noun || cards.length >= limit || !req) { unresolved.push({ line: v.line, verdict: v.verdict, types: v.types, fix: v.fix, why: !noun ? "nothing a card can show" : cards.length >= limit ? `card limit (${limit}) reached` : "no requirements" }); continue; }
    const shotIdx = (req.shots ?? []).filter((i) => tl.shots[i] && tl.shots[i].camera !== "insert").sort((a, b) => (tl.shots[b].end - tl.shots[b].start) - (tl.shots[a].end - tl.shots[a].start))[0];
    const s = tl.shots[shotIdx];
    if (!s || s.end - s.start < 1.6) { unresolved.push({ line: v.line, verdict: v.verdict, types: v.types, fix: v.fix, why: "no shot long enough for a card" }); continue; }
    const cut = +(s.start + (s.end - s.start) * 0.6).toFixed(3);
    const word = String(noun).replace(/^(a|an|the|his|her|their|my|our)\s+/i, "");
    // a card is a fresh insert shot (the plan's card shape), in the story's world: a creature / built world's set
    // when the host is a plain set in a story that lives in one (plan.mjs staysInTheWorld)
    const worldSet = GENERIC_SETS.has(s.set) ? (tl.shots.map((x) => x.set).find((x) => /^(creature|world):/.test(x ?? "")) ?? s.set) : s.set;
    const card = { start: cut, end: s.end, line: s.line, lines: clone(s.lines ?? [s.line]), part: s.part, set: worldSet, light: s.light, camera: "insert", focus: "insert", actors: [], monsterState: null,
      insert: { kind: "card", text: cardLabel(word), icon: iconFor(word.split(" ").at(-1)) }, marker: null, seed: (s.seed ?? 1) + 101, text: s.text, visuals: [word], subject: "group",
      ...(s.worldBase && worldSet === s.set ? { worldBase: s.worldBase, worldAliases: clone(s.worldAliases ?? []) } : {}), review: { line: v.line, noun: word } };
    const keep = clone(tl.shots);
    s.end = cut;
    tl.shots.splice(shotIdx + 1, 0, card);
    if (check) {
      const after = problemKeys(check, tl), added = addedProblems(before, after);
      if (added.length) { tl.shots = keep; unresolved.push({ line: v.line, verdict: v.verdict, types: v.types, fix: v.fix, why: `a card broke the check: ${added[0].slice(0, 120)}` }); continue; }
      before = after;
    }
    cards.push({ line: v.line, shot: shotIdx + 1, text: card.insert.text, icon: card.insert.icon });
    changed.add(shotIdx);
  }
  return { cards, unresolved, changedShots: [...changed] };
}
