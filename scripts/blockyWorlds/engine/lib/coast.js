// Blocky Worlds: the coast stage of a creature world seen from outside (pure; Node + browser).
// Turtle run 1620fc3e: the ending "I sprayed the hill ... Mud. Slick. ... The turtle tipped forward. Then it slid.
// Faster. Splash! ... Now we float in the sea at sunrise." showed the turtle walking on flat grass in every shot.
// The outside set (page/sets/creatureWorld.js addCoastStage) has a hill sloping down to the sea; this pass decides,
// line by line in story order, what each outside shot shows:
//   shot.stage = { ground: "land" | "hill" | "sea", mud?: true, fx?: ["spray" | "splash"] }  (lib/epic.js checks it)
//   and the world giant's action (shot.giants entry "world"): slide (down the hill), fall (tips), float (at sea)
// The story state carries forward: once the hill appears the story stays on it, once it is sprayed / muddy it stays
// muddy, once the creature splashes into the sea it floats there. A line about the sea / the hill / the slide whose
// shots are all inside the creature gets its first shot moved outside (the place the line is about).
// coastPass(tl, { check }) -> { staged, moved, reverted }; check(tl) -> problems (checkTimeline): a change that adds
// a problem is undone (the PERMANENT RULE: the scene still matches the narration).

const SEA = /\b(sea|seas|ocean|oceans|beach|shore|shoreline|waves?|bay|seaside|coast)\b/;
const HILL = /\b(hill|hills|hillside|slope|slopes|downhill|cliff|ridge)\b/;
const MUD = /\b(mud|muddy|slick|slippery|slime|slimy|sprayed|spraying|hosed)\b/;
const SPRAY = /\b(spray|sprayed|spraying|squirt\w*|hosed|hosing|watered)\b/;
const SPLASH = /\b(splash\w*|plunge\w*|splosh)\b/;
// the verb only: "A giant slide." (the mud, line 31) is not the turtle sliding yet ("Then it slid.", line 36)
const SLIDE = /\b(slid|sliding|slipped|slipping|skid\w*|tobogg\w*|(?:to|it|we|they|he|she|would|will|began to|started to) slides?)\b/;
const TIP = /\b(tipped|tips|tip|toppled|tumbled|tilted|lurched)\b/;
const FLOAT = /\b(float|floats|floating|floated|afloat|bob|bobs|bobbing|drift\w*|swam|swims|swimming|sailed|sails)\b/;

const lc = (s) => String(s ?? "").toLowerCase();
// the outside world to move a line to: at sea, the creature's own sea world when the story has one; else its land one
const outsideOf = (worlds, creature, sea = false) => {
  const all = Object.entries(worlds ?? {}).filter(([, w]) => w?.view === "outside" && w.creature === creature);
  return ((sea ? all.find(([, w]) => w.water) : null) ?? all.find(([, w]) => !w.water) ?? all[0])?.[0] ?? null;
};
const worldOfSet = (worlds, set) => (/^creature:/.test(set ?? "") ? worlds?.[set.slice(9)] ?? null : null);

/** the coast words of one line: { sea, hill, mud, spray, splash, slide, tip, float } (pure) */
export function coastWords(text) {
  const t = ` ${lc(text)} `;
  return { sea: SEA.test(t), hill: HILL.test(t), mud: MUD.test(t), spray: SPRAY.test(t), splash: SPLASH.test(t), slide: SLIDE.test(t), tip: TIP.test(t), float: FLOAT.test(t) };
}

/**
 * The stage per line, in story order (pure): [{ ground, mud, fx, action } | null]. null: the line is before the coast
 * part of the story (the plain fields stay). "Faster. Faster." after a slide goes on sliding.
 */
