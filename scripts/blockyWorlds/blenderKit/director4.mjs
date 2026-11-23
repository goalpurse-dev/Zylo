// ROUND 9 DIRECTOR (owner 2026-11-23), on top of director3:
//   PLACES      1-3 places (replaces "one stage"), each its own continuous take with its own stage map; the scenes follow
//               the writer's per-line place; cutting back to a place continues from where it was left (the state per place)
//   ON STAGE    the writer's per-line on_stage is the truth: at a scene's first line the people on stage are simply there
//               (and nowhere else); inside a scene the code adds the ENTER (word 0) / EXIT (last word) where the list
//               changes; a card's actions for someone off stage are rejected (applyCard)
//   EVERYONE    a line about everyone / the whole street gets a crowd (8-10 people, each with their own thing)
//   MOVING      a line with a movement verb must move its subject (walk_to / run_to / run_door_to_door / enter / exit /
//               follow / draw_around); a card that does not is rejected; the stills measure it (zs_moved)
import { THINGS } from "../../../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { MOVE_VERBS, EVERYONE } from "../../../supabase/functions/_shared/blockyWorlds/writer4.js";
import { plan3Schema, PLAN3_SYSTEM, plan3Problems, normalPlan, card3Schema, CARD3_SYSTEM, card3User, fixCuts } from "./director3.mjs";
import { applyCard, cutProblems, initialState, MOVE_ACTIONS, kindOf } from "./takes.mjs";

const low = (x) => String(x ?? "").trim().toLowerCase();
const numbered = (script) => script.lines.map((l, i) => `${i + 1}. [${l.place}; on stage: ${(l.on_stage ?? []).join(", ")}]${l.speaker && !/^(narrator|me|)$/i.test(l.speaker) ? ` (${l.speaker} speaks)` : ""} ${l.text}`).join("\n");

export const PLAN4_SYSTEM = PLAN3_SYSTEM
  .replace(/- ONE MAIN PLACE for the whole story, at most ONE short side place \(only if the script truly goes there\)\./, "- THE PLACES: exactly the writer's places (1-3), each with its OWN stage map; every scene's place is the place the writer gave its lines.")
  .replace("CAST: the narrator \"Me\" + the 1-2 named characters of the script (2-3 in all).", "CAST: the narrator \"Me\" + the named characters of the script (2-4 in all).")
  + "\n- WHO IS ON STAGE comes from the writer (per line): a stage map lists where each person stands WHEN they are in that place.";

export function plan4Problems(p, script) {
  const out = plan3Problems(p, script).filter((x) => !/places: one main place|cast members: 2-3/.test(x));
  const sc = p?.scenes ?? [];
  const places = new Set(sc.map((x) => x.place));
  if (places.size > 3) out.push(`${places.size} places: 1-3`);
  if ((p?.cast ?? []).length > 4) out.push(`${p.cast.length} cast members: at most 4 with Me`);
  script.lines.forEach((l, i) => { const x = sc.find((s) => i + 1 >= s.from_line && i + 1 <= s.to_line); if (x && l.place && x.place !== l.place) out.push(`line ${i + 1} is in ${l.place} (the writer), the plan's scene ${x.id} says ${x.place}`); });
  return out;
}

export async function planStory4({ callJson, apiKey, script, model = "claude-sonnet-5-5", meter = null }) {
  let costUsd = 0, problems = [], plan = null;
  for (let k = 0; k < 2; k++) {
    const user = `THE SCRIPT (data, with each line's place and who is on stage):\n${numbered(script)}\n\nTHE WRITER'S NOTES: places ${(script.places ?? []).join(", ")}; rule "${script.rule}"; key sentence "${script.key_sentence}"; loved one ${script.loved_one}; every line's subject / does / shows:\n${script.lines.map((l, i) => `${i + 1}. ${l.subject} | ${l.does} | ${(l.shows ?? []).join(", ")}`).join("\n")}${problems.length ? `\n\nYOUR LAST PLAN BROKE THESE, FIX THEM:\n- ${problems.join("\n- ")}\n${JSON.stringify(plan).slice(0, 5000)}` : ""}`;
    const r = await callJson({ apiKey, model, system: PLAN4_SYSTEM, user, schema: plan3Schema(), effort: "low", maxTokens: 9000, meter, cache: true });
    costUsd += Number(r.costUsd ?? 0);
    plan = r.data;
    problems = plan4Problems(plan, script);
    if (!problems.length) break;
  }
  return { plan: normalPlan(plan, script), problems, costUsd: +costUsd.toFixed(5) };
}

const onStage = (script, n) => new Set((script.lines[n - 1]?.on_stage ?? []).map(low));
/** the subject of a line as a cast key ("I" / "me" -> "me") */
const subjectOf = (script, n, plan) => {
  const s = low(script.lines[n - 1]?.subject);
  if (/^(i|me|my|narrator)$/.test(s)) return "me";
  const c = (plan.cast ?? []).find((x) => s.includes(low(x.name)));
  return c ? low(c.name) : /monster|shadow|creature/.test(s) ? "monster" : null;
};

