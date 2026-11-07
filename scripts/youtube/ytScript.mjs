// Zyvo YouTube tutorials: the episode script (episodes/<slug>/script.json) and what is made from it ($0).
//   node ytScript.mjs <episode dir> print      the script as the owner reads it for approval (+ words, minutes)
//   node ytScript.mjs <episode dir> check      the rules (every number has a source, no "free" unless the fact says so)
//   node ytScript.mjs <episode dir> shotlist   SHOTLIST.md: exactly what to screen-record (and optionally voice)
//   node ytScript.mjs <episode dir> package    after assemble: title, description with chapters + tracked link, thumbnails
//
// script.json: { slug, title, title_options, tool, link, facts: [{id, text, source}], chapters: [{id, name, beats: [...]}],
//   thumbs: [card specs of kind "thumb"], description }. A beat: { id, say, show, facts?: [fact ids] }. show is ONE of:
//   { rec: "<file in recordings/>", from, to, zoom: [x, y, w, h] (0-1 of the frame), record: "what to record" }
//   { card: { icon, light, bold, flip } }   a keyword card        { step: { n, of, title: [a, b] } }   a STEP card
//   { proof: { image, value, stat, unit, title, credit, checked } }   a real public count, credited
//   { result: "<file in recordings/>", from, to, record }   the finished video, full screen, its own sound (say "")
//   { end: {} }   the end screen
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WPS = 2.75;   // ~165 words a minute: a calm tutorial voice (the reference ran ~188)
export const load = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "script.json"), "utf8"));
export const beats = (S) => S.chapters.flatMap((c) => c.beats.map((b) => ({ ...b, chapter: c.id, chapterName: c.name })));
const words = (s) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

/** The rules. Returns a list of problems (empty = fine). */
export function check(S) {
  const out = [], facts = new Map((S.facts ?? []).map((f) => [f.id, f]));
  const ids = new Set();
  for (const b of beats(S)) {
    if (ids.has(b.id)) out.push(`${b.id}: the id is used twice`); ids.add(b.id);
    const kinds = Object.keys(b.show ?? {}).filter((k) => ["slot", "note", "rec", "card", "step", "proof", "result", "end"].includes(k));
    if (kinds.length !== 1) out.push(`${b.id}: show needs exactly one of slot, note, rec, card, step, proof, result, end`);
    if (b.show?.slot && !b.show.slot.show) out.push(`${b.id}: a slot needs its "show" (what to record)`);
    // every number said has a source on the episode's fact list
    if (/\d|\b(million|thousand|hundred)\b/i.test((b.say ?? "").replace(/\b3D\b/g, "")) && !(b.facts ?? []).length) out.push(`${b.id}: says a number without a fact ("${b.say}")`);
    for (const f of b.facts ?? []) if (!facts.has(f)) out.push(`${b.id}: no fact "${f}" on the list`);
    // "free" only where a fact says exactly what is free
    if (/\bfree\b/i.test(b.say ?? "") && !(b.facts ?? []).some((f) => /free/i.test(facts.get(f)?.text ?? ""))) out.push(`${b.id}: says "free" without the fact that says what is free`);
    if (b.show?.proof && !(b.show.proof.credit && b.show.proof.checked)) out.push(`${b.id}: a public count needs its credit and the day it was checked`);
    if (b.show?.rec && !b.show.record) out.push(`${b.id}: a recording needs its "record" instruction for the shot list`);
    if (/no blender|blender is bad|capcut is bad/i.test(b.say ?? "")) out.push(`${b.id}: no bashing other tools`);
    // a blank the owner fills from the recording (a real time, a real count) never ships empty
    if (/\[[^\]]+\]/.test(b.say ?? "")) out.push(`${b.id}: fill in ${b.say.match(/\[[^\]]+\]/)[0]} from your recording`);
  }
  for (const f of S.facts ?? []) if (!f.source) out.push(`fact ${f.id}: no source`);
  return out;
}