export function coastPlan(lineTexts) {
  const out = [];
  let ground = null, mud = false, inSea = false, sliding = false;
  for (const text of lineTexts) {
    const w = coastWords(text);
    const any = w.sea || w.hill || w.mud || w.spray || w.splash || w.slide || w.tip || w.float;
    if (!ground && !any) { out.push(null); continue; }
    if (w.mud || w.spray) mud = true;
    if (w.splash) { inSea = false; ground = "hill"; }
    else if (inSea || (w.float && (w.sea || ground))) { ground = "sea"; inSea = true; }
    else ground = ground === "sea" ? "sea" : "hill";
    const fx = [...(w.spray ? ["spray"] : []), ...(w.splash ? ["splash"] : [])];
    const goOn = sliding && /\b(faster|down|whoosh|zoom\w*|speed\w*)\b/.test(lc(text));
    const action = w.splash ? "slide" : ground === "sea" ? "float" : w.slide || goOn ? "slide" : w.tip ? "fall" : null;
    sliding = action === "slide" && !w.splash;
    out.push({ ground, ...(mud && ground === "hill" ? { mud: true } : {}), ...(fx.length ? { fx } : {}), action });
    if (w.splash) { inSea = true; ground = "sea"; }
  }
  return out;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

/** several lines' stages on one shot: the last line's ground and action (a splash wins), the fx and mud of any */
export function mergeStages(list) {
  if (!list.length) return null;
  const last = list.at(-1), fx = [...new Set(list.flatMap((x) => x.fx ?? []))];
  const splash = fx.includes("splash");
  return { ground: splash ? "hill" : last.ground, ...(list.some((x) => x.mud) && (splash || last.ground === "hill") ? { mud: true } : {}), ...(fx.length ? { fx } : {}), action: splash ? "slide" : last.action ?? null };
}

/** what a staged outside shot shows (shot.worldAliases: the narration check's words for the place) */
export function stageWords(stage) {
  if (!stage || stage.ground === "land") return [];
  const coast = ["hill", "hills", "hillside", "slope", "sea", "ocean", "water", "shore", "beach", "coast", "waves"];
  const fx = stage.fx ?? [];
  return [...coast, ...(stage.mud ? ["mud", "muddy", "slick", "slippery", "slide", "mudslide", "muddy hill slide", "hill slide"] : []),
    ...(fx.includes("spray") ? ["spray", "hose", "garden hose"] : []), ...(fx.includes("splash") ? ["splash"] : [])];
}

export function coastPass(tl, { check = null } = {}) {
  const worlds = tl.worlds ?? null, res = { staged: 0, moved: 0, reverted: 0 };
  if (!worlds || !Object.values(worlds).some((w) => w?.view === "outside")) return res;
  const texts = (tl.lines ?? []).map((L) => L.text ?? "");
  const plan = coastPlan(texts);
  if (!plan.some(Boolean)) return res;
  const count = () => (check ? check(tl).length : 0);
  let base = count();
  plan.forEach((st0, i) => {
    if (!st0) return;
    // a shot can carry several lines (a short "Splash!" rides on the line before's shot): its stage is theirs merged
    const own = tl.shots.filter((s) => (s.lines ?? [s.line]).includes(i) && Math.max(...(s.lines ?? [s.line])) === i);
    if (!own.length) return;
    const st = mergeStages((own[0].lines ?? [own[0].line]).map((k) => plan[k]).filter(Boolean));
    const snap = clone(tl.shots);
    const w = (own[0].lines ?? [own[0].line]).map((k) => coastWords(texts[k])).reduce((a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] || b[k]])));
    const aboutPlace = w.sea || w.hill || w.splash || w.slide || w.tip || w.float || w.spray;
    const isOut = (s) => worldOfSet(worlds, s.set)?.view === "outside";
    let outside = own.filter(isOut);
    // a coast line filmed only inside the creature: its first non-card shot goes outside, onto the creature itself
    if (!outside.length && aboutPlace) {
      const s = own.find((x) => x.camera !== "insert" && worldOfSet(worlds, x.set));
      const out = s ? outsideOf(worlds, worldOfSet(worlds, s.set).creature, st.ground === "sea") : null;
      if (s && out) {
        s.set = `creature:${out}`; s.camera = "establish"; s.focus = "world"; s.marker = null; delete s.markers;
        s.giants = [...(s.giants ?? []).filter((g) => g.id !== "world"), { id: "world", action: st.action ?? "walk" }];
        delete s.setState;
        outside = [s]; res.moved++;
      }
    }
    for (const s of outside) {
      if (worldOfSet(worlds, s.set)?.water) continue; // a sea world is the sea already (no coast on it)
      const hasPerson = (s.actors ?? []).length > 0;
      const fx = (st.fx ?? []).filter((x) => x !== "spray" || hasPerson);
      // (the splash is filmed from the beach by the set itself: creatureWorld.js stageAfter, whatever the camera type)
      s.stage = { ground: st.ground, ...(st.mud ? { mud: true } : {}), ...(fx.length ? { fx } : {}) };
      if (st.action) {
        const g = (s.giants ?? []).find((x) => x.id === "world");
        if (g) g.action = st.action; else s.giants = [...(s.giants ?? []), { id: "world", action: st.action }];
      }
      // the spray is held: the person spraying holds the hose
      if (fx.includes("spray") && s.actors?.[0] && !s.actors[0].hold) s.actors[0].hold = "hose";
      s.worldAliases = [...new Set([...(s.worldAliases ?? []), ...stageWords(s.stage)])];
      res.staged++;
    }
    const now = count();
    if (now > base) { tl.shots = snap; res.reverted++; } else base = now;
  });
  // the shots of the same outside world after the coast began keep its ground (the story state), even with no words
  let last = null;
  tl.shots.forEach((s) => {
    const st = plan[s.line];
    if (st) last = st;
    if (s.stage || !last || worldOfSet(worlds, s.set)?.view !== "outside" || worldOfSet(worlds, s.set)?.water) return;
    s.stage = { ground: last.ground, ...(last.mud && last.ground === "hill" ? { mud: true } : {}) };
    s.worldAliases = [...new Set([...(s.worldAliases ?? []), ...stageWords(s.stage)])];
  });
  return res;
}
