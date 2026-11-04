// Blocky Worlds planner: who (or what) each line is about (owner: PLANNER). Pure, deterministic, Node + browser.
//
// The owner's rule (2026-11-04): the subject of a line is on screen and is its shot's focus. "Still looking for
// Barnaby." after "It walked right past me" is the monster, not the kid; "She screamed..." is Bean; "He said..." is
// Grandpa. This file resolves every sentence's subject:
//
//   subjectOf(line, ctx) -> { id, kind, label, via, with, absent, sentences: [{ k0, k1, id, kind, via, with, absent }], refs }
//     line: a text (or { text }); ctx carries the story so far (call it once per line, in order: it remembers who was
//     mentioned, the last subjects, the monster, recent things). ctx: { people: Map|object (id -> { name, baby?, gender? }
//     or a name), alias ({ sister: "bean" }), narrator ("Pip"), monster ({ key, name } | null), looseNames, gender? }
//
//   id: "me" (the narrator) | a cast id | "monster" | "group" (we / everyone / the whole town) | "babies" (every baby)
//       | "someone" (a person nobody named: the mayor, a kid) | "thing:<label>" (the water tower, every window) | null
//   with: who the sentence acts ON (must be in frame too): "It walked right past me" -> ["me"]; "Mom grabbed Bean" -> ["bean"]
//   absent: the sentence says the subject is gone ("It never came back.")
//   refs: { tokenIndex: castId } for every he / she / him / her / they / them resolved to a person
//
// The rules, in order, per sentence:
//   1. skip openers ("And", "Then", "Now", "Still", "You see,", "That's when"), and a leading phrase up to its comma
//      ("Until one night,", "In this town, if you talk above a whisper,")
//   2. a fragment (no finite verb: "Long arms.", "Barnaby!", "Still looking for Barnaby.", "Past the school.") is about
//      the subject before it, unless it names a cast member or the narrator ("Until me.")
//   3. I / I'm -> the narrator; we / us / everyone / nobody / the whole town -> group; he / she -> the most recently
//      mentioned person of that gender (mom / grandma / sister / Mrs. = she, dad / grandpa / brother / Mr. = he, common
//      first names; a name of unknown gender: the most recent person); they -> the last group; it -> the monster or a
//      non-human thing, never a person (a thing for "it was / it meant" when a thing was just named; else the monster
//      when it was a recent subject; else the last thing)
//   4. a name, a family word, a title -> that person; "the Listener" / "something" -> the monster; "the water tower" ->
//      a thing; "my best friend is my baby sister" -> the person after the copula; a body part / name / voice -> its
//      owner ("Her real name's a secret" -> her; "A head shaped like..." -> the subject before)
//   5. an imperative ("Say yours too loud, and it comes down") -> the next clause's subject
import { cleanTokens, extractKeys, ruleById } from "./visuals.js";
import { norm } from "./planText.js";

const FEM_WORD = /^(mom|mum|mommy|mama|mother|grandma|granny|nana|grandmother|sister|aunt|auntie|mrs|ms|miss|lady|girl|woman|queen|princess|daughter|niece|wife|madam|she|her)$/;
const MASC_WORD = /^(dad|daddy|papa|father|grandpa|grandad|grandfather|brother|uncle|mr|sir|man|boy|king|prince|son|nephew|husband|he|him)$/;
const FEM_NAMES = new Set(("ada alice amelia anna ava bea bella betty clara chloe daisy dolly edna ella ellie emma eva gina grace hazel ida " +
  "isabella ivy jane june kate lily lola lucy luna mabel mae maria mary matilda maya mia milly molly nina nora olivia peggy penny polly " +
  "poppy rosa rose ruby ruth sally sara sarah sophia stella susan tilly tina violet wren zoe").split(" "));
const MASC_NAMES = new Set(("al arthur barney ben bob carl dan dave ed eddie felix fred gus hank harry hugo jack jake jim joe john leo liam " +
  "louis max mike nick noah ollie oscar otto pete rudy sam ted theo tom tony walt will").split(" "));

