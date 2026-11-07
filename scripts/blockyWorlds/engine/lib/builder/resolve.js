// Blocky Worlds builder: resolveNeeds, the owner's rule "a missing kit object or world never fails a run".
// For every need (plan.mjs collectNeeds, or an object the kit can't build), in parallel:
//   1. the kit            kit.has(need) -> a kit name                                     (free, instant)
//   2. the library        cache.lookup(kind, [name, phrase])                             (free, instant)
//   3. design + check     provider.designObject / designWorld -> spec.js validation -> a still (render) -> vision;
//                         a miss is retried with the vision's fix (or the validation problems), at most 2 retries
//   4. not made           source "card" (the name is kept for the callers; NO PICTURE CARD is ever drawn: owner,
//                         PERMANENT 2026-11-07) when all that fails, the money or time runs out, or the provider is
//                         off: lib/builder/apply.js leaves the closest real shot and writes the thing to shot.unshown.
//                         Never a failed run: nothing here throws.
// Everything built and passed is saved to the library (blueprint + still + name/aliases + verdict).
//   resolveNeeds(needs, { provider, cache, render, kit, budget: { maxUsd, maxMs, maxDesigns }, idea, log })
//     -> { results: { [needId]: result }, report: { costUsd, ms, designs, visionCalls, cards, built, cached, kit, byNeed } }
//   result = { needId, kind, name, source: "kit" | "cache" | "built" | "card", asset?, kitName?, card?, attempts,
//              costUsd, ms, reason?, verdicts: [] }
import { normName, validateBlueprint, validateWorld } from "./spec.js";
import { cardLabel } from "../planText.js";

export const DEFAULT_BUDGET = Object.freeze({ maxUsd: 0.6, maxMs: 120000, maxDesigns: 6, minConfidence: 0.6, retries: 2, parallel: 3 });

const ICONS = { robot: "🤖", tooth: "🦷", dentist: "🦷", turtle: "🐢", moon: "🌙", space: "🚀", sea: "🌊", underwater: "🌊", cave: "🕳️", water: "💧", puddle: "💧", flood: "🌊", leak: "💧", drip: "💧", bathtub: "🛁", bath: "🛁", golf: "⛳", kazoo: "🎺", curtain: "🪟", curtains: "🪟", pumpkin: "🎃", ladder: "🪜" };
/** "not made": the label of the thing that stays unshown (no card is drawn from it: lib/cards.js) */
export function cardOf(need) {
  const words = normName(need.phrase || need.name).split(" ");
  const icon = words.map((w) => ICONS[w]).find(Boolean) ?? "✨";
  return { kind: "card", text: cardLabel(need.phrase || need.name), icon };
}

/**
 * One shared purse per video (2026-11-07 rework; the turtle / dog test runs carded 4 of 5 needs as "money cap ($0.25)
 * reached" after $0.05 of real spend: every parallel design reserved its WORST case ($0.13), so the second one never fit).
 *   - the actual spend never passes maxUsd: the worst cases of the calls IN FLIGHT plus what is spent always fit
 *     (a call's worst case is bounded by its max_tokens; `min` lets the last call of a video run with a smaller ceiling)
 *   - a call that does not fit right now WAITS for one in flight to settle (it used to give up at once)
 *   - a need is given up only when the realistic estimate (measured typical cost, `est`) no longer fits, or when nothing
 *     is in flight and even the smallest ceiling does not fit
 *   - at most `parallel` designs run at once, so reservations don't starve each other
 * acquire({ est, worst, min }, deadline) -> { worst: granted ceiling USD, est } | { stop: reason }; release(grant, actualUsd)
 */