/** the code's presence actions for line n: enter at word 0 (on stage now, not before, same scene), exit at the last word
 * (on stage now, not in the next line of the same scene); a crowd for "everyone" */
export function autoActions(script, n, plan, state, sceneOf) {
  const L = script.lines[n - 1];
  const nW = String(L.text).split(/\s+/).filter(Boolean).length;
  const sc = sceneOf(n), P = state[sc.place] ?? { people: {}, monster: {} };
  const out = [];
  for (const who of onStage(script, n)) {
    if (who === "monster") continue;   // (the monster climbs out of its drain or walks in: the card says which; checked below)
    if ((plan.cast ?? []).some((c) => low(c.name) === who) && !P.people?.[who]?.here) out.push({ who, do: "enter", target: "", to: "", on_word: 0, text: "", auto: true });
  }
  const next = n < script.lines.length && sceneOf(n + 1).id === sc.id ? onStage(script, n + 1) : null;
  if (next) for (const who of onStage(script, n)) if (who !== "monster" && !next.has(who) && (plan.cast ?? []).some((c) => low(c.name) === who)) out.push({ who, do: "exit", target: "", to: "", on_word: Math.max(0, nW - 2), text: "", auto: true });
  if (EVERYONE.test(L.text)) out.push({ who: "me", do: "crowd", target: plan.rule?.object?.thing && THINGS.includes(kindOf(plan.rule.object.thing)) ? kindOf(plan.rule.object.thing) : "", to: "", on_word: Math.min(1, nW - 1), text: "cheer", auto: true });
  return out;
}
/** at a scene's first line the people on stage are simply THERE (and in no other place); the others are off stage */
export function sceneStartState(state, script, n, plan, sceneOf) {
  const S = JSON.parse(JSON.stringify(state));
  const sc = sceneOf(n);
  const on = onStage(script, n);
  const P = (S[sc.place] ??= { people: {}, things: {}, monster: { here: false, mark: null }, lamps: null, windows: null });
  const marks = plan.stage?.[sc.place]?.marks ?? {};
  for (const c of plan.cast ?? []) {
    const k = low(c.name);
    const here = on.has(k);
    if (here) for (const [pl, Q] of Object.entries(S)) if (pl !== sc.place && Q.people?.[k]) Q.people[k].here = false;
    const prev = P.people[k];
    P.people[k] = { here, mark: prev?.mark ?? marks[c.name] ?? marks[k] ?? "center", pose: prev?.pose ?? "stand", holding: prev?.holding ?? null, face: prev?.face ?? "neutral" };
    // what they hold comes with them
    if (here && P.people[k].holding) P.things[P.people[k].holding] = { ...(P.things[P.people[k].holding] ?? {}), here: true, held_by: k, mark: null };
  }
  if (plan.monster?.present && on.has("monster") && !P.monster?.here) P.monster = { here: true, mark: marks.monster ?? "back" };
  return S;
}

/** the movement rule (item 11) -> [problem] */
export function movementProblems(script, n, plan, card) {
  const L = script.lines[n - 1];
  if (!MOVE_VERBS.test(L.text)) return [];
  const who = subjectOf(script, n, plan);
  if (!who) return [];
  const moves = (card.actions ?? []).some((a) => low(a.who) === who && MOVE_ACTIONS.includes(a.do));
  return moves ? [] : [`the line says ${who} ${L.text.match(MOVE_VERBS)[0]}: ${who} must MOVE through the place (walk_to / run_to / run_door_to_door / enter / exit / follow) on that word, not stay put`];
}

export const CARD4_EXTRA = `ROUND 9: THE NARRATOR TELLS EVERYTHING (no mouths move except the monster's one line). WHO IS ON STAGE comes from the script: never act or show anyone who is not on stage (the code adds the enters / exits). A MOVEMENT VERB MOVES THE SUBJECT through the place: "ran to every door" = run_door_to_door; "sneaks out" = enter / walk_to; "runs inside" = exit. "EVERYONE" = the crowd action (the code adds it). A thing on the ground = an insert / top shot of it alone. A kid + the monster = a low shot of both.`;