/** The script as the owner reads it. */
export function printable(S) {
  const all = beats(S), n = all.reduce((a, b) => a + words(b.say), 0), resultSecs = all.reduce((a, b) => a + (b.show?.result ? (b.show.to - b.show.from) : b.show?.slot && !b.say ? b.show.slot.secs ?? 8 : 0), 0);
  const lines = [`# ${S.title}`, "", `About ${n} spoken words ≈ ${(n / WPS / 60).toFixed(1)} min of voice + ${Math.round(resultSecs)} s of the finished video ≈ ${((n / WPS + resultSecs) / 60).toFixed(1)} min in all.`, ""];
  for (const c of S.chapters) {
    lines.push(`## ${c.name}`, "");
    for (const b of c.beats) {
      const sh = b.show ?? {}, what = sh.slot ? `SLOT: ${sh.slot.show}${sh.slot.sound ? " (its own sound)" : ""}` : sh.note ? `keyword: ${[sh.note.light, sh.note.bold].filter(Boolean).join(" ")} [${sh.note.icon}]` : sh.rec ? `screen: ${sh.rec}${sh.zoom ? " (zoom in)" : ""}` : sh.card ? `card: ${[sh.card.light, sh.card.bold].filter(Boolean).join(" ")} [${sh.card.icon}]` : sh.step ? `STEP ${sh.step.n}: ${sh.step.title.join(" ")}` : sh.proof ? `proof: ${sh.proof.stat} ${sh.proof.unit ?? "views"}, ${sh.proof.credit}, checked ${sh.proof.checked}` : sh.result ? `the finished video, ${Math.round(sh.to - sh.from)} s with its own sound` : sh.end ? "end screen" : "?";
      lines.push(`- **${b.id}** · _${what}_${b.say ? `\n  ${b.say}` : ""}${b.facts?.length ? `\n  (source: ${b.facts.join(", ")})` : ""}`);
    }
    lines.push("");
  }
  lines.push("## Facts this script uses", "", ...(S.facts ?? []).map((f) => `- **${f.id}**: ${f.text} (${f.source})`));
  return lines.join("\n");
}

/** What to record: one entry per recording file, with every moment the script needs from it. */
export function shotList(S) {
  const by = new Map();
  for (const b of beats(S)) { const sh = b.show ?? {}, file = sh.rec ?? sh.result; if (!file) continue; (by.get(file) ?? by.set(file, []).get(file)).push(b); }
  const out = [`# Shot list: ${S.title}`, "",
    "Record at **1920x1080** (or larger, 16:9), 30 fps, the browser zoomed to 110–125 % so text reads on a phone. Move the mouse slowly and pause 1 s before and after each click. Hide bookmarks and other tabs.",
    "Drop each file in `recordings/` with exactly the name below. Timings are about: record a little longer, the assembly trims.",
    "Your own voice (optional): record each line below as `recordings/voice/<line id>.wav` (or .m4a). Lines without a file get the ElevenLabs voice.", ""];
  for (const [file, list] of by) {
    const secs = list.reduce((a, b) => a + Math.max(b.show.to - b.show.from || 0, words(b.say) / WPS), 0);
    out.push(`## ${file}  (about ${Math.ceil(secs)} s)`, "");
    for (const b of list) out.push(`- [ ] ${b.show.record ?? "the finished video, as it plays"}${b.say ? ` — while the voice says: "${b.say}"` : ""}`);
    out.push("");
  }
  out.push("## Voice lines (only if you voice it yourself)", "", ...beats(S).filter((b) => b.say).map((b) => `- \`${b.id}\`: ${b.say}`));
  return out.join("\n");
}

const stamp = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** After assemble (timeline.json): the description with chapters and the tracked link, and the thumbnail specs. */
export function packaging(S, timeline) {
  const starts = S.chapters.map((c) => ({ name: c.name, t: timeline.beats.find((b) => b.chapter === c.id)?.start ?? 0 }));
  starts[0].t = 0;   // YouTube: the first chapter starts at 0:00
  const link = S.link;
  const chapters = starts.map((c) => `${stamp(c.t)} ${c.name}`).join("\n");
  const desc = [S.description?.trim() ?? "", "", `▶ Try it: ${link}`, "", "Chapters", chapters, "", ...(S.description_credits ?? []).map((x) => `• ${x}`), "", "#aivideo #youtubeautomation #facelesschannel"].join("\n");
  return { title: S.title, title_options: S.title_options ?? [], description: desc, chapters: starts, link };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, cmd = "print"] = process.argv.slice(2);
  const S = load(dir);
  if (cmd === "check") { const p = check(S); console.log(p.length ? p.join("\n") : "fine: every number has a source, no free claim, credits in place"); process.exit(p.length ? 1 : 0); }
  else if (cmd === "print") { fs.writeFileSync(path.join(dir, "SCRIPT.md"), printable(S)); console.log(printable(S)); }
  else if (cmd === "shotlist") { fs.writeFileSync(path.join(dir, "SHOTLIST.md"), shotList(S)); console.log(`wrote ${path.join(dir, "SHOTLIST.md")}`); }
  else if (cmd === "package") {
    const tl = JSON.parse(fs.readFileSync(path.join(dir, "out", "timeline.json"), "utf8")), P = packaging(S, tl);
    fs.writeFileSync(path.join(dir, "out", "description.txt"), P.description);
    fs.writeFileSync(path.join(dir, "out", "titles.txt"), [P.title, ...P.title_options].join("\n"));
    const { filmCards } = await import("./cards.mjs");
    await filmCards((S.thumbs ?? []).map((spec, i) => ({ spec: { kind: "thumb", ...spec, image: spec.image && path.resolve(dir, spec.image) }, secs: 0, out: path.join(dir, "out", `thumb_${i + 1}.png`) })));
    console.log(P.description);
  } else throw new Error("print, check, shotlist or package");
}
