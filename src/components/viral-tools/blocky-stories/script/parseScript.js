// Parses the "My own script" textarea: one scene per non-empty line, written
// as "Name: line". Pure (no React, no API) so the UI, the step rules and the
// tests all use the same logic.

export const MAX_SCRIPT_SPEAKERS = 3;
export const LONG_LINE_WORDS = 20;

// "Name: text". The name must look like a name (letters, spaces, . ' -), so
// times ("at 10:30") and URLs are not mistaken for speakers.
const LINE_RE = /^\s*([\p{L}][\p{L}\p{M} .'’-]{0,39}?)\s*:\s*(.*)$/u;

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * The library character a written name refers to, or null when there is no
 * match or it is ambiguous. Case-insensitive; accepts the full name, the
 * first name, or any single word of the name ("Pina" → "Big Pina").
 */
export function matchCharacter(name, characters) {
  const key = norm(name);
  if (!key) return null;
  const exact = characters.filter((c) => norm(c.name) === key);
  if (exact.length === 1) return exact[0].id;
  const first = characters.filter((c) => norm(c.name).split(" ")[0] === key);
  if (first.length === 1) return first[0].id;
  if (first.length > 1) return null;
  const anyWord = characters.filter((c) => norm(c.name).split(" ").includes(key));
  return anyWord.length === 1 ? anyWord[0].id : null;
}

/**
 * @param {string} text  Textarea content
 * @param {{id:string,name:string}[]} characters  Library
 * @param {Record<string,string>} [assignments]  nameKey → characterId chosen by the user
 * @returns {{
 *   lines: {lineNo:number, raw:string, name:string|null, nameKey:string|null, text:string,
 *           status:"ok"|"no-name"|"no-text", speakerId:string|null, long:boolean}[],
 *   names: {name:string, key:string, speakerId:string|null, auto:boolean}[],
 *   script: {speakerId:string, line:string}[],   // usable lines, in order
 *   speakerIds: string[],                         // distinct speakers, in order of appearance
 *   sceneCount: number,
 *   unmatched: string[],                          // names still needing a character
 *   tooManySpeakers: boolean,
 *   blocker: string|null                          // why Next is disabled, or null
 * }}
 */
export function parseScript(text, characters, assignments = {}) {
  const lines = [];
  const names = new Map();

  String(text ?? "").split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const m = raw.match(LINE_RE);
    // Names are 1–2 words (library names are one word: "Vex"), so
    // "Then Vex said: hi" is not read as a speaker.
    if (!m || wordCount(m[1]) > 2) {
      lines.push({ lineNo: i + 1, raw, name: null, nameKey: null, text: raw.trim(), status: "no-name", speakerId: null, long: false });
      return;
    }
    const name = m[1].trim();
    const key = norm(name);
    const body = m[2].trim();
    if (!names.has(key)) {
      const assigned = assignments[key] && characters.some((c) => c.id === assignments[key]) ? assignments[key] : null;
      const auto = matchCharacter(name, characters);
      names.set(key, { name, key, speakerId: assigned ?? auto, auto: !assigned && Boolean(auto) });
    }
    lines.push({
      lineNo: i + 1,
      raw,
      name,
      nameKey: key,
      text: body,
      status: body ? "ok" : "no-text",
      speakerId: names.get(key).speakerId,
      long: wordCount(body) > LONG_LINE_WORDS,
    });
  });

  const okLines = lines.filter((l) => l.status === "ok");
  // Only names that actually say something count as speakers.
  const speakingKeys = new Set(okLines.map((l) => l.nameKey));
  const nameList = [...names.values()].filter((n) => speakingKeys.has(n.key));
  const unmatched = nameList.filter((n) => !n.speakerId).map((n) => n.name);
  const speakerIds = [...new Set(okLines.map((l) => l.speakerId).filter(Boolean))];
  const tooManySpeakers = speakerIds.length > MAX_SCRIPT_SPEAKERS;
  const script = okLines.filter((l) => l.speakerId).map((l) => ({ speakerId: l.speakerId, line: l.text }));

  let blocker = null;
  if (okLines.length < 2) blocker = "Write at least two lines, like Vex: Who gave you admin?";
  else if (unmatched.length) blocker = `Choose who ${unmatched.map((n) => `"${n}"`).join(" and ")} ${unmatched.length === 1 ? "is" : "are"}.`;
  else if (tooManySpeakers) blocker = `Use at most ${MAX_SCRIPT_SPEAKERS} different speakers. This script has ${speakerIds.length}.`;

  return { lines, names: nameList, script, speakerIds, sceneCount: okLines.length, unmatched, tooManySpeakers, blocker };
}