/** "f" | "m" | null for a cast member: family word / title / alias relation / common first name; unknown names: null. */
export function genderOf(id, person = {}, alias = {}) {
  if (person?.gender === "f" || person?.gender === "m") return person.gender;
  const w = String(id ?? "").toLowerCase();
  if (FEM_WORD.test(w)) return "f";
  if (MASC_WORD.test(w)) return "m";
  const name = String(person?.name ?? "");
  const parts = name.split(/[\s.]+/).map(norm).filter(Boolean);
  if (parts[0] && FEM_WORD.test(parts[0])) return "f";
  if (parts[0] && MASC_WORD.test(parts[0])) return "m";
  for (const [rel, who] of Object.entries(alias ?? {})) if (who === id) { if (FEM_WORD.test(rel)) return "f"; if (MASC_WORD.test(rel)) return "m"; }
  for (const p of [w, ...parts]) { if (FEM_NAMES.has(p)) return "f"; if (MASC_NAMES.has(p)) return "m"; }
  return null;
}

// ------------------------------------------------------------------ word lists
const OPENER = /^(and|but|so|then|now|even|still|just|only|also|well|oh|plus|anyway|besides|meanwhile|suddenly|finally|later|soon|instead|sometimes|usually|yes|okay|ok)$/;
const LEAD = /^(in|on|at|up|down|until|till|if|when|whenever|after|before|during|with|by|from|under|over|behind|inside|outside|since|because|while|as|once|every|each|last|next|one|that|this|out|across|through|near|around|for|without|past|into|onto|toward|towards|beside|between|above|below|back|way|far|deep|high|later|tonight|today|yesterday|tomorrow)$/;
const PREP = /^(in|on|at|of|from|with|by|for|to|near|under|over|behind|inside|outside|past|like|into|onto|toward|towards|through|across|around|about|after|before|until|till|than|beside|between|above|below|up|down|off|out|away)$/;
const ADVERB = /^(never|just|only|always|still|also|even|really|all|here|there|now|once|again|ever|sometimes|usually|often|already|finally|suddenly|right|too|very|so|almost|nearly|quietly|slowly|then)$/;
const DET = /^(the|a|an|this|that|these|those|every|each|some|any|all|no|one|two|three|four|five|six|seven|eight|nine|ten|both|several|many|most|few|our|my|his|her|their|its|your|whole)$/;
const POSS_DET = /^(my|our|his|her|their|its|your)$/;
const AUX = /^(is|are|was|were|am|be|been|has|have|had|do|does|did|can|cant|could|couldnt|will|wont|would|wouldnt|should|shouldnt|must|may|might|doesnt|dont|didnt|isnt|wasnt|arent|werent|aint|shall)$/;
const VERB = new RegExp("^(" + ("gets|got|goes|went|keeps|kept|keep|says|said|say|makes|made|takes|took|knows|knew|know|comes|came|runs|ran|sat|sits|stands|stood|plays|hears|heard|" +
  "sees|saw|needs|wants|owns|own|lives|loves|turned|walked|walks|stops|started|starts|became|becomes|feels|felt|looks|seems|means|meant|told|tells|" +
  "calls|call|gave|gives|found|finds|brought|brings|left|leaves|eats|ate|wears|wore|holds|held|reads|read|sings|sang|cries|screams|yells|talks|talk|" +
  "learns|climbs|flew|blew|tries|thinks|thought|hates|rules|works|happens|listens|smells|waits|watches|wake|woke|slept|sleeps|threw|throws|fell|falls|" +
  "grew|grows|hid|hides|rang|rings|rose|rises|shook|shakes|spoke|speaks|stole|steals|swam|swims|taught|teaches|tore|wrote|writes|won|wins|broke|breaks|" +
  "began|begins|bit|bites|built|builds|caught|catches|chose|drew|draws|drove|drives|dug|fed|feeds|fought|fights|forgot|forgets|froze|freezes|hung|hit|" +
  "hurt|kept|led|leads|lent|let|lit|lost|loses|paid|pays|put|puts|quit|quits|ran|rode|rides|sent|sends|set|shot|shut|slid|spent|spun|stuck|stung|" +
  "swept|swung|tossed|wept|wound|have|has|sneezes|blows|floats|moves|opens|closes|jumps|hops|smiles|laughs|whispers|shouts|walk|run|need|want|love|hate|stop|stay|stays|go") + ")$");
