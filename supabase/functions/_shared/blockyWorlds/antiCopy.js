// Blocky Worlds: the anti-copy check (owner, 2026-11-08). Reference transcripts are shown to the writer as examples. A
// script may start from the same PREMISE as a reference, but its story events, twist, character names and lines must be
// its own. Free and deterministic:
//   1. lines: no 5-word run shared with an example, outside the first line (the premise) and trivial phrases (a run
//      that is mostly small words: "and then I saw the")
//   2. names: no character name of an example (Mr. Plunk, Grumble, ...)
//   3. twist: the twist's distinctive words must not mostly be the words of an example's ending

const STOP = new Set(`a an the and or but nor so if then than that this these those there here of to in on at by for with from into onto up down out over under about after before
i me my mine we us our you your he him his she her they them their it its who whom what when where why how which
is are was were be been being am do does did done has have had get got gets can could will would should may might must just
not no never very really all every each some any one two three like as too also only even still back off again now`.split(/\s+/));
/** Capitalised words that are not names (titles, family words, sentence starters the transcripts capitalise). */
const NOT_NAMES = new Set(`I In This That The A An And But So Then When While Until After Before Every Everyone Everybody Nobody Somebody Someone Something Nothing Some One Two Three
Mr Mrs Ms Miss Dr Doctor Mayor Grandma Grandpa Granny Gran Mom Mum Dad Mommy Daddy Mother Father Sister Brother Aunt Uncle Baby Sir Madam Officer Captain King Queen Prince Princess Chief Coach Teacher Santa
You Your We Our My He She They It Its Their His Her Yes No Okay Ok Oh Huh Hey Well Now Apparently Honestly Suddenly Even Just Yesterday Today Tomorrow Last Next Later Why What Where How Who
Hello Hi Goodbye Deal Main Street Road Lane Avenue Square Park School Town City World Village Girl Boy Kid Kids Everything Nothing Please Thanks Sorry Stop Wait Run Help Look Listen
Monday Tuesday Wednesday Thursday Friday Saturday Sunday Christmas Halloween God Earth Moon Sun`.split(/\s+/));

export const norm = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
const grams = (ws, n) => { const out = []; for (let i = 0; i + n <= ws.length; i++) out.push(ws.slice(i, i + n).join(" ")); return out; };
const trivial = (gram) => gram.split(" ").filter((w) => STOP.has(w)).length >= 3;

/** The names in a text: capitalised words inside a sentence that aren't common words, and the word after a title. */
export function namesIn(text, { anyPosition = false } = {}) {
  const out = new Set();
  const t = String(text ?? "");
  for (const m of t.matchAll(/\b(?:Mr|Mrs|Ms|Miss|Dr|Mayor|Captain|Coach|Officer|Baker|Old)\.?\s+([A-Z][a-z]+)/g)) out.add(m[1]);
  for (const sentence of t.split(/(?<=[.!?])\s+|\n+/)) {
    const ws = sentence.split(/\s+/).filter(Boolean);
    ws.forEach((raw, i) => {
      const w = raw.replace(/[’']s$/, "").replace(/[^A-Za-z]/g, "");
      if ((anyPosition || i > 0) && /^[A-Z][a-z]{2,}$/.test(w) && !NOT_NAMES.has(w)) out.add(w);
    });
  }
  return [...out];
}

const CONTENT = (s) => [...new Set(norm(s).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "")))];

/**
 * Copy problems of a script against the example transcripts (empty = its own). examples: [{ id, text }].
 * twist: the script's twist in one line; topic: the user's premise (its words never count as copied).
 * Returns [{ kind: "lines" | "names" | "twist", ref, detail }].
 */
export function copyProblems({ script, twist = "", topic = "", examples = [] }) {
  const lines = script?.lines ?? [];
  const out = [];
  // our names in any position (a reference name opening our sentence is still a copy)
  const scriptNames = new Set(namesIn(lines.map((l) => l.text).join("\n"), { anyPosition: true }).map((n) => n.toLowerCase()));
  const topicWords = new Set(CONTENT(`${topic} ${lines[0]?.text ?? ""}`));
  for (const ex of examples) {
    const exWords = norm(ex.text);
    const exGrams = new Set(grams(exWords, 5).filter((g) => !trivial(g)));
    // 1. shared 5-word runs (the first line, the premise, may match)
    const shared = new Set();
    for (const l of lines.slice(1)) for (const g of grams(norm(l.text), 5)) if (exGrams.has(g)) shared.add(g);
    if (shared.size) out.push({ kind: "lines", ref: ex.id, detail: `shares ${shared.size} phrase${shared.size > 1 ? "s" : ""} word for word: "${[...shared].slice(0, 3).join('", "')}"` });
    // 2. character names
    const same = namesIn(ex.text).filter((n) => scriptNames.has(n.toLowerCase()));
    if (same.length) out.push({ kind: "names", ref: ex.id, detail: `uses the reference's names: ${same.join(", ")}` });
    // 3. the twist: its distinctive words (not the premise's) mostly found in the example's ending (its last 30%)
    const ending = new Set(CONTENT(exWords.slice(Math.floor(exWords.length * 0.7)).join(" ")));
    const distinct = CONTENT(twist).filter((w) => !topicWords.has(w));
    const hit = distinct.filter((w) => ending.has(w));
    if (distinct.length >= 2 && hit.length >= 3 && hit.length / distinct.length >= 0.5) out.push({ kind: "twist", ref: ex.id, detail: `the twist repeats the reference's ending (${hit.join(", ")})` });
  }
  return out;
}

/** The copy problems as sentences for a rewrite. */
export const copyReasons = (problems) => problems.map((p) => `Too close to reference ${p.ref}: ${p.detail}. Write your own events, names, lines and twist.`);
