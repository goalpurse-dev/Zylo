// Blocky Worlds SIMPLE LOOK story passes (owner 2026-11-10 review of the simple-look stills). Pure, deterministic.
//   heroSignature(tl)  THE HERO STANDS OUT (a general rule for every story): the narrator ("me") gets a signature in the
//                      world bible (tl.world.cast[<hero>].signature) and on its cast look: a hoodie in a signature
//                      colour no other cast member wears + one signature item (the story's own small prop when it is
//                      wearable / pinnable, e.g. a striped sock on the sleeve; else a seeded one: scarf, star badge,
//                      goggles, cap, backpack). Kids keep the kids' height.
//   propPass(tl, { check })  NO RANDOM PROPS: an actor's hand prop stays only when the line calls for it (the story's
//                      prop, or the thing named with a holding verb); a verb / -ing word is never a prop. Each removal
//                      is kept only when the four checks are no worse.
//   eyePass(tl)        THE MONSTER'S EYE: tl.monster.eyes = 1 for a one-eyed creature ("one giant eye", "its eye");
//                      every monster shot's monsterState.eye from its words (blink / twitch / press-to-glass / stare)
//                      and eyeAt = the word's shot-local start.
export const SIGNATURE_COLORS = Object.freeze(["#ff3b6b", "#ff8a1f", "#2fd27a", "#2e86de", "#8f5cff", "#00c2c7", "#ffd23a"]);
const WEARABLE = { sock: "sock", socks: "sock", scarf: "scarf", cap: "cap", hat: "cap", goggles: "goggles", badge: "star", star: "star", ribbon: "scarf", bandana: "scarf", backpack: "backpack", bag: "backpack", glove: "sock", mitten: "sock" };
const ITEMS = ["scarf", "star", "goggles", "cap", "backpack"];
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const low = (s) => String(s ?? "").toLowerCase();
const dist = (a, b) => { const p = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

export function heroSignature(tl) {
  const hero = tl?.cast?.me;
  if (!hero) return null;
  const bibleId = hero.bibleId ?? "me", B = tl.world?.cast?.[bibleId] ?? null;
  const others = Object.entries(tl.cast).filter(([id]) => id !== "me").map(([, c]) => c.look?.top).filter((c) => /^#[0-9a-f]{6}$/i.test(String(c)));
  const seed = hash(`${tl.world?.seed ?? tl.title}:hero`);
  const order = SIGNATURE_COLORS.map((c, i) => SIGNATURE_COLORS[(i + seed) % SIGNATURE_COLORS.length]);
  const color = order.find((c) => others.every((o) => dist(c, o) > 90)) ?? order[0];
  const prop = low(tl.visualWorld?.prop ?? Object.values(tl.world?.props ?? {}).find((p) => p.storyProp)?.name ?? "");
  // the story's prop: the planner's / bible's, else the thing the hero holds most often (#2: the sock)
  const held = {}; for (const sh of tl.shots ?? []) for (const x of sh.actors ?? []) if (x.id === "me" && x.hold) held[low(x.hold)] = (held[low(x.hold)] ?? 0) + 1;
  const top = Object.entries(held).filter(([k]) => WEARABLE[k]).sort((p, q) => q[1] - p[1])[0]?.[0] ?? "";
  const item = WEARABLE[prop] ?? WEARABLE[top] ?? ITEMS[seed % ITEMS.length];
  const signature = { color, item, hoodie: true, ...(WEARABLE[prop] || WEARABLE[top] ? { fromProp: WEARABLE[prop] ? prop : top } : {}) };
  hero.look = { ...(hero.look ?? {}), signature, costume: "plain" };
  if (B) { B.signature = signature; B.look = { ...(B.look ?? {}), signature, costume: "plain" }; }
  return signature;
}

const HOLD_VERB = /\b(hold|holds|held|holding|carr\w*|grab\w*|took|take|takes|pull\w*|keep|keeps|kept|have|has|had|brought|bring\w*|gave|give\w*|lift\w*|wav\w*|throw\w*|threw|eat\w*|ate|blew|blow\w*|pick\w*|clutch\w*|hug\w*|slapped|use\w*)\b/;
export function propPass(tl, { check = null } = {}) {
  const rep = { dropped: 0, kept: 0, reverted: 0 };
  const story = low(tl.visualWorld?.prop ?? "");
  let base = check ? check(tl) : null;
  for (const s of tl.shots ?? []) {
    const text = low((s.lines ?? [s.line]).map((i) => tl.lines?.[i]?.text ?? "").join(" ") || s.text);
    for (const a of s.actors ?? []) {
      if (!a.hold || tl.cast?.[a.hold]) continue; // a carried baby stays
      const h = low(a.hold), stem = h.replace(/s$/, "");
      const named = new RegExp(`\\b${stem}s?\\b`).test(text);
      const ok = !/ing$/.test(h) && named && (h === story || stem === story || HOLD_VERB.test(text));
      if (ok) { rep.kept++; continue; }
      const snap = { hold: a.hold, pose: a.pose };
      a.hold = null; if (a.pose === "carry") a.pose = "stand";
      if (check) { const now = check(tl); if (Object.keys(now).some((k) => now[k] > (base?.[k] ?? 0))) { Object.assign(a, snap); rep.reverted++; continue; } base = now; }
      rep.dropped++;
    }
  }
  return rep;
}

// the eye's state from its words (owner 2026-11-10): twitch (lid flutter), a slow blink, pressed to the glass, a squint
// where it stares / suspects / watches, else a wide stare
const EYE_WORDS = [[/\btwitch\w*/, "twitch"], [/\bblink(?:ed|s|ing)?\b(?! first)/, "blink"], [/\b(press\w*|glass|pane|lick\w*|window|filled)\b/, "press"], [/\b(star(?:e|ed|es|ing)|suspect\w*|squint\w*|watch\w*|peek\w*|look\w*|glar\w*)\b/, "squint"]];
export function eyePass(tl) {
  if (!tl?.monster) return null;
  const all = low((tl.lines ?? []).map((l) => l.text).join(" "));
  if (/\b(one|a|its|the) (giant |huge |big |single |glowing )?eye\b/.test(all) && !/\b(its|two|giant|glowing) eyes\b/.test(all)) tl.monster.eyes = 1;
  const rep = {};
  for (const s of tl.shots ?? []) {
    if (!s.monsterState && s.focus !== "monster") continue;
    const ws = (tl.captions ?? []).filter((w) => w.start >= s.start - 1e-6 && w.start < s.end - 1e-6);
    let eye = "stare", at = 0;
    // the mantra ("rude things blink first") and the hero's own "I did not blink" are not the giant's blink
    const notIts = (e) => e === "blink" && /\b(blinks? first|not blink|n't blink|never blink|without blinking)\b/.test(low(s.text)) || (e === "blink" && /\bblinks? first\b/.test(low(tl.lines?.[s.line]?.text ?? "")) && !/\bblinked\b/.test(low(s.text)));
    for (const [re, e] of EYE_WORDS) { if (notIts(e)) continue; const w = ws.find((x) => re.test(low(x.word))); if (w) { eye = e; at = +(w.start - s.start).toFixed(3); break; } }
    if (eye === "stare") { const hit = EYE_WORDS.find(([re, e]) => !notIts(e) && re.test(low(s.text))); if (hit) eye = hit[1]; }
    s.monsterState = { ...(s.monsterState ?? { spot: "far", state: "lurk" }), eye, eyeAt: at };
    // the monster is framed by the simple camera (the whole creature / its eye), not the EPIC establish / aerial view
    if (s.focus === "monster" && ["establish", "aerial"].includes(s.camera) && !/^creature:/.test(s.set ?? "")) s.camera = "wide";
    rep[eye] = (rep[eye] ?? 0) + 1;
  }
  return rep;
}

/** A THING FLIES, NOT THE PEOPLE: a shot whose object is flying ("the blanket flew away") never lifts a bystander into
 *  the air ("fly" was read off the line's verb): who is not the line's subject looks up at it (checks-guarded) */
export function flyPass(tl, { check = null } = {}) {
  let base = check ? check(tl) : null, n = 0;
  for (const s of tl.shots ?? []) {
    if (!(s.objects ?? []).some((o) => o.state === "flying")) continue;
    for (const a of s.actors ?? []) {
      if (a.pose !== "fly" || a.id === s.subject) continue;
      a.pose = "look_up";
      if (check) { const now = check(tl); if (Object.keys(now).some((k) => now[k] > (base?.[k] ?? 0))) { a.pose = "fly"; continue; } base = now; }
      n++;
    }
  }
  return n;
}
