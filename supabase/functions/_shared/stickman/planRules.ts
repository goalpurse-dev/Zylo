// deno-lint-ignore-file no-explicit-any
// stickman/planRules.ts — plan-level scene rules (Phase 6e-fix), from the
// f90160bc review (~15 near-identical campfire frames in the opening, "a
// researcher at a lab bench" over and over, 10 uninvited split screens,
// unnamed animals, frames built on an absence). Pure: run on a finished plan;
// every hit becomes a targeted re-direct note (redirectUserPrompt).
//   - the same place at most 3 beats in a row (a HOLD counts once);
//   - within any 10 beats at least 3 different settings OR camera distances;
//   - the same composition (setting + main subject + framing) at most twice per section;
//   - SPLIT/COMPARISON at most 1 in 15 beats; every other beat one continuous frame;
//   - an object alone / an empty landscape at most ~8% of beats;
//   - a visible character in at least 55% of beats (evidence beats show a person doing or reacting);
//   - name the animal species; never depict an absence.

export type RuleHit = { sequence: number; code: string; fix: string };
export type PlanBeat = { sequence: number; narrationText?: string; contract: any; section?: string | null };

export const SAME_PLACE_RUN_MAX = 3;
export const VARIETY_WINDOW = 10;
export const VARIETY_MIN = 3;
export const COMPOSITION_REPEAT_MAX = 2;
export const SPLIT_EVERY = 15;
export const EMPTY_SHARE_MAX = 0.08;
export const PEOPLE_SHARE_MIN = 0.55;

const DEVICE_TREATMENTS = new Set(["STAT_CARD", "TIMELINE_BAR", "MAP", "SCALE", "ICON_ROW", "SYMBOLIC"]);
const SPLITS = new Set(["SPLIT", "COMPARISON"]);
const SPECIES = /\b(antelopes?|gazelles?|bison|buffalo|horses?|deer|reindeer|caribou|elk|mammoths?|rhinos?|elephants?|boars?|pigs?|goats?|sheep|ibex|oryx|wildebeest|zebras?|lions?|hyenas?|wolves|wolf|bears?|leopards?|cats?|dogs?|cattle|cows?|aurochs|kudu|springbok|camels?|birds?|fish|seals?|rabbits?|hares?)\b/i;
const UNNAMED_ANIMAL = /\b(?:an?|the|one|a single|a wounded|a dying|a fast|a dangerous)\s+(?:\w+\s+)?(animal|prey|beast|creature)\b/i;
const ABSENCE = /\b(no|without|empty of|nobody|absent|missing|lacking|nothing)\b[^.;]{0,40}\b(prey|animals?|hunters?|people|person|one|evidence|chase|carcass|figures?)\b|\bwhere an? [^.;]{0,40}\bwould\b|\bempty (?:grass|ground|plain|space)\b/i;
const PANEL_WORDS = /\b(split(?:[- ]screen| image| frame)?|side[- ]by[- ]side|versus|vs\.?|panels?|collage|grid of)\b/i;
const EVIDENCE = /\b(bones?|points?|spears?|shafts?|sites?|layers?|cutmarks?|tooth marks?|polish|residue|fractures?|artifacts?|maps?|tools?|skeletons?|diagrams?)\b/i;

const camDistance = (c: any) => {
  const cam = String(c?.composition?.camera ?? "");
  return /EXTREME_WIDE|WIDE|OVERHEAD/.test(cam) ? "wide" : /EXTREME_CLOSE|CLOSE/.test(cam) ? "close" : cam === "POV" ? "pov" : cam ? "medium" : "graphic";
};
const hasPeople = (c: any) => (c?.subjects ?? []).length > 0;
const mainSubject = (c: any) => c?.subjects?.[0]?.castId ?? c?.propIds?.[0] ?? "none";
const isHold = (c: any) => !!c?.flags?.hold;