const NOT_ED = new Set(["bed", "red", "shed", "sled", "hundred", "naked", "wicked", "sacred", "kindred", "ragged", "jagged", "beloved", "rugged", "crooked", "need", "seed", "weed", "speed", "feed", "breed", "deed"]);
const GROUP_WORD = /^(we|us|everyone|everybody|nobody|people|townsfolk|neighbors|neighbours|kids|children|grownups|adults|parents|families|friends|guests|players|fans|crowd|team|everybodys|everyones|all)$/;
const PERSON_WORD = /^(kid|man|woman|girl|boy|teacher|mayor|coach|principal|sheriff|officer|doctor|nurse|mailman|postman|neighbor|neighbour|stranger|lady|guy|baker|driver|farmer|person|grownup|adult|friend|cousin|twin|uncle|aunt|chef|clown|mime|cop|guard|janitor|librarian|pilot|captain|king|queen)$/;
const RELATIONAL = /^(friend|sidekick|partner|buddy|hero|enemy|twin|favorite|favourite|neighbor|neighbour)$/;
const BODY = /^(arm|arms|leg|legs|head|heads|eye|eyes|ear|ears|hand|hands|foot|feet|face|faces|mouth|mouths|voice|voices|name|names|lung|lungs|teeth|tooth|hair|shadow|fur|claw|claws|breath|finger|fingers|nose|lip|lips|tail|tummy|belly|stomach|back|shoulder|shoulders|knee|knees|scream|laugh|smile|cry|snore|sneeze)$/;
const STATIVE = /^(was|is|s|meant|means|costs|cost|seemed|seems|sounded|sounds|happened|happens|became|becomes|felt|feels|looked|looks|worked|works|broke|went|got|tasted|tastes|smelled|smells|fit|fits|belonged|belongs|stayed|stays|stood|stands|said|says|read|reads)$/;
const ABSENT = /\b(never came back|never come back|never returned|never seen again|was gone|were gone|is gone|are gone|left town|left for good|disappeared|vanished)\b/;
const MONSTER_WORD = /^(monster|creature|beast|thing)$/;

const isVerbTok = (t) => {
  if (!t) return false;
  const c = t.c;
  if (AUX.test(c) || VERB.test(c)) return true;
  if (/'(s|re|m|ve|ll|d)$/i.test(t.raw.replace(/[.,!?;:"]+$/, "")) && /^(it|he|she|that|there|here|what|who|they|we|you|i)'/i.test(t.raw.replace(/[’‘]/g, "'"))) return true;
  if (/^(im|ive|id|ill|hes|shes|its|thats|theres|theyre|youre|weve|theyve|whats)$/.test(c) && /'/.test(t.raw.replace(/[’‘]/g, "'"))) return true;
  if (/ed$/.test(c) && c.length > 4 && !NOT_ED.has(c)) return true;
  return false;
};

// ------------------------------------------------------------------ the context
function normCtx(ctx) {
  if (ctx._n) return ctx._n;
  const people = ctx.people instanceof Map ? new Map([...ctx.people].map(([id, p]) => [id, typeof p === "string" ? { name: p } : { ...p }]))
    : new Map(Object.entries(ctx.people ?? {}).map(([id, p]) => [id, typeof p === "string" ? { name: p } : { ...p }]));
  people.delete("me");
  const alias = ctx.alias ?? {};
  const monster = ctx.monster ? { key: ctx.monster.key ?? norm(String(ctx.monster.name ?? "").replace(/^the\s+/i, "")), name: ctx.monster.name ?? "the monster" } : null;
  const vw = { people, alias, narrator: ctx.narrator ?? "Me", monster, looseNames: new Set(ctx.looseNames ?? []), prop: ctx.prop ?? null };
  const gender = { ...(ctx.gender ?? {}) };
  const genderFor = (id) => {
    if (id in gender) return gender[id];
    return (gender[id] = genderOf(id, people.get(id) ?? { name: id }, alias));
  };
  ctx._n = { vw, genderFor, state: { n: 0, persons: [], subjects: [], things: [], monsterAt: -99 } };
  return ctx._n;
}

const recentPerson = (st, pred) => { for (let i = st.persons.length - 1; i >= 0; i--) if (pred(st.persons[i])) return st.persons[i]; return null; };
const touch = (st, id) => { if (!id || id === "me") return; const i = st.persons.indexOf(id); if (i >= 0) st.persons.splice(i, 1); st.persons.push(id); };

/** he / she / him / her -> a person (never the narrator): by gender, else the most recent person of unknown gender. */
function resolveGendered(word, N) {
  const g = /^(she|her|hers|herself)$/.test(word) ? "f" : "m";
  const st = N.state;
  return recentPerson(st, (id) => N.genderFor(id) === g) ?? recentPerson(st, (id) => N.genderFor(id) == null) ?? null;
}

/** it -> the monster or a recent non-human thing (never a person). */
function resolveIt(toks, k, i1, N) {
  const st = N.state;
  let j = k + 1;
  while (j <= i1 && (ADVERB.test(toks[j].c) || /^(doesnt|dont|didnt|cant|wont|isnt|wasnt|couldnt|wouldnt|can|could|will|would|did|does)$/.test(toks[j].c))) j++;
  const contracted = /^it'?s$/i.test(toks[k].raw.replace(/[’‘]/g, "'").replace(/[.,!?;:"]+$/, "")) && /'/.test(toks[k].raw.replace(/[’‘]/g, "'"));
  const stative = contracted || (j <= i1 && STATIVE.test(toks[j].c));
  const thing = [...st.things].reverse().find((t) => t.n >= st.n - 2) ?? null;
  const monsterRecent = !!N.vw.monster && (st.n - st.monsterAt <= 10 || st.subjects.slice(-6).some((s) => s.id === "monster"));
  if (stative && thing) return { id: `thing:${thing.label}`, kind: "thing", via: "it=thing" };
  if (monsterRecent) return { id: "monster", kind: "monster", via: "it=monster" };
  if (thing) return { id: `thing:${thing.label}`, kind: "thing", via: "it=thing" };
  if (N.vw.monster) return { id: "monster", kind: "monster", via: "it=monster" };
  return { id: null, kind: null, via: "it=?" };
}

