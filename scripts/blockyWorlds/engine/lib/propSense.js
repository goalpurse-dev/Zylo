// Blocky Worlds planner: PROP SENSE (PLANNER-BUGS 2026-11-08, owner's review of step 2B). Pure, Node + browser.
//
// The owner: "wrong props from closest-word matches: coin -> gold star, the piggy bank in Grandma's hands instead of
// Wren's, a mirror held as 'glass', bakery / pigeon / birthday party objects the lines don't name, a musical note -> a
// letter, a tractor for a cart, a feather duster -> a mop". Rules:
//   1. a hand prop is a thing the shot's line names as a HEAD noun ("coin bank" is a bank, never a coin; "feather
//      duster" is a duster, never a feather; "music box" is a box); a word in another sense is no prop (a musical
//      "note" next to bells / humming / a tune; "rings" after a bell is a sound; a body part is never held)
//   2. a held thing goes to its owner: "Grandma's coin jar" is Grandma's, "my coin bank" the narrator's, else the
//      director's heldBy when that person is in the shot
//   3. a scene object appears only when the line names it (or the director / builder placed it: needId / propId / asset
//      / pet / a giant), so no bakery for "bread rises", no pigeon for "Old Tobin was right", no stairs for "the
//      turtle's steps"
//   Every change is kept only when the pre-render checks are no worse (check(tl) -> counts).
//
//   propSensePass(tl, { check, props, giantWords }) -> { holds: [...], moved: [...], dropped: [...], kept: n }
//   propSenseProblems(tl, { props }) -> advisory list (the measure the step page shows)
import { HELD, THINGS, ANIMALS, heldIndex } from "./catalog.js";
import { OBJECT_CATALOG, MUSIC_WORDS } from "./visuals.js";

