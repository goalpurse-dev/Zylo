// Blocky Worlds SCRIPT CHECKS (owner 2026-11-11, #2: "The real window was behind him" after the trim cut Mr. Hollis's
// lines: "him" pointed at nobody). Pure, free; for the trim step and the free checks.
//   orphanPronouns({ original, kept }) -> problems
//     original: the lines before the trim (texts, in order); kept: the lines after it (texts, in order, a subset with edits)
//     a he / him / his / she / her in a kept line whose person (the nearest name before it in the ORIGINAL) was named only
//     in lines the trim cut is a problem: the pronoun now points at nobody (or at the wrong person)
//   pronounProblems(lines) -> problems   the same for a script on its own (a pronoun line with no person named before it)
const NAME = /\b(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-z]+|\b(?:Grandpa|Grandma|Granny|Aunt|Uncle|Mom|Dad|Officer|Mayor|Baker|Captain)(?:\s+[A-Z][a-z]+)?|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
const MALE = /\b(he|him|his|himself)\b/i, FEMALE = /\b(she|her|hers|herself)\b/i;
const FEM_NAME = /\b(Mrs|Ms|Miss|Grandma|Granny|Aunt|Mom)\b/;
const SINGLE = /(?<=\w,? )[A-Z][a-z]+/g; // a capitalised word inside a sentence ("And Dottie found her cat")
const STOP = /^(In|On|At|One|Every|The|It|Its|Now|And|But|Then|Rude|Stare|His|Her|He|She|They|I|We|My|You|Your|There|This|That|When|After|Before|So|Even|Nobody|Everyone|Everybody|Our|Their|A|An|If|Once|Until|Not|No)\b/;
const FIRST = /^\s*["'(]?([A-Z][a-z]+)\b/; // a line's first word when it is a name ("Pickle sat at the front")
const namesIn = (t) => [...String(t).matchAll(NAME), ...String(t).matchAll(SINGLE), ...(FIRST.test(String(t)) ? [[String(t).match(FIRST)[1]]] : [])].map((m) => m[0]).filter((n) => !STOP.test(n));
/** a thing named before the pronoun in its own line ("a wolf and his army") is its referent */
const ownReferent = (t) => /\b(a|an|the)\s+[a-z]+\b.*\b(he|him|his|she|her)\b/i.test(String(t));
const norm = (t) => String(t ?? "").toLowerCase().replace(/[^a-z ]/g, "").trim();

/** the person a pronoun line refers to: the nearest earlier line (within 4) naming somebody of a fitting gender */
function antecedent(lines, i, female) {
  for (let k = i - 1; k >= 0 && k >= i - 4; k--) {
    const ns = namesIn(lines[k]).filter((n) => (female ? FEM_NAME.test(n) || !/\b(Mr|Grandpa|Uncle|Dad)\b/.test(n) : !FEM_NAME.test(n)));
    if (ns.length) return { line: k, name: ns.at(-1) };
  }
  return null;
}
export function orphanPronouns({ original = [], kept = [] } = {}) {
  const problems = [], keptSet = new Set(kept.map(norm));
  const origIndex = (t) => original.findIndex((o) => norm(o) === norm(t) || norm(o).endsWith(norm(t)) || norm(t).endsWith(norm(o)));
  kept.forEach((t, i) => {
    const female = FEMALE.test(t) && !MALE.test(t), male = MALE.test(t);
    if (!female && !male) return;
    if (namesIn(t).length) return; // the person is named in the line itself
    const oi = origIndex(t);
    if (oi < 0) return;
    const a = antecedent(original, oi, female);
    if (!a) return;
    const stillNamed = kept.slice(Math.max(0, i - 4), i).some((k) => namesIn(k).includes(a.name));
    if (!keptSet.has(norm(original[a.line])) && !stillNamed) problems.push(`line ${i} "${t}": "${female ? "she/her" : "he/him"}" was ${a.name} (cut line: "${original[a.line]}"); now it points at nobody`);
  });
  return problems;
}
export function pronounProblems(lines = []) {
  const problems = [];
  lines.forEach((t, i) => {
    const female = FEMALE.test(t) && !MALE.test(t), male = MALE.test(t);
    if ((!female && !male) || namesIn(t).length || ownReferent(t) || /^\s*(I|We)\b/.test(t)) return;
    if (!antecedent(lines, i, female)) problems.push(`line ${i} "${t}": no person named before it for "${female ? "she/her" : "he/him"}"`);
  });
  return problems;
}