const singular = (w) => /ies$/.test(w) ? w.slice(0, -3) + "y" : /(ss|us)$/.test(w) ? w : /(ches|shes|xes)$/.test(w) ? w.slice(0, -2) : /s$/.test(w) && w.length > 3 ? w.slice(0, -1) : w;

/** The subject of one sentence [i0, i1] of a line. */
function sentenceSubject(toks, keys, i0, i1, N, prev) {
  const keyAt = (j) => keys.find((x) => x.k <= j && j <= x.end);
  const personAt = (j) => { const x = keyAt(j); return x?.kind === "person" ? x.id : null; };
  // 1. openers and leading phrases
  let k = i0;
  for (let guard = 0; guard < 8 && k <= i1; guard++) {
    const c = toks[k].c;
    if (OPENER.test(c) && k < i1 && !toks[k].end) { k++; continue; }
    if (c === "you" && /^(see|know)$/.test(toks[k + 1]?.c ?? "") && toks[k + 1]?.comma) { k += 2; continue; }
    if (/^(thats|its|this|that)$/.test(c) && toks[k + 1]?.c === "when") { k += 2; continue; }
    if (LEAD.test(c) && !personAt(k)) {
      let j = k; while (j < i1 && !toks[j].comma) j++;
      if (toks[j].comma && j < i1) { k = j + 1; continue; }
    }
    break;
  }
  const range = toks.slice(k, i1 + 1);
  const named = () => {
    for (let j = k; j <= i1; j++) {
      const x = keyAt(j);
      if (x?.kind === "person" && !x.poss) return x.id;
      if (/^(i|im|ive|id|ill|me|myself)$/.test(toks[j].c)) return "me";
    }
    return null;
  };
  // 2. fragments
  // "the bakery's for sale", "her real name's a secret": a noun's 's before a preposition / determiner is "is"
  const isContraction = (t, nx) => /'s$/i.test(t.raw.replace(/[’‘]/g, "'").replace(/[.,!?;:"]+$/, "")) && (!nx || PREP.test(nx.c) || DET.test(nx.c) || ADVERB.test(nx.c) || /^(not|so|too|very|gone|over|done|back|closed|open)$/.test(nx.c));
  const hasVerb = range.some((t, j) => isVerbTok(t) || (j + 1 < range.length && isContraction(t, range[j + 1])));
  const prepStart = PREP.test(toks[k]?.c ?? "") && !personAt(k) && !range.some((t) => t.comma);
  if (!hasVerb || prepStart) {
    const p = named();
    if (p) return { id: p, kind: p === "me" ? "narrator" : "person", via: "fragment-name" };
    if (prev?.id) return { id: prev.id, kind: prev.kind, via: "fragment", absent: prev.absent };
    return { id: null, kind: null, via: "fragment" };
  }
  // 3-5. the subject phrase (clause by clause: an imperative gives way to the next clause)
  let start = k;
  for (let clause = 0; clause < 4 && start <= i1; clause++) {
    const r = subjectAt(toks, keys, start, i1, N, prev, keyAt);
    if (r) return r;
    let j = start; while (j < i1 && !toks[j].comma) j++;
    if (j >= i1) break;
    start = j + 1;
    while (start <= i1 && OPENER.test(toks[start].c)) start++;
  }
  return { id: null, kind: null, via: "none" };
}