const HI = heldIndex();
const words = (s) => String(s ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z' ]+/g, " ").split(/\s+/).filter(Boolean);
const sing = (w) => /ies$/.test(w) ? w.slice(0, -3) + "y" : /(ss|us)$/.test(w) ? w : /(ches|shes|xes)$/.test(w) ? w.slice(0, -2) : /s$/.test(w) && w.length > 3 ? w.slice(0, -1) : w;
const BODY = /^(arm|arms|hand|hands|head|heads|nose|noses|ear|ears|eye|eyes|leg|legs|foot|feet|paw|paws|tail|tails|hair|face|faces|mouth|finger|fingers|shoulder|shoulders|back|neck|knee|knees|tooth|teeth|lip|lips|toe|toes)$/;
const NOT_NOUN = /^(and|or|but|the|a|an|of|in|on|at|to|for|with|from|is|was|are|were|that|this|it|its|his|her|my|our|their|then|so|too|very|all|every|each|again|now|up|down|out|off|over|away|back|into|onto|by|as|like|than|who|which|when|while|whenever|until|just|only|still|even|never|always|ever)$/;
// a word after a noun that is its verb ("the bell rings", "my bank holds"), not a noun it modifies
const VERBISH_NEXT = /^(rings|rang|chimes|chimed|sounds|hums|hummed|grumbles|swings|swung|shook|shakes|holds|held|falls|fell|works|plays|played|stops|stopped|starts|rolls|rolled|rattled|rattles|cracks|cracked|jams|jammed|choked|was|is|grows|grew|gurgles|gurgled|sank|sinks|climbed|climbs|split|shot|burst|went|came)$/;
const isNounish = (w) => !!w && !NOT_NOUN.test(w) && (HI.has(w) || HI.has(sing(w)) || !!OBJECT_CATALOG[w] || !!OBJECT_CATALOG[sing(w)] || /^(cards?|bank|banks|jar|jars|box|boxes|duster|dusters|shop|shops|loaves|gauges?|slot|slots|pipe|pipes|elevator|loaf|tower|towers|house|houses|stilt|stilts)$/.test(w));

/** the aliases (phrases) a thing is named by: a held kind's aliases, a scene object's aliases, the word itself */
function aliasesOf(name) {
  const n = String(name ?? "").toLowerCase().replace(/_/g, " ");
  const kind = HI.get(n) ?? HI.get(sing(n)) ?? (HELD[n.replace(/ /g, "_")] ? n.replace(/ /g, "_") : null);
  const out = new Set([n, sing(n)]);
  if (kind) for (const a of HELD[kind] ?? []) out.add(a);
  const obj = OBJECT_CATALOG[n.replace(/ /g, "_")] ?? OBJECT_CATALOG[n];
  if (obj) for (const a of obj.aliases ?? []) out.add(String(a).toLowerCase());
  if (THINGS[n.replace(/ /g, "_")]) for (const a of THINGS[n.replace(/ /g, "_")].aliases ?? []) out.add(a);
  if (ANIMALS[n]) for (const a of ANIMALS[n]) out.add(a);
  return [...out].filter(Boolean);
}

/**
 * Where a phrase is named as a head noun in the token list: its last word is not followed by another noun ("coin bank":
 * coin is a modifier) and not used in another sense. -> token index of the head, or -1.
 */
export function headAt(toks, phrase, ctxText = "") {
  const ps = words(phrase);
  if (!ps.length) return -1;
  for (let i = 0; i + ps.length <= toks.length; i++) {
    if (!ps.every((p, j) => toks[i + j] === p || (j === ps.length - 1 && sing(toks[i + j]) === p))) continue;
    const end = i + ps.length - 1, next = toks[end + 1];
    if (next && isNounish(next) && !VERBISH_NEXT.test(next) && !/'s$/.test(toks[end])) continue; // a modifier of the next noun
    const w = toks[end];
    if (/^notes?$/.test(w) && MUSIC_WORDS.test(ctxText)) continue;                    // a musical note
    if (/^(ring|rings)$/.test(w) && /^(bell|bells|it|phone|doorbell|that)$/.test(toks[i - 1] ?? "")) continue; // a sound
    if (/^steps?$/.test(w) && /'s$/.test(toks[i - 1] ?? "")) continue;               // "the turtle's steps": footsteps
    if (BODY.test(w)) continue;
    return end;
  }
  return -1;
}

const HAVE = /^(has|have|had|holds|hold|held|holding|carry|carries|carried|carrying|grabbed|grabs|took|takes|raised|raises|lifted|waved|waves|pulled|found|kept|keep|keeps|jammed|gave|handed|opened|wears|wore|wearing)$/;
const ADJ =/^(with|from|that|tall|small|big|huge|giant|little|empty|old|new|brass|wooden|golden|cracked|chipped|many|hanging|swinging|rising|thick|town)$/;
const shotText =(tl, s) => (s.lines ?? [s.line]).map((i) => tl.lines?.[i]?.text ?? "").join(" ");
const nearText = (tl, s) => { const ls = s.lines ?? [s.line]; const a = Math.min(...ls) - 1, b = Math.max(...ls) + 1; return [a, ...ls, b].map((i) => tl.lines?.[i]?.text ?? "").join(" ").toLowerCase(); };

/** the head word of a director prop's name ("chipped blue piggy bank with one button" -> "piggy bank" / "bank") */
function propPhrases(p) {
  const nm = String(p?.name ?? "").toLowerCase().split(/\b(?:with|of|that|for|from|in|on)\b/)[0].trim();
  const ws = words(nm);
  if (!ws.length) return [];
  // a compound head ("handbell") is also named by its last part ("my cracked bell")
  const tail = (ws.at(-1).match(/^(?:hand|tea|door|cow|sleigh|church|snow|rain|sun|moon|star|fire|water|wind)(\w{4,})$/) ?? [])[1];
  return [...new Set([ws.slice(-2).join(" "), ws.at(-1), ...(tail ? [tail] : [])])];
}

/** the cast id a possessor word names ("grandma's" -> odette via the alias, "my" -> me, "pobble's" -> pobble) */
function ownerId(w, tl) {
  const vw = tl.visualWorld ?? {};
  if (w === "my" || w === "our") return "me";
  const base = w.replace(/'s$/, "");
  if (base === w) return null;
  if (tl.cast?.[base]) return base;
  if (vw.alias?.[base]) return vw.alias[base];
  if (vw.nick?.[base]) return vw.nick[base];
  for (const [id, c] of Object.entries(tl.cast ?? {})) if (words(c.name).at(-1) === base) return id;
  if (String(vw.narrator ?? "").toLowerCase() === base) return "me";
  return null;
}

function planShot(tl, s, { props = [], giantWords = new Set() } = {}) {
  const text = shotText(tl, s), toks = words(text), ctx = nearText(tl, s) + (tl.visualWorld?.music && !/\b(paper|wrote|write|envelope|desk)\b/.test(text.toLowerCase()) ? " music" : "");
  const changes = [];
  const castIds = new Set(Object.keys(tl.cast ?? {}));
  const heldNow = new Set((s.actors ?? []).map((a) => a.hold).filter(Boolean));
  // the hand things the line names as heads: the director's hand props first, then the kit's hand props
  const named = [];
  for (const p of props) if (!p.size || p.size === "hand") for (const ph of propPhrases(p)) { const at = headAt(toks, ph, ctx); if (at >= 0) { named.push({ word: ph, at, prop: p }); break; } }
  for (const [kind, al] of Object.entries(HELD)) for (const a of al) { const at = headAt(toks, a, ctx); if (at >= 0 && !named.some((x) => x.at === at)) { named.push({ word: a, at, kind }); break; } }
  for (const a of s.actors ?? []) {
    const h = a.hold;
    if (!h || typeof h !== "string" || castIds.has(h)) continue;
    const ok = aliasesOf(h).some((al) => headAt(toks, al, ctx) >= 0) || props.some((p) => propPhrases(p).includes(String(h).toLowerCase()) && propPhrases(p).some((ph) => headAt(toks, ph, ctx) >= 0));
    if (ok && !giantWords.has(h)) continue;
    // a replacement only for a thing someone has: owned ("my coin bank", "Grandma's coin jar") or after a have-verb
    const had = (x) => toks.slice(Math.max(0, x.at - words(x.word).length - 4), x.at).some((t) => /^(my|his|her|our|their)$/.test(t) || /'s$/.test(t) || HAVE.test(t));
    const cand = named.filter((x) => !heldNow.has(x.word) && !giantWords.has(x.word) && had(x)).sort((x, y) => x.at - y.at)[0];
    changes.push({ kind: "hold", actor: a.id, from: h, to: cand?.word ?? null });
  }
  // the owner of a named hand thing holds it
  for (const x of named) {
    const holder = (s.actors ?? []).find((a) => a.hold && (a.hold === x.word || aliasesOf(a.hold).includes(x.word) || changes.some((c) => c.kind === "hold" && c.actor === a.id && c.to === x.word)));
    if (!holder) continue;
    let own = null;
    for (let i = x.at - words(x.word).length; i >= 0 && i >= x.at - 5; i--) { const o = ownerId(toks[i], tl); if (o) { own = o; break; } if (NOT_NOUN.test(toks[i]) && !/^(my|our)$/.test(toks[i])) break; }
    // the director's holder only for the story's planted prop named as one thing ("the poorest bank"), never for a
    // generic plural ("Mirrors are fine", "Coins burst out")
    if (!own && x.prop?.heldBy && x.prop.storyProp && !/s$/.test(toks[x.at]) ) own = x.prop.heldBy;
    // the planted prop stays with its keeper ("Grandpa's jar" was given to the narrator)
    if (x.prop?.storyProp && x.prop.heldBy === holder.id) continue;
    if (own && own !== holder.id && (s.actors ?? []).some((a) => a.id === own && !a.hold)) changes.push({ kind: "move", from: holder.id, to: own, what: holder.hold });
    // the owner is not in the shot ("Grandma says it's the poorest bank in town": Wren's bank): the owner joins it
    else if (own && own !== holder.id && castIds.has(own) && !(s.actors ?? []).some((a) => a.id === own) && (s.actors ?? []).length < 4) changes.push({ kind: "give", from: holder.id, to: own, what: holder.hold });
  }
  // scene objects the line does not name
  for (const o of s.objects ?? []) {
    if (!o?.name || o.asset || o.pet || o.needId || o.propId || o.babies || /^(house_front|item|crib)$/.test(o.name)) continue;
    const als = aliasesOf(o.name);
    // the bible's own set piece ("old town bell", "clock tower"): named by any of its main words in the line
    const bible = props.filter((p) => words(p.name).some((w) => als.includes(w) || als.includes(sing(w))));
    const ok = als.some((al) => headAt(toks, al, ctx) >= 0) || bible.some((p) => words(p.name).some((w) => w.length > 3 && !ADJ.test(w) && toks.some((t) => t === w || sing(t) === w)));
    if (!ok) changes.push({ kind: "drop", object: o.name });
  }
  return changes;
}

function apply(s, c) {
  const saved = JSON.stringify({ actors: s.actors, objects: s.objects });
  if (c.kind === "hold") { const a = s.actors.find((x) => x.id === c.actor); if (a) { a.hold = c.to; if (!c.to && a.pose === "carry") a.pose = "stand"; } }
  else if (c.kind === "move") { const a = s.actors.find((x) => x.id === c.from), b = s.actors.find((x) => x.id === c.to); if (a && b && !b.hold) { b.hold = a.hold; a.hold = null; if (a.pose === "carry") a.pose = "stand"; if (["stand", "talk"].includes(b.pose)) b.pose = "carry"; } }
  else if (c.kind === "give") {
    const a = s.actors.find((x) => x.id === c.from);
    if (a) {
      const taken = new Set([...s.actors.map((x) => x.spot), ...(s.objects ?? []).map((o) => o.spot)]);
      const spot = ["left", "right", "center", "back"].find((x) => !taken.has(x)) ?? "back";
      s.actors.push({ id: c.to, spot, pose: "carry", expr: a.expr ?? "neutral", facing: a.id, hold: a.hold });
      a.hold = null; if (a.pose === "carry") a.pose = "stand";
    }
  }
  else if (c.kind === "drop") { s.objects = (s.objects ?? []).filter((o) => o.name !== c.object); if (!s.objects.length) delete s.objects; }
  return () => { const o = JSON.parse(saved); s.actors = o.actors; if (o.objects) s.objects = o.objects; else delete s.objects; };
}

const worse = (a, b) => Object.keys(a).some((k) => (b[k] ?? 0) > (a[k] ?? 0));

/** The pass (mutates tl.shots); every change kept only when check(tl) is no worse. */
export function propSensePass(tl, { check = null, props = [], giantWords = new Set() } = {}) {
  const out = { holds: [], moved: [], dropped: [], reverted: 0 };
  let base = check ? check(tl) : null;
  for (const s of tl.shots ?? []) {
    if (s.camera === "insert" || s.insert) continue;
    for (const c of planShot(tl, s, { props, giantWords })) {
      const undo = apply(s, c);
      if (check) { const now = check(tl); if (worse(base, now)) { undo(); out.reverted++; continue; } base = now; }
      const at = `L${s.line}`;
      if (c.kind === "hold") out.holds.push(`${at} ${c.actor}: ${c.from} -> ${c.to ?? "nothing"}`);
      else if (c.kind === "move" || c.kind === "give") out.moved.push(`${at} ${c.what}: ${c.from} -> ${c.to}`);
      else out.dropped.push(`${at} ${c.object}`);
    }
  }
  return out;
}

/** advisory: the props a shot shows that its line does not name (the step page's "wrong props") */
export function propSenseProblems(tl, { props = [] } = {}) {
  const out = [];
  for (const s of tl.shots ?? []) for (const c of planShot(tl, s, { props })) out.push(`L${s.line} ${c.kind} ${c.from ?? c.object ?? ""}${c.to ? " -> " + c.to : ""}`);
  return out;
}
