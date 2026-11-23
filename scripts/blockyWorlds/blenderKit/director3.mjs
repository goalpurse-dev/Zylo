// ROUND 8 DIRECTOR (owner 2026-11-23): ONE STAGE, FEW PEOPLE, ONE CONTINUOUS TAKE PER SCENE.
//   planStory3   one call: the cast (2-3, looks locked in code afterwards), ONE main place (+ at most one side place), the
//                STAGE MAP (where each character / key prop / the rule object is, the camera side), the scenes (a new
//                place or time = a new scene), the rule object (one physical thing on / next to people), the monster
//   lineCards    one call per line IN ORDER: the scene STATE (who is where, facing, holding; what is on / off; where the
//                monster is) goes to the card writer; the card adds actions to the running scene + 1-3 camera cuts; a
//                card that contradicts the state is REJECTED IN CODE (takes.mjs applyCard / cutProblems) and written again
//   redoCard     a failed card again with the checker's notes + the previous card's END STILL + its own stills
import { THINGS, PLACES, engineKitText8, MONSTERS8, TIMES8 } from "../../../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { ACTIONS8, MARKS8, SHOTS8, MOVES8, FACES8, applyCard, cutProblems, initialState, namedIn, SIDE_DEG } from "./takes.mjs";

const s = { type: "string" };
const obj = (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
const en = (v) => ({ type: "string", enum: [...v] });
const low = (x) => String(x ?? "").trim().toLowerCase();
const numbered = (script) => script.lines.map((l, i) => `${i + 1}. ${l.speaker && !/^(narrator|me|)$/i.test(l.speaker) ? `[${l.speaker}] ` : ""}${l.text}`).join("\n");

// ---------------------------------------------------------------- THE PLAN
export function plan3Schema() {
  return obj({
    cast: { type: "array", items: obj({ name: s, kid: { type: "boolean" }, skin: s, hair: en(["spiky", "messy", "long", "bun", "short", "curly"]), hair_color: s, voice_type: en(["narrator", "kid_boy", "kid_girl", "teen_boy", "teen_girl", "mom", "dad", "grandma", "grandpa"]) }) },
    monster: obj({ present: { type: "boolean" }, style: en(Object.keys(MONSTERS8)), size: { type: "number" } }),
    rule: obj({ sentence: s, object: obj({ thing: en(THINGS), where: en(["in_hand", "next_to", "at_feet", "on_ground"]), who: s, what_it_does: s }) }),
    places: obj({ main: en(PLACES.map((p) => p.id)), side: en(["none", ...PLACES.map((p) => p.id)]) }),
    stage: { type: "array", items: obj({ place: en(PLACES.map((p) => p.id)), camera_side: en(Object.keys(SIDE_DEG)), monster_starts_here: { type: "boolean" }, marks: { type: "array", items: obj({ who: s, mark: en(MARKS8) }) } }) },
    scenes: { type: "array", items: obj({ id: { type: "integer" }, from_line: { type: "integer" }, to_line: { type: "integer" }, place: en(PLACES.map((p) => p.id)), time: en(TIMES8), busy: en(["empty", "quiet", "busy"]) }) },
    props: { type: "array", items: obj({ kind: en(THINGS), size: { type: "number" } }) },
  });
}
export const PLAN3_SYSTEM = `You plan an "In This Town" video (Roblox-style blocky 3D, 9:16) like a stage director. The whole story is played on ONE STAGE.
- CAST: the narrator "Me" + the 1-2 named characters of the script (2-3 in all). Give hair / skin / voice; their colours are locked by the code.
- ONE MAIN PLACE for the whole story, at most ONE short side place (only if the script truly goes there).
- THE STAGE MAP, once per place: where each character, each key prop and THE RULE OBJECT stand (marks: ${MARKS8.join(", ")}; "left/right" as the camera sees them, "back" = further from the camera), and which side the camera stays on (front / front_left / front_right): the camera never crosses to the other side. The monster's drain (drain_grate) is BIG and IN THE OPEN on the street BEHIND the cast (back / back_left / back_right), never behind a house or a tree: the monster rises behind the people, and the cameras in front see both.
- THE RULE OBJECT: one simple PHYSICAL thing from THINGS on or next to people (in_hand of who / next_to who / at_feet of who / on_ground at its mark) that is visible in most shots; line 1 shows someone doing the rule.
- SCENES: consecutive lines in the same place and the same light. A new place or a new time = a new scene. The light follows the story: day setup, night or storm for the danger, morning for the ending. busy: "empty" unless a line is about crowds or traffic.
- MONSTER: present only if the script has one; "shadow" (a tall black silhouette with glowing eyes) for a scary story.
- PROPS: every THING the script names, with a size (people are 5 tall).
${engineKitText8()}
Return only the JSON.`;

/** -> [problem] the code can see in a plan */
export function plan3Problems(p, script) {
  const out = [];
  const n = script.lines.length;
  const cast = p?.cast ?? [];
  if (!cast.some((c) => /^me$/i.test(c.name))) out.push('the cast must include the narrator "Me"');
  if (cast.length < 2 || cast.length > 3) out.push(`${cast.length} cast members: 2-3 including Me`);
  const sc = [...(p?.scenes ?? [])].sort((a, b) => a.from_line - b.from_line);
  let next = 1;
  for (const x of sc) { if (x.from_line !== next) out.push(`scene ${x.id} starts at line ${x.from_line}, expected ${next}`); if (x.to_line < x.from_line) out.push(`scene ${x.id} ends before it starts`); next = x.to_line + 1; }
  if (next !== n + 1) out.push(`the scenes must cover lines 1-${n} (they end at ${next - 1})`);
  const places = new Set(sc.map((x) => x.place));
  if (places.size > 2) out.push(`${places.size} places: one main place + at most one side place`);
  for (const pl of places) if (!(p.stage ?? []).some((st) => st.place === pl)) out.push(`no stage map for ${pl}`);
  // nobody stands right behind someone else from the camera (round 8 first test: Grandma at back_left behind Me at left)
  const col = (m) => (/left/.test(m) ? "left" : /right/.test(m) ? "right" : "center");
  for (const st of p?.stage ?? []) {
    const ppl = (st.marks ?? []).filter((m) => cast.some((c) => low(c.name) === low(m.who)));
    for (let i = 0; i < ppl.length; i++) for (let j = i + 1; j < ppl.length; j++) if (col(ppl[i].mark) === col(ppl[j].mark)) out.push(`${st.place}: ${ppl[i].who} (${ppl[i].mark}) and ${ppl[j].who} (${ppl[j].mark}) stand in the same column: one hides the other from the camera; use left / center / right`);
  }
  const ro = p?.rule?.object;
  if (!ro?.thing) out.push("the rule object (one physical thing) is missing");
  if (ro && ["in_hand", "next_to", "at_feet"].includes(ro.where) && !cast.some((c) => low(c.name) === low(ro.who))) out.push(`the rule object is ${ro.where} of "${ro.who}", who is not in the cast`);
  return out;
}

export async function planStory3({ callJson, apiKey, script, model = "claude-sonnet-5-5", meter = null }) {
  let costUsd = 0, problems = [], plan = null;
  for (let k = 0; k < 2; k++) {
    const user = `THE SCRIPT (data):\n${numbered(script)}\n\nTHE WRITER'S NOTES: main place ${script.main_place}${script.side_place && script.side_place !== "none" ? `, side place ${script.side_place}` : ""}; rule "${script.rule}"; key sentence "${script.key_sentence}"; loved one ${script.loved_one}; every line's subject / does / shows:\n${script.lines.map((l, i) => `${i + 1}. ${l.subject} | ${l.does} | ${(l.shows ?? []).join(", ")}`).join("\n")}${problems.length ? `\n\nYOUR LAST PLAN BROKE THESE, FIX THEM:\n- ${problems.join("\n- ")}\n${JSON.stringify(plan).slice(0, 5000)}` : ""}`;
    const r = await callJson({ apiKey, model, system: PLAN3_SYSTEM, user, schema: plan3Schema(), effort: "low", maxTokens: 8000, meter, cache: true });
    costUsd += Number(r.costUsd ?? 0);
    plan = r.data;
    problems = plan3Problems(plan, script);
    if (!problems.length) break;
  }
  return { plan: normalPlan(plan, script), problems, costUsd: +costUsd.toFixed(5) };
}
/** the plan in the shape the take compiler reads: stage as a map, scenes with lines [a, b], the rule object on the map */
export function normalPlan(p, script) {
  const stage = {};
  for (const st of p.stage ?? []) {
    const marks = Object.fromEntries((st.marks ?? []).map((m) => [low(m.who) === "me" ? "Me" : m.who, m.mark]));
    stage[st.place] = { camera_side: st.camera_side, monster_starts_here: st.monster_starts_here, marks };
  }
  const ro = p.rule?.object;
  if (ro?.thing && ro.where === "on_ground") for (const st of Object.values(stage)) st.marks[ro.thing] ??= "front";
  const scenes = [...(p.scenes ?? [])].sort((a, b) => a.from_line - b.from_line).map((x, i) => ({ id: i + 1, lines: [x.from_line, x.to_line], place: x.place, time: x.time, busy: x.busy }));
  return { ...p, stage, scenes, title: script.title, rule_sentence: p.rule?.sentence };
}

/**
 * THE STORY-LEVEL CODE CHECKS (rules 10, 12, 18): the rule object in line 1's opening wide with someone doing the rule,
 * the rule object (or the person holding / next to it) in most cuts, push-in the default move (about half), the drain
 * in the open. -> { problems, ruleShare, pushShare }
 */
export function storyChecks(plan, cards) {
  const ro = plan.rule?.object ?? {};
  const holder = low(ro.who);
  const cuts = cards.flatMap((c) => c.cuts ?? []);
  const hasRule = (c) => (c.show ?? []).map(low).some((k) => k === ro.thing || (holder && k === holder && ["in_hand", "next_to", "at_feet"].includes(ro.where)));
  const ruleShare = cuts.length ? cuts.filter(hasRule).length / cuts.length : 0;
  const pushShare = cuts.length ? cuts.filter((c) => c.move === "push_in").length / cuts.length : 0;
  const problems = [];
  const first = cards[0]?.cuts?.[0];
  if (!first || first.shot !== "wide" || !hasRule(first)) problems.push(`line 1's first cut must be a WIDE that shows the rule object (${ro.thing}) with someone doing it (it is: ${first ? `${first.shot} of ${(first.show ?? []).join(", ")}` : "none"})`);
  if (ruleShare < 0.5) problems.push(`the rule object is in ${Math.round(ruleShare * 100)}% of the cuts: most shots (over half) should show it`);
  if (pushShare < 0.35 || pushShare > 0.7) problems.push(`push-in is ${Math.round(pushShare * 100)}% of the moves: the default, about half`);
  for (const [place, st] of Object.entries(plan.stage ?? {})) { const m = st.marks?.drain_grate; if (m && !["back", "back_left", "back_right"].includes(m)) problems.push(`${place}: the drain is at "${m}": big, in the open, behind the cast (back): a monster in the middle blocks every camera (round 8 first test)`); }
  return { problems, ruleShare: +ruleShare.toFixed(2), pushShare: +pushShare.toFixed(2) };
}

// ---------------------------------------------------------------- THE LINE CARDS
export function card3Schema() {
  return obj({
    actions: { type: "array", items: obj({ who: s, do: en(Object.keys(ACTIONS8)), target: s, to: s, on_word: { type: "integer" }, text: s }) },
    faces: { type: "array", items: obj({ who: s, face: en(FACES8) }) },
    cuts: { type: "array", items: obj({ from_word: { type: "integer" }, shot: en(SHOTS8), show: { type: "array", items: s }, move: en(MOVES8) }) },
  });
}
export const CARD3_SYSTEM = `You direct ONE LINE of an "In This Town" video (Roblox-style blocky 3D, 9:16). The scene is ALREADY BUILT and RUNNING: the people stand where THE STATE says, holding what it says. You never place anyone: you only ADD ACTIONS to the running scene (on the line's word numbers) and choose the CAMERA CUTS that look at it.
ACTIONS (who does what, on which word; target = a person / a thing / the monster; to = a mark (${MARKS8.join(", ")}) or a person / thing):
${Object.entries(ACTIONS8).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
- A person who is not in the scene must "enter" first; a thing that is not there must "appear" first; only a held thing can be given / dropped / thrown; the monster must climb_out before it acts. Anything that came in stays until a line removes it.
- Actions read as CAUSE -> EFFECT -> REACTION (Max laughs -> the bulb pops -> Mia cheers).
- faces: the face of every person in the scene for this line.
CUTS (2-3 per line, about one every 1.4 s, each starting on a word; from_word 0 first):
- each cut shows ONE thing: who / what is in "show" (names in lower case, "me", "monster", a thing kind). EVERY NOUN THE LINE NAMES gets its own clear shot (this wins over every other rule). EVERY SHOT SHOWS SOMETHING NEW (never the same shot of the same thing twice in a row).
- shots: wide (the place + everyone: the opening, scale), medium (a person or two, waist up), two (two people), close (one face: reactions), insert (one thing up close), low (from the ground: the monster towering over a tiny person), top (from above: things on the ground).
- moves: push_in (the default, about half the cuts), tilt_up (big things, the monster), track (someone walking or running), top_down (things on the ground), static (rare).
- LINE 1: the first cut is a WIDE that already shows the rule object and someone doing the rule. No glide or drone tours.
- THE RULE OBJECT should be in most shots.
Return only the JSON.`;

const stateText = (S, place) => {
  const P = S[place] ?? { people: {}, things: {}, monster: {} };
  const ppl = Object.entries(P.people).map(([k, p]) => (p.here ? `${k}: at ${p.mark}, ${p.pose}${p.holding ? `, holding ${p.holding}` : ""}, face ${p.face}` : `${k}: NOT in this scene`)).join("; ") || "nobody";
  const th = Object.entries(P.things).map(([k, t]) => (t.held_by ? `${k}: held by ${t.held_by}` : t.here ? `${k}: at ${t.mark}${t.state ? ` (${t.state})` : ""}` : `${k}: not here`)).join("; ") || "none";
  const mon = P.monster?.here ? `the monster: HERE at ${P.monster.mark}` : "the monster: not here";
  return `THE STATE (${place}) at the start of this line: PEOPLE ${ppl}. THINGS ${th}. ${mon}. Lamps ${P.lamps ?? "as the time of day"}, windows ${P.windows ?? "as the time of day"}.`;
};
export function card3User({ plan, script, lines, k, state, sceneOf, prevCut, problems = [], previous = null, feedback = null }) {
  const L = lines[k];
  const sc = sceneOf(k + 1);
  const words = String(L.text).split(/\s+/).filter(Boolean).map((w, i) => `${i}:${w}`).join(" ");
  return [
    `THE STORY (data):\n${numbered(script)}`,
    `THE PLAN: cast ${plan.cast.map((c) => c.name).join(", ")}; rule "${plan.rule?.sentence}" = the rule object ${plan.rule?.object?.thing} (${plan.rule?.object?.where}${plan.rule?.object?.who ? ` ${plan.rule.object.who}` : ""}): ${plan.rule?.object?.what_it_does ?? ""}; ${plan.monster?.present ? `monster: ${plan.monster.style}` : "no monster"}; stage ${sc.place} (camera side ${plan.stage?.[sc.place]?.camera_side ?? "front"}).`,
    `THIS SCENE: ${sc.place}, ${sc.time}, lines ${sc.lines[0]}-${sc.lines[1]}.`,
    stateText(state, sc.place),
    prevCut ? `THE CUT BEFORE THIS LINE: ${prevCut.shot} of ${(prevCut.show ?? []).join(", ")} (${prevCut.move}).` : "",
    `LINE ${k + 1} (${L.end - L.start > 0 ? (L.end - L.start).toFixed(1) : "?"} s, ${Math.max(1, Math.min(3, Math.round((L.end - L.start) / 1.4)))} cut(s)): ${L.speaker && !/^(narrator|me|)$/i.test(L.speaker) ? `[${L.speaker} speaks] ` : ""}"${L.text}"\nTHE WORDS: ${words}\nIt names: ${namedIn(L.text, plan).join(", ") || "-"} (each gets its own clear shot).`,
    previous ? `YOUR PREVIOUS CARD FOR THIS LINE: ${JSON.stringify(previous)}` : "",
    feedback ? `THE CHECK OF THE RENDERED PICTURES SAID: ${feedback}` : "",
    problems.length ? `YOUR CARD WAS REJECTED BY THE CODE (it contradicts the state or the rules), FIX ALL:\n- ${problems.join("\n- ")}` : "",
  ].filter(Boolean).join("\n\n");
}
const toCard = (d, line) => ({ line, actions: (d?.actions ?? []).map((a) => ({ ...a, target: a.target ?? "", to: a.to ?? "", text: a.text ?? "" })), faces: Object.fromEntries((d?.faces ?? []).map((f) => [low(f.who), f.face])), cuts: d?.cuts ?? [] });

/** the code's last fixes on a card it still rejects: invalid actions are dropped (applyCard keeps only the valid), the cuts
 * made legal (start on 0, rising), a named thing nobody shows gets an insert / is added to the nearest cut */
export function fixCuts(card, { line, plan, stateBefore, stateAfter, place }) {
  const nW = String(line.text).split(/\s+/).filter(Boolean).length;
  let cuts = (card.cuts ?? []).filter((c) => SHOTS8.includes(c.shot)).map((c) => ({ ...c, from_word: Math.max(0, Math.min(nW - 1, Number(c.from_word) || 0)), move: MOVES8.includes(c.move) ? c.move : "push_in", show: (c.show ?? []).map(low) }));
  cuts.sort((a, b) => a.from_word - b.from_word);
  cuts = cuts.filter((c, i) => i === 0 || c.from_word > cuts[i - 1].from_word);
  if (!cuts.length) cuts = [{ from_word: 0, shot: "medium", show: [], move: "push_in" }];
  cuts[0].from_word = 0;
  const B = stateBefore[place] ?? { people: {}, things: {}, monster: {} }, A = stateAfter[place] ?? B;
  const inScene = (k) => (k === "monster" ? B.monster?.here || A.monster?.here : (plan.cast ?? []).some((c) => low(c.name) === k) ? B.people?.[k]?.here || A.people?.[k]?.here : B.things?.[k]?.here || A.things?.[k]?.here || B.things?.[k]?.held_by || A.things?.[k]?.held_by);
  for (const c of cuts) c.show = c.show.filter((k) => inScene(k) || ["lamps", "windows"].includes(k));
  for (const k of namedIn(line.text, plan)) {
    if (!inScene(k) || cuts.some((c) => c.show.includes(k))) continue;
    if (cuts.length < 3 && nW > cuts.at(-1).from_word + 1) cuts.push({ from_word: Math.min(nW - 1, cuts.at(-1).from_word + Math.max(1, Math.floor((nW - cuts.at(-1).from_word) / 2))), shot: THINGS.includes(k) ? "insert" : k === "monster" ? "low" : "medium", show: [k], move: k === "monster" ? "tilt_up" : "push_in" });
    else cuts[cuts.length - 1].show.push(k);
  }
  for (const c of cuts) if (!c.show.length) c.show = Object.entries(A.people ?? {}).filter(([, p]) => p.here).map(([n]) => n).slice(0, 2);
  return { ...card, cuts };
}

/**
 * every line's card in order, each written from the state the lines before left. -> { cards, states, log: { rejected,
 * dropped, fixed }, costUsd }. states[n] = the state BEFORE line n (states[N+1] = after the last).
 */
export async function lineCards({ callJson, apiKey, plan, script, lines, model = "claude-sonnet-5-5", meter = null, log = () => {}, from = 1, cards: given = [], states: givenStates = null }) {
  const sceneOf = (n) => plan.scenes.find((x) => n >= x.lines[0] && n <= x.lines[1]);
  const states = givenStates ? [...givenStates] : [];
  let state = states[from] ?? initialState(plan);
  const cards = [...given];
  const book = { rejected: [], dropped: [], fixed: 0 };
  let costUsd = 0;
  for (let n = from; n <= lines.length; n++) {
    const k = n - 1, L = lines[k], sc = sceneOf(n);
    states[n] = state;
    const prevCut = cards[k - 1]?.cuts?.at(-1) ?? null;
    let card = null, problems = [], res = null;
    for (let tr = 0; tr < 2; tr++) {
      const r = await callJson({ apiKey, model, system: CARD3_SYSTEM, user: card3User({ plan, script, lines, k, state, sceneOf, prevCut, problems, previous: card }), schema: card3Schema(), effort: "low", maxTokens: 3000, meter, cache: true });
      costUsd += Number(r.costUsd ?? 0);
      card = toCard(r.data, n);
      res = applyCard(state, card, { place: sc.place, line: L, plan, time: sc.time });
      problems = [...res.problems, ...cutProblems(card, { line: L, plan, stateBefore: state, stateAfter: res.state, place: sc.place, dur: L.end - L.start, prevCut })];
      if (!problems.length) break;
      book.rejected.push({ line: n, try: tr + 1, problems });
    }
    if (problems.length) {
      // still wrong after the rewrite: the code keeps only what agrees with the state and makes the cuts legal
      book.dropped.push(...res.problems.map((p) => ({ line: n, problem: p })));
      card = fixCuts({ ...card, actions: res.applied }, { line: L, plan, stateBefore: state, stateAfter: res.state, place: sc.place });
      book.fixed++;
    } else card = { ...card, actions: res.applied };
    cards[k] = card;
    state = res.state;
    log(`card ${n}/${lines.length}: ${card.actions.length} action(s), ${card.cuts.length} cut(s)${problems.length ? ` (code-fixed: ${problems.length} problem(s))` : ""}`);
  }
  states[lines.length + 1] = state;
  return { cards, states, log: book, costUsd: +costUsd.toFixed(5) };
}

/** a failed line again: the checker's notes, the previous card's end still and its own stills (images), the same state */
export async function redoCard({ callJson, apiKey, plan, script, lines, n, state, card, feedback, images = [], prevCut = null, model = "claude-sonnet-5-5", meter = null }) {
  const sceneOf = (m) => plan.scenes.find((x) => m >= x.lines[0] && m <= x.lines[1]);
  const L = lines[n - 1], sc = sceneOf(n);
  let costUsd = 0, problems = [], out = card, res = null;
  for (let tr = 0; tr < 2; tr++) {
    const text = card3User({ plan, script, lines, k: n - 1, state, sceneOf, prevCut, problems, previous: out, feedback });
    const user = images.length ? [...images.flatMap((im) => [{ type: "text", text: im.label }, { type: "image", source: { type: "base64", media_type: "image/png", data: im.b64 } }]), { type: "text", text }] : text;
    const r = await callJson({ apiKey, model, system: CARD3_SYSTEM, user, schema: card3Schema(), effort: "low", maxTokens: 3000, meter, cache: true });
    costUsd += Number(r.costUsd ?? 0);
    out = toCard(r.data, n);
    res = applyCard(state, out, { place: sc.place, line: L, plan });
    problems = [...res.problems, ...cutProblems(out, { line: L, plan, stateBefore: state, stateAfter: res.state, place: sc.place, dur: L.end - L.start, prevCut })];
    if (!problems.length) break;
  }
  if (problems.length) out = fixCuts({ ...out, actions: res.applied }, { line: L, plan, stateBefore: state, stateAfter: res.state, place: sc.place });
  else out = { ...out, actions: res.applied };
  return { card: out, state: res.state, problems, costUsd: +costUsd.toFixed(5) };
}