/** The subject starting at token k (a pronoun, a name, a noun phrase), or null (an imperative / no noun phrase). */
function subjectAt(toks, keys, k, i1, N, prev, keyAt) {
  const t = toks[k], c = t.c, st = N.state;
  if (/^(i|im|ive|id|ill)$/.test(c)) return { id: "me", kind: "narrator", via: "I" };
  if (/^(we|us)$/.test(c)) return { id: "group", kind: "group", via: "we" };
  if (/^(he|she|hes|shes)$/.test(c)) { const id = resolveGendered(c.slice(0, c === "hes" || c === "shes" ? -1 : undefined), N); return { id, kind: id ? "person" : null, via: c, ref: id }; }
  if (/^(they|theyre|theyd|theyve)$/.test(c)) {
    const last = [...st.subjects].reverse().find((s) => s.n >= st.n - 3 && (s.kind === "group" || s.kind === "babies"));
    return last ? { id: last.id, kind: last.kind, via: "they" } : { id: "group", kind: "group", via: "they" };
  }
  if (c === "it" || (c === "its" && /'/.test(t.raw.replace(/[’‘]/g, "'")))) return resolveIt(toks, k, i1, N);
  if (/^(everyone|everybody|nobody|noone|people|townsfolk)$/.test(c) || (c === "no" && toks[k + 1]?.c === "one")) return { id: "group", kind: "group", via: "everyone" };
  if (c === "you") return null;   // generic "you": the next clause
  if (/^(something|someone|somebody)$/.test(c)) return N.vw.monster && c === "something" ? { id: "monster", kind: "monster", via: "something" } : { id: "someone", kind: "someone", via: c };
  if (/^(nothing|there|here|this|that|what|who|which)$/.test(c) && !DET.test(c)) return null;
  // a name / family word / title at the head of the sentence
  const x0 = keyAt(k);
  if (x0?.kind === "person" && !x0.poss) return { id: x0.id, kind: x0.id === "me" ? "narrator" : "person", via: "name" };
  if (x0?.kind === "monster") return { id: "monster", kind: "monster", via: "name" };
  // a noun phrase: determiner / possessive, adjectives, the head noun (up to a verb, a preposition, an adverb)
  let j = k, owner = null, det = null;
  if (DET.test(c) || POSS_DET.test(c)) { det = c; if (POSS_DET.test(c)) owner = c; j++; }
  let head = -1;
  for (; j <= i1; j++) {
    const tj = toks[j], x = keyAt(j);
    if (x?.kind === "monster") return { id: "monster", kind: "monster", via: "name" };
    if (x?.kind === "person" && !x.poss) {
      // "my baby sister did...", "my little sister giggled"
      return { id: x.id, kind: "person", via: "name" };
    }
    if (tj.poss) {
      const nx = toks[j + 1];
      // "the bakery's for sale": a contraction of "is"
      if (!nx || PREP.test(nx.c) || DET.test(nx.c) || ADVERB.test(nx.c) || isVerbTok(nx) || tj.end) { head = j; break; }
      owner = x?.kind === "person" ? x.id : x?.kind === "monster" ? "monster" : tj.c;
      det = det ?? "poss";
      continue;
    }
    const inRuleThing = x?.kind === "rule" && ruleById(x.rule)?.kind !== "action" && x.k < j;
    if (!inRuleThing && (isVerbTok(tj) || PREP.test(tj.c) || ADVERB.test(tj.c) || /^(that|who|which|where|when)$/.test(tj.c))) break;
    if (head >= 0 && !inRuleThing && x?.kind === "rule" && ruleById(x.rule)?.kind === "action") break;
    head = j;
    if (/'s$/i.test(tj.raw.replace(/[’‘]/g, "'").replace(/[.,!?;:"]+$/, ""))) break;   // "name's a secret"
    if (tj.end || tj.comma) break;
  }
  if (head < 0) return null;
  const h = toks[head].c, hk = keyAt(head);
  const capital = /^[A-Z]/.test(toks[k].raw);
  // no determiner and not a known thing / name: an imperative verb ("Say yours too loud, ...") -> the next clause
  if (!det && !hk && !capital && !GROUP_WORD.test(h) && !PERSON_WORD.test(singular(h)) && !BODY.test(h) && !MONSTER_WORD.test(h)) return null;
  if (!det && !hk && capital && head === k && isVerbTok(toks[k])) return null;
  const ownerId = owner == null ? null : owner === "my" ? "me" : owner === "our" ? "group" : owner === "his" || owner === "her" ? resolveGendered(owner, N)
    : owner === "its" ? (N.vw.monster && st.n - st.monsterAt <= 10 ? "monster" : null) : owner === "their" ? "group" : owner === "your" ? null : owner;
  // body parts, names, voices: whoever they belong to
  if (BODY.test(h)) {
    if (ownerId) return { id: ownerId, kind: ownerId === "me" ? "narrator" : ownerId === "monster" ? "monster" : ownerId === "group" ? "group" : "person", via: "owner", ref: owner === "his" || owner === "her" ? ownerId : undefined };
    if (prev?.id && (prev.kind === "monster" || prev.kind === "person" || prev.kind === "narrator")) return { id: prev.id, kind: prev.kind, via: "body" };
    return N.vw.monster ? { id: "monster", kind: "monster", via: "body" } : null;
  }
  if (MONSTER_WORD.test(h) && N.vw.monster && h !== "thing") return { id: "monster", kind: "monster", via: "noun" };
  if (/^(baby|babies|newborn|newborns)$/.test(h) && (/^(every|each|all|the)$/.test(det ?? "") && h !== "baby" || /^(every|each|all)$/.test(det ?? "") || h === "babies")) return { id: "babies", kind: "babies", via: "babies" };
  const phraseWords = toks.slice(k, head + 1).map((x) => x.c);
  if (GROUP_WORD.test(h) || (/^(town|city|village|street|neighborhood|neighbourhood|school|class|family)$/.test(h) && (phraseWords.includes("whole") || phraseWords.includes("entire")))) return { id: "group", kind: "group", via: "group" };
  if (PERSON_WORD.test(singular(h)) || hk?.kind === "rule" && hk.rule === "people") {
    if (RELATIONAL.test(h)) {
      // "My best friend is my baby sister": the person after the copula
      for (let m = head + 1; m <= i1; m++) { const y = keyAt(m); if (y?.kind === "person") return { id: y.id, kind: "person", via: "copula" }; if (toks[m].end) break; }
    }
    if (/s$/.test(h) && !/ss$/.test(h)) return { id: "group", kind: "group", via: "people" };
    return { id: "someone", kind: "someone", via: "person-word" };
  }
  // a thing: its label is the visual key's label when the dictionary knows it ("window" -> "windows")
  const label = hk && hk.kind !== "person" ? hk.label : singular(h);
  return { id: `thing:${label}`, kind: "thing", via: "noun", label };
}