export function makePurse({ maxUsd, maxDesigns = Infinity, parallel = 3 }) {
  let spent = 0, rWorst = 0, rEst = 0, designs = 0, inflight = 0;
  let waiters = [];
  const wake = () => { const w = waiters; waiters = []; for (const f of w) f(); };
  const EPS = 1e-9;
  /** "ok" + the granted ceiling, "wait", or "stop" */
  const decide = ({ est = 0, worst = 0, min = worst }) => {
    if (inflight >= parallel) return { wait: true };
    if (spent + rEst + est > maxUsd + EPS) return inflight ? { wait: true } : { stop: "estimate" };
    const room = maxUsd - spent - rWorst, granted = Math.min(worst, room);
    if (granted + EPS >= min) return { granted };
    return inflight ? { wait: true } : { stop: "worst" };
  };
  const take = (est, granted) => { rWorst += granted; rEst += est; inflight++; return { worst: granted, est }; };
  return {
    get spent() { return spent; }, get designs() { return designs; }, get inflight() { return inflight; }, maxUsd,
    /** synchronous: a grant or null (no waiting) */
    tryAcquire(c) { const d = decide(c); return d.granted != null ? take(c.est ?? 0, d.granted) : null; },
    async acquire(c, deadline = Infinity) {
      for (;;) {
        const d = decide(c);
        if (d.granted != null) return take(c.est ?? 0, d.granted);
        if (d.stop) return { stop: d.stop };
        const left = deadline - Date.now();
        if (left <= 0) return { stop: "time" };
        let t;
        await new Promise((res) => { waiters.push(res); t = setTimeout(res, Math.min(left, 60000)); });
        clearTimeout(t);
      }
    },
    /** a grant's call(s) ended: the reservation goes, the actual cost is spent */
    release(grant, actualUsd) {
      if (!grant || grant.stop) return;
      rWorst = Math.max(0, rWorst - grant.worst); rEst = Math.max(0, rEst - grant.est); inflight = Math.max(0, inflight - 1);
      spent += Math.max(0, Number(actualUsd) || 0); wake();
    },
    /** the old one-shot API (kept for callers that only need "does this worst case fit now") */
    reserve(usd) { if (spent + rWorst + usd > maxUsd + EPS) return false; rWorst += usd; return true; },
    settle(reservedUsd, actualUsd) { rWorst = Math.max(0, rWorst - reservedUsd); spent += Math.max(0, Number(actualUsd) || 0); wake(); },
    takeDesign() { if (designs >= maxDesigns) return false; designs++; return true; },
  };
}