/** every line's card in order (round 9: presence, crowds, movement in code). -> { cards, states, log, costUsd } */
export async function lineCards4({ callJson, apiKey, plan, script, lines, model = "claude-sonnet-5-5", meter = null, log = () => {} }) {
  const sceneOf = (n) => plan.scenes.find((x) => n >= x.lines[0] && n <= x.lines[1]);
  const states = [];
  let state = initialState(plan);
  const cards = [];
  const book = { rejected: [], dropped: [], fixed: 0, auto: 0 };
  let costUsd = 0;
  for (let n = 1; n <= lines.length; n++) {
    const k = n - 1, L = lines[k], sc = sceneOf(n);
    if (n === sc.lines[0]) state = sceneStartState(state, script, n, plan, sceneOf);
    states[n] = state;
    const auto = autoActions(script, n, plan, state, sceneOf);
    book.auto += auto.length;
    const prevCut = cards[k - 1]?.cuts?.at(-1) ?? null;
    let card = null, problems = [], res = null;
    for (let tr = 0; tr < 2; tr++) {
      const user = `${card3User({ plan, script, lines, k, state, sceneOf, prevCut, problems, previous: card })}\n\nON STAGE IN THIS LINE: ${[...onStage(script, n)].join(", ") || "-"} (anyone else is off stage).${auto.length ? ` THE CODE ADDS: ${auto.map((a) => `${a.who} ${a.do}${a.target ? " " + a.target : ""}`).join(", ")}.` : ""}\n${CARD4_EXTRA}`;
      const r = await callJson({ apiKey, model, system: CARD3_SYSTEM, user, schema: card3Schema(), effort: "low", maxTokens: 3000, meter, cache: true });
      costUsd += Number(r.costUsd ?? 0);
      const d = r.data;
      card = { line: n, actions: [...auto, ...(d?.actions ?? []).filter((a) => !auto.some((x) => x.who === low(a.who) && x.do === a.do)).map((a) => ({ ...a, target: a.target ?? "", to: a.to ?? "", text: a.text ?? "" }))], faces: Object.fromEntries((d?.faces ?? []).map((f) => [low(f.who), f.face])), cuts: d?.cuts ?? [] };
      res = applyCard(state, card, { place: sc.place, line: L, plan, time: sc.time });
      // nobody off stage acts or is shown
      const on = onStage(script, n);
      const offActs = (card.actions ?? []).filter((a) => !a.auto && (plan.cast ?? []).some((c) => low(c.name) === low(a.who)) && !on.has(low(a.who)));
      const offShows = (card.cuts ?? []).flatMap((c) => c.show ?? []).map(low).filter((x) => ((plan.cast ?? []).some((c) => low(c.name) === x) || x === "monster") && !on.has(x));
      problems = [...res.problems, ...cutProblems(card, { line: L, plan, stateBefore: state, stateAfter: res.state, place: sc.place, dur: L.end - L.start, prevCut }), ...movementProblems(script, n, plan, card),
        ...(onStage(script, n).has("monster") && plan.monster?.present && !res.state[sc.place]?.monster?.here ? ["the monster is on stage in this line: it must climb_out (of its drain) or enter first"] : []),
        ...offActs.map((a) => `${a.who} is OFF STAGE in this line (on stage: ${[...on].join(", ")}): no action for them`), ...[...new Set(offShows)].map((x) => `a cut shows ${x}, who is OFF STAGE in this line`)];
      if (!problems.length) break;
      book.rejected.push({ line: n, try: tr + 1, problems });
    }
    if (problems.length) {
      book.dropped.push(...res.problems.map((p) => ({ line: n, problem: p })));
      const on = onStage(script, n);
      card = fixCuts({ ...card, actions: res.applied.filter((a) => a.auto || !(plan.cast ?? []).some((c) => low(c.name) === low(a.who)) || on.has(low(a.who))) }, { line: L, plan, stateBefore: state, stateAfter: res.state, place: sc.place });
      card.cuts = card.cuts.map((c) => ({ ...c, show: c.show.filter((x) => !(((plan.cast ?? []).some((q) => low(q.name) === x) || x === "monster") && !on.has(x))) })).map((c) => (c.show.length ? c : { ...c, show: [...on].slice(0, 2) }));
      // a movement verb with no movement: the code moves the subject (to the front of the stage, running)
      if (movementProblems(script, n, plan, card).length) { const who = subjectOf(script, n, plan); card.actions.push({ who, do: /ran|run|rush|dash|race|hurr/i.test(L.text) ? "run_to" : "walk_to", target: "", to: "front", on_word: Math.max(0, String(L.text).split(/\s+/).findIndex((w) => MOVE_VERBS.test(w))), text: "", auto: true }); }
      if (onStage(script, n).has("monster") && plan.monster?.present && !applyCard(state, card, { place: sc.place, line: L, plan }).state[sc.place]?.monster?.here) card.actions.unshift({ who: "monster", do: "enter", target: "", to: "back", on_word: 0, text: "", auto: true });
      res = applyCard(state, card, { place: sc.place, line: L, plan, time: sc.time });
      card = { ...card, actions: res.applied };
      book.fixed++;
    } else card = { ...card, actions: res.applied };
    cards[k] = card;
    state = res.state;
    log(`card ${n}/${lines.length}: ${card.actions.length} action(s) (${auto.length} by the code), ${card.cuts.length} cut(s)${problems.length ? ` (code-fixed: ${problems.length})` : ""}`);
  }
  states[lines.length + 1] = state;
  return { cards, states, log: book, costUsd: +costUsd.toFixed(5) };
}