export function planRuleHits(beats: PlanBeat[]): RuleHit[] {
  const hits: RuleHit[] = [];
  const hit = (b: PlanBeat, code: string, fix: string) => hits.push({ sequence: b.sequence, code, fix });
  const n = beats.length;

  // 1. Same place at most 3 in a row (a HOLD counts once).
  let run = 0, prev: string | null = null;
  for (const b of beats) {
    const s = b.contract?.settingId ?? null;
    if (s && s === prev) { if (!isHold(b.contract)) run++; } else run = 1;
    prev = s;
    if (s && run > SAME_PLACE_RUN_MAX) hit(b, "same_place_run", "a different place: cut away to another setting, a close object in someone's hands, or a graphic — not the same location again");
  }

  // 2. Within any 10 beats: at least 3 different settings OR camera distances.
  const flaggedVariety = new Set<number>();
  for (let i = 0; i + VARIETY_WINDOW <= n; i++) {
    const w = beats.slice(i, i + VARIETY_WINDOW);
    const settings = new Set(w.map((b) => b.contract?.settingId ?? "graphic"));
    const dists = new Set(w.map((b) => camDistance(b.contract)));
    if (settings.size >= VARIETY_MIN || dists.size >= VARIETY_MIN) continue;
    const last = w[w.length - 1];
    if (!flaggedVariety.has(last.sequence)) { flaggedVariety.add(last.sequence); hit(last, "low_variety", "vary the picture: a different setting or a clearly different camera distance (wide / medium / close) from the beats around it"); }
  }

  // 3. The same composition (setting + main subject + framing) at most twice per section.
  const seen = new Map<string, number>();
  for (const b of beats) {
    const key = `${b.section ?? ""}|${b.contract?.settingId ?? "-"}|${mainSubject(b.contract)}|${camDistance(b.contract)}`;
    const k = (seen.get(key) ?? 0) + 1;
    seen.set(key, k);
    if (k > COMPOSITION_REPEAT_MAX && !isHold(b.contract) && b.contract?.treatment !== "CALLBACK") hit(b, "composition_repeat", "a new composition: change the main subject, the place or the framing (this exact picture already appeared twice in this section)");
  }

  // 4. Splits capped; every other beat one continuous frame.
  const allowedSplits = Math.max(1, Math.floor(n / SPLIT_EVERY));
  let splits = 0;
  for (const b of beats) {
    const c = b.contract ?? {};
    if (SPLITS.has(c.treatment)) { splits++; if (splits > allowedSplits) hit(b, "split_cap", "ONE continuous frame (not a split, not panels, not a comic grid) that shows the contrast inside a single scene"); }
    else if (PANEL_WORDS.test(String(c.visualConcept ?? ""))) hit(b, "panel_words", "ONE continuous frame — not a split, not panels, not a comic grid");
  }

  // 5. Empty frames at most ~8%.
  const empties = beats.filter((b) => !hasPeople(b.contract) && !DEVICE_TREATMENTS.has(b.contract?.treatment));
  const emptyMax = Math.round(n * EMPTY_SHARE_MAX);
  const emptyExcess = empties.slice(emptyMax); // keep the earliest (section openers), fix the rest
  for (const b of emptyExcess) hit(b, "empty_frame", "not an object alone or an empty landscape: add a person (hands, back or a small figure) doing or reacting, with one clear focal subject");

  // 6. People in at least 55% of beats; evidence beats show a person doing or reacting.
  const withPeople = beats.filter((b) => hasPeople(b.contract)).length;
  const already = new Set(emptyExcess.map((b) => b.sequence));
  let missing = Math.ceil(n * PEOPLE_SHARE_MIN) - withPeople - already.size;
  for (const b of beats) {
    if (missing <= 0) break;
    const c = b.contract ?? {};
    if (hasPeople(c) || already.has(b.sequence) || DEVICE_TREATMENTS.has(c.treatment)) continue;
    if (EVIDENCE.test(String(c.visualConcept ?? ""))) { hit(b, "evidence_without_person", "show a person doing or reacting to the evidence (a researcher lifting, measuring or comparing it; a hunter using the tool) — not the artifact alone"); missing--; }
  }

  // 7. Name the species; never depict an absence.
  for (const b of beats) {
    const v = String(b.contract?.visualConcept ?? "");
    if (UNNAMED_ANIMAL.test(v) && !SPECIES.test(v)) hit(b, "unnamed_animal", "name the animal species from the passage (e.g. antelope, bison, horse, deer) — never 'an animal' or 'prey'");
    if (ABSENCE.test(v)) hit(b, "absence", "draw what IS there that makes the point — never an absence ('no prey', 'empty ground where X would be')");
  }

  // One entry per beat, fixes combined.
  const byBeat = new Map<number, RuleHit>();
  for (const h of hits) {
    const cur = byBeat.get(h.sequence);
    if (!cur) byBeat.set(h.sequence, { ...h });
    else if (!cur.code.split("+").includes(h.code)) byBeat.set(h.sequence, { sequence: h.sequence, code: `${cur.code}+${h.code}`, fix: `${cur.fix}; AND ${h.fix}` });
  }
  return [...byBeat.values()].sort((a, b) => a.sequence - b.sequence);
}

// Summary for reports: beats hit per rule.
export function ruleCounts(hits: RuleHit[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of hits) for (const c of h.code.split("+")) out[c] = (out[c] ?? 0) + 1;
  return out;
}