// ---------------------------------------------------------------------------------------------- the word guard
// The builder is only for concrete THINGS (an object or a creature someone could point at). The test runs asked it to
// design "nos", "bite", "block", "soggy", "dusty": each a paid design for a word that is no thing. PLANNER-FIX stops
// those at the source; this is the builder's own last check (free, no call).
const SHORT_NOUNS = new Set("cat dog cow pig hen owl fox bat bee ant elk emu yak ram ewe bug car bus van cab jet ufo hat cap bag box cup mug jar pot pan can key map pen bed rug mat tub saw axe hoe toy kit egg pie bun ham log net web kite oar ray bow gun cot fan lid sub ark ice".split(" "));
const NOT_THINGS = new Set([
  // verbs
  ..."bite bites run runs jump jumps eat eats sleep sleeps fall falls swim swims walk walks look looks see hide cry laugh smile bark barks sniff sniffs hop hops sit sits stand stands wait go come play kick push pull grab hold throw catch roar roars scream screams shout yell sing dance chase climb climbs crash crashes break breaks fix open close help find lose wake dig digs chew lick growl stomp stomps blink nod drop roll spin shake hit hits shiver snap snaps lunge clamp fire fired grabbed ran fell".split(" "),
  // adjectives / adverbs / colours
  ..."soggy dusty muddy rusty shiny scary happy sleepy tiny funny angry hungry sticky smelly stinky fluffy fuzzy spooky creepy windy rainy sunny foggy snowy icy dirty messy noisy quiet loud big small huge giant little old new young wet dry hot cold warm red blue green yellow orange purple pink black white brown grey gray golden silver dark bright broken cracked faded empty full first last next only very really always never suddenly slowly quickly".split(" "),
  // body parts (a part of a character, not a thing to build; tooth / bone / skull stay buildable)
  ..."hand hands arm arms leg legs foot feet head face eye eyes ear ears nose mouth finger fingers toe toes knee knees neck back belly tummy hair lip lips chin cheek cheeks shoulder elbow skin paw paws tail tongue".split(" "),
  // non-things and fillers
  ..."block blocks thing things stuff something nothing everything anything one ones it them way time day night moment place side part bit lot kind sort end start top bottom front middle nos yes no okay ok love fear hope idea story luck silence noise sound smell rule rules promise secret plan trouble problem reason life world everyone someone nobody people".split(" "),
]);
const PREPS = /\s(on|in|of|with|at|under|over|by|for|from|near|inside|behind|above|below|into|onto)\s.*$/;
/** -> { ok: true } | { ok: false, why } : is this need a concrete object / creature the builder may design? (worlds: always ok) */
export function buildableNeed(need) {
  if (need?.kind === "world") return { ok: true };
  const raw = String(need?.name ?? "").trim();
  if (!raw) return { ok: false, why: "no name" };
  // a proper name ("Biscuit", "Mr Plunk") is a character, not a thing (lowercase planner names pass)
  if (/^[A-Z][a-z]+( [A-Z][a-z]+)*$/.test(raw) && !NOT_THINGS.has(raw.toLowerCase()) && raw.split(" ").length <= 2 && !SHORT_NOUNS.has(raw.toLowerCase())) return { ok: false, why: `"${raw}" looks like a name` };
  const words = normName(raw).replace(PREPS, "").split(" ").filter((w) => w && !/^(a|an|the|some|my|our|his|her|their|its)$/.test(w));
  const head = words.at(-1) ?? "";
  if (!head) return { ok: false, why: "no noun" };
  if (NOT_THINGS.has(head)) return { ok: false, why: `"${head}" is not a thing (verb, describing word, body part or filler)` };
  const stem = head.replace(/ing$/, ""), stems = head.endsWith("ing") ? [stem, stem.replace(/(.)\1$/, "$1"), `${stem}e`] : [];
  if (stems.some((x) => NOT_THINGS.has(x))) return { ok: false, why: `"${head}" is a verb` };
  if (head.length < 3 || (head.length === 3 && !SHORT_NOUNS.has(head))) return { ok: false, why: `"${head}" is too short to be a known thing` };
  if (/(ly|ous|ful|less|ness|ish)$/.test(head) && head.length > 5) return { ok: false, why: `"${head}" is not a noun of a thing` };
  return { ok: true };
}

const withDeadline = (p, deadline, what) => {
  const left = deadline - Date.now();
  if (left <= 0) return Promise.reject(Object.assign(new Error(`time cap reached before ${what}`), { timeout: true }));
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error(`time cap reached during ${what}`), { timeout: true })), left); })]).finally(() => clearTimeout(t));
};