/** Who each sentence of a line is about. See the header. Mutates ctx (the story so far). */
export function subjectOf(line, ctx = {}) {
  const N = normCtx(ctx), st = N.state;
  const text = typeof line === "string" ? line : String(line?.text ?? "");
  const toks = cleanTokens(text);
  const keys = extractKeys(text, N.vw);
  const sentences = [];
  const refs = {};
  let i0 = 0;
  const prevSubject = () => sentences.at(-1) ?? st.subjects.at(-1) ?? null;
  for (let i = 0; i < toks.length; i++) {
    // a sentence ends at . ! ? (never at a title: "Mr. Dobbs")
    if ((!toks[i].end || /^(mr|mrs|ms|dr|st|jr|sr|mt)$/.test(toks[i].c)) && i < toks.length - 1) continue;
    const i1 = i;
    const r = sentenceSubject(toks, keys, i0, i1, N, prevSubject());
    const s = { k0: i0, k1: i1, id: r.id ?? null, kind: r.kind ?? null, via: r.via };
    const low = toks.slice(i0, i1 + 1).map((t) => t.c).join(" ");
    if (r.absent || ((s.kind === "monster" || s.kind === "person") && ABSENT.test(low))) s.absent = true;
    // pronoun refs and who the sentence acts on
    const withIds = [];
    let seenSubject = false;
    // recency in reading order: the subject first ("Bean screamed her name": her = Bean), then each mention as it comes
    if (s.kind === "person") touch(st, s.id);
    for (let j = i0; j <= i1; j++) {
      const t = toks[j], x = keys.find((y) => y.k === j);
      if (x?.kind === "person" && j > s.k0) touch(st, x.id);
      let id = null;
      if (/^(he|she|him|hes|shes)$/.test(t.c) || (t.c === "her" && (!toks[j + 1] || t.end || t.comma || PREP.test(toks[j + 1].c) || /^[A-Z]/.test(toks[j + 1].raw) || ADVERB.test(toks[j + 1].c)))) {
        id = r.ref && s.id === r.ref && !seenSubject && /^(he|she|hes|shes)$/.test(t.c) ? r.ref : resolveGendered(t.c.replace(/s$/, ""), N);
        if (id) { refs[j] = id; touch(st, id); }
      } else if (/^(his|her)$/.test(t.c)) {
        const o = resolveGendered(t.c, N); if (o) { refs[j] = o; touch(st, o); }
        continue;
      } else if (/^(them)$/.test(t.c)) id = null;
      else if (t.c === "me" || t.c === "myself") id = "me";
      else if (x?.kind === "person" && !x.poss) id = x.id;
      else if (x?.kind === "monster") { st.monsterAt = st.n; id = "monster"; }
      if (!id) continue;
      if (id === s.id && !seenSubject) { seenSubject = true; continue; }
      if (id !== s.id && !withIds.includes(id) && id !== "monster") withIds.push(id);
      if (id === "monster" && s.id !== "monster" && !withIds.includes("monster")) withIds.push("monster");
    }
    // "We call her Bean" / "the whole town yelled it with me": the narrator is part of the group, not "acted on"
    s.with = withIds.filter((id) => !(s.id === "group" && id === "me") && id !== s.id);
    // the subject is the latest for the next sentence ("Mom grabbed Bean. She..." -> Mom)
    if (s.kind === "person") touch(st, s.id);
    if (s.id === "monster") st.monsterAt = st.n;
    for (const x of keys) {
      if (x.k < i0 || x.k > i1) continue;
      if (x.kind === "noun" || (x.kind === "rule" && ["object", "hold", "insert", "place"].includes(ruleById(x.rule)?.kind))) st.things.push({ label: x.label, n: st.n });
    }
    if (s.kind === "thing") st.things.push({ label: s.id.slice(6), n: st.n });
    st.subjects.push({ id: s.id, kind: s.kind, n: st.n, absent: s.absent });
    st.n++;
    sentences.push(s);
    i0 = i + 1;
  }
  const main = sentences.find((s) => s.id) ?? sentences[0] ?? { id: null, kind: null, via: "empty", with: [] };
  return { id: main.id, kind: main.kind, label: subjectLabel(main.id, N), via: main.via, with: main.with ?? [], absent: !!main.absent, sentences, refs };
}

/** A readable name for a subject id. */
export function subjectLabel(id, ctxOrNames = {}) {
  if (id == null) return "-";
  const N = ctxOrNames._n ?? ctxOrNames;
  const people = N.vw?.people ?? null;
  const castName = (i) => N.cast?.[i]?.name ?? people?.get?.(i)?.name ?? null;
  if (id === "me") return N.cast?.me?.name ?? N.vw?.narrator ?? "the narrator";
  if (id === "monster") return N.monsterName ?? N.vw?.monster?.name ?? "the monster";
  if (id === "group") return "everyone";
  if (id === "babies") return "the babies";
  if (id === "someone") return "someone";
  if (id.startsWith("thing:")) return id.slice(6);
  return castName(id) ?? id[0].toUpperCase() + id.slice(1);
}

/** Subjects of a whole script, in order (one shared context). lines: [{ text }]. */
export function subjectsOfLines(lines, ctx) {
  return lines.map((l) => subjectOf(l.text ?? l, ctx));
}