export async function resolveNeeds(needs, { provider = null, cache = null, render = null, kit = null, budget = {}, log = () => {}, purse: sharedPurse = null, memo = null, t0: start = null, offReason = null } = {}) {
  const B = { ...DEFAULT_BUDGET, ...budget };
  // purse / memo / t0 may be shared by several calls of one video (index.js: the early prefetch and the final pass);
  // budget.until (epoch ms) is a hard end on top of maxMs (the prepare job's own time limit)
  const t0 = start ?? Date.now(), deadline = Math.min(t0 + B.maxMs, Number(B.until) || Infinity), purse = sharedPurse ?? makePurse(B);
  const results = {};
  // one job per distinct thing (two lines needing "ladder" share one design)
  const groups = new Map();
  for (const n of needs ?? []) { const k = `${n.kind}|${normName(n.name)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
  let visionCalls = 0;

  async function one(need) {
    const r = { needId: need.id, kind: need.kind, name: need.name, source: "card", attempts: 0, costUsd: 0, ms: 0, verdicts: [] };
    const s0 = Date.now();
    const done = (patch) => { Object.assign(r, patch, { ms: Date.now() - s0 }); if (r.source === "card") r.card ??= cardOf(need); return r; };
    try {
      // 1. the kit
      const kitName = kit?.has?.(need) ?? null;
      if (kitName) return done({ source: "kit", kitName });
      // 2. the library
      try {
        const hit = await cache?.lookup(need.kind, [need.name, need.phrase].filter(Boolean));
        if (hit) { cache.used?.(hit.id)?.catch?.(() => {}); return done({ source: "cache", asset: hit }); }
      } catch (e) { log(`library lookup failed for "${need.name}": ${e.message}`); }
      // 3. design + check
      if (!provider || !render) return done({ reason: provider ? "no still renderer" : offReason ?? "the builder is off (no provider)" });
      if (purse.stillBroken) return done({ reason: `the still renderer failed (${purse.stillBroken}): no design is bought without a way to check it` });
      const word = buildableNeed(need);
      if (!word.ok) { log(`need "${need.name}": not designed (${word.why})`); return done({ reason: `not a buildable thing: ${word.why}`, notAThing: true }); }
      if (!purse.takeDesign()) return done({ reason: `more than ${B.maxDesigns} new designs in one video` });
      let feedback = null, last = null;
      for (let attempt = 1; attempt <= 1 + B.retries; attempt++) {
        r.attempts = attempt;
        // the reservation: the worst cases bound the actual spend, the measured typical cost decides whether to go on
        const visionCost = provider.worstCase?.(need.kind, "vision") ?? 0, designWorst = provider.worstCase?.(need.kind, "design") ?? 0;
        const est = (provider.typicalCase?.(need.kind, "design") ?? designWorst) + (provider.typicalCase?.(need.kind, "vision") ?? visionCost);
        const min = (provider.minCase?.(need.kind, "design") ?? designWorst) + visionCost;
        const w0 = Date.now();
        const grant = await purse.acquire({ est, worst: designWorst + visionCost, min }, deadline);
        if (grant.stop) return done({ reason: grant.stop === "time" ? "time cap reached while waiting for the money cap" : `money cap ($${B.maxUsd}) reached ($${purse.spent.toFixed(4)} spent)` });
        if (Date.now() - w0 > 50) log(`need "${need.name}": waited ${Date.now() - w0} ms for the purse`);
        let callSpent = 0;
        let settled = false;
        const settle = () => { if (!settled) { settled = true; purse.release(grant, callSpent); } };
        const designCap = grant.worst - visionCost; // < designWorst only for the last call that fits (a smaller max_tokens)
        let spec, problems, still;
        try {
          const d = await withDeadline(need.kind === "world" ? provider.designWorld({ need, feedback, attempt, maxUsd: designCap }) : provider.designObject({ need, feedback, attempt, maxUsd: designCap }), deadline, "the design");
          callSpent += Number(d.costUsd) || 0; r.costUsd += d.costUsd ?? 0;
          ({ blueprint: spec, problems } = need.kind === "world" ? (({ spec: s, problems: p }) => ({ blueprint: s, problems: p }))(validateWorld(d.data)) : validateBlueprint(d.data));
          if (d.data?.generic) spec.generic = true; // (mock) a labelled crate
          spec.name = need.name; // the library keys it by the need's name; the designer's words become aliases
          spec.aliases = [...new Set([...(spec.aliases ?? []), d.data?.name, need.phrase].filter(Boolean))].slice(0, 12);
        } catch (e) {
          callSpent += Number(e.costUsd) || 0; r.costUsd += e.costUsd ?? 0; settle();
          if (e.timeout) return done({ reason: e.message });
          if (e.balance) return done({ reason: "the AI account is out of credit" });
          feedback = e.refused ? "the last try was declined; design a friendly, simple, PG version" : `the last reply failed (${String(e.message).slice(0, 120)})`;
          r.verdicts.push({ attempt, error: String(e.message).slice(0, 200) }); continue;
        }
        const empty = need.kind === "world" ? false : !spec.parts.length;
        const serious = problems.filter((p) => !/only the first|used twice/.test(p));
        if (empty || serious.length > Math.max(4, (spec.parts?.length ?? 0) / 3)) {
          settle();
          feedback = `the blueprint had problems: ${serious.slice(0, 8).join("; ")}`;
          r.verdicts.push({ attempt, problems: serious.slice(0, 8) }); continue;
        }
        // the still: a failure is the renderer's, not the design's, so it is tried once more with the SAME blueprint and
        // never answered with a new (paid) design; a renderer that fails twice stops every design of this video
        // (run 707609b1: Chrome could not start in the prepare job, every still failed, each failure bought a new design:
        // $0.23 for 0 things built)
        try {
          const name = `${need.kind}-${normName(need.name).replace(/ /g, "_")}-${attempt}`;
          try { still = await withDeadline(render(need.kind, spec, { name }), deadline, "the still"); }
          catch (e) { if (e.timeout) throw e; r.verdicts.push({ attempt, error: `still: ${String(e.message).slice(0, 200)} (tried again)` }); still = await withDeadline(render(need.kind, spec, { name: `${name}b` }), deadline, "the still"); }
        } catch (e) {
          settle();
          if (e.timeout) return done({ reason: e.message });
          purse.stillBroken ??= String(e.message).slice(0, 160);
          r.verdicts.push({ attempt, error: `still: ${String(e.message).slice(0, 200)}` });
          return done({ reason: `the still renderer failed: ${String(e.message).slice(0, 160)}` });
        }
        let v;
        try { visionCalls++; v = await withDeadline(provider.vision({ need, kind: need.kind, still, spec, attempt }), deadline, "the vision check"); callSpent += Number(v.costUsd) || 0; r.costUsd += v.costUsd ?? 0; settle(); }
        catch (e) { callSpent += Number(e.costUsd) || 0; settle(); r.costUsd += e.costUsd ?? 0; if (e.timeout) return done({ reason: e.message }); r.verdicts.push({ attempt, error: `vision: ${String(e.message).slice(0, 200)}` }); continue; }
        const verdict = { attempt, ...v.data, still: still.file ?? null };
        r.verdicts.push(verdict); last = { spec, still, verdict };
        if (v.data.ok && v.data.confidence >= B.minConfidence) {
          let asset = { id: `local-${normName(need.name).replace(/ /g, "_")}`, kind: need.kind, name: need.name, aliases: spec.aliases, blueprint: spec, still_path: still.file ?? null, verdict };
          try { if (cache) asset = await cache.save({ kind: need.kind, name: need.name, aliases: spec.aliases, blueprint: spec, still: still.jpeg ?? null, verdict: { ...verdict, attempts: attempt }, model: provider.designModel ?? provider.name, costUsd: r.costUsd }); }
          catch (e) { log(`library save failed for "${need.name}": ${e.message}`); }
          return done({ source: "built", asset });
        }
        feedback = v.data.fix || `it read as "${v.data.reads_as}", not as ${need.name}`;
      }
      void last;
      return done({ reason: `not clear after ${r.attempts} tries` });
    } catch (e) {
      return done({ reason: `builder error: ${String(e.message).slice(0, 200)}` });
    }
  }

  await Promise.all([...groups.values()].map(async (list) => {
    const key = `${list[0].kind}|${normName(list[0].name)}`;
    let p = memo?.get(key);
    if (!p) { p = one(list[0]); memo?.set(key, p); }
    const r = await p;
    for (const n of list) results[n.id] = { ...r, needId: n.id, ...(r.source === "card" ? { card: cardOf(n) } : {}) };
    log(`need "${list[0].name}" (${list[0].kind}): ${r.source}${r.reason ? ` (${r.reason})` : ""}, ${r.attempts} tries, $${r.costUsd.toFixed(4)}, ${r.ms} ms`);
  }));
  const all = Object.values(results), uniq = [...groups.values()].map((l) => results[l[0].id]);
  const report = {
    costUsd: Number(uniq.reduce((s, r) => s + r.costUsd, 0).toFixed(5)), ms: Date.now() - t0,
    designs: purse.designs, visionCalls,
    kit: all.filter((r) => r.source === "kit").length, cached: all.filter((r) => r.source === "cache").length,
    built: all.filter((r) => r.source === "built").length, cards: all.filter((r) => r.source === "card").length,
    byNeed: uniq.map((r) => ({ name: r.name, kind: r.kind, source: r.source, attempts: r.attempts, costUsd: Number(r.costUsd.toFixed(5)), ms: r.ms, reason: r.reason ?? null, verdicts: r.verdicts.map(({ still, ...v }) => ({ ...v, still: still ? String(still).split(/[\\/]/).pop() : null })) })),
  };
  return { results, report };
}
