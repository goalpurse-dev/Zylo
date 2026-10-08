// The library sheet for the owner's review (makeLibrary.mjs): every avatar of the roster with the picture
// that was picked, its check score, which model made it, and what the check found. Nothing is live until the
// owner approves the sheet.
//   node scripts/blocky/pageLibrary.mjs <outDir>     writes <outDir>/index.html
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";
import { ROSTER } from "./roster.mjs";

const [outDir] = process.argv.slice(2);
const dir = path.join(ROOT, "data/blocky-tests/library");
const file = path.join(dir, "results.json");
const r = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { items: {}, checks: {}, avatars: {} };
fs.mkdirSync(outDir, { recursive: true });
const usd = (n) => `$${Number(n).toFixed(2)}`;
const modelName = (key) => (r.items[key]?.engine === "pro" ? "Nano Banana Pro" : "Nano Banana 2 Lite");
const versions = (id) => Object.keys(r.items).filter((k) => r.items[k].id === id).sort();
const score = (key) => { const c = r.checks[key]; return c?.verdict ? `${c.verdict.score}${c.verdict.ok ? "" : " (fails)"}` : r.items[key]?.url ? "not checked" : `no picture (${r.items[key]?.state})`; };

const made = ROSTER.filter((a) => r.avatars[a.id]?.done);
const pass = made.filter((a) => r.avatars[a.id].ok);
const onPro = made.filter((a) => r.avatars[a.id].picked?.includes("-pro-"));
const spent = [...Object.values(r.items), ...Object.values(r.checks)].reduce((n, x) => n + (Number(x.cost) || 0), 0);

const card = (a) => {
  const av = r.avatars[a.id];
  if (!av?.done) return { title: `${a.name} · ${a.tag}`, note: "Not made yet." };
  if (!av.picked) return { title: `${a.name} · ${a.tag}`, tone: "bad", note: "No usable picture came out." };
  return {
    image: path.join(dir, r.items[av.picked].file), title: `${a.name} · ${a.tag}`, tone: av.ok ? "good" : "bad",
    meta: [["Check score", `${av.score} of 100${av.ok ? "" : " (fails)"}`], ["Made by", modelName(av.picked)], ["All versions", versions(a.id).map((k) => `${modelName(k).replace("Nano Banana ", "")} ${k.split("-").pop()}: ${score(k)}`).join(" · ")], ["Should have", a.look]],
    note: av.problems.length ? `The check: ${av.problems.join("; ")}.` : "",
  };
};
const groups = [
  ["Fail the check: need your eye first", made.filter((a) => !r.avatars[a.id].ok)],
  ["Pass the check", pass],
  ["Not made yet", ROSTER.filter((a) => !r.avatars[a.id]?.done)],
].filter(([, list]) => list.length);

const html = await renderResultsPage({
  title: "Blocky Library Sheet",
  intro: `The avatar library's reference pictures, for your review before anything goes live. Every avatar was drawn twice on Nano Banana 2 Lite with today's reference prompt (cube head with flat faces, front view, a flat mouth with no tongue, blocky hair and accessories); the reference check scored both and the better one is shown. An avatar whose two pictures both failed was drawn once more on Nano Banana Pro. The check is a cheap vision model and can be wrong both ways: a "fails" is a reason to look, not a verdict.`,
  stats: [
    { value: `${made.length} of ${ROSTER.length}`, label: "avatars made" },
    { value: String(pass.length), label: "pass the check", tone: "good" },
    { value: String(made.length - pass.length), label: "fail the check", tone: made.length - pass.length ? "bad" : "good" },
    { value: String(onPro.length), label: "picked from Nano Banana Pro" },
    { value: usd(spent), label: "spent on the library so far" },
  ],
  sections: groups.map(([heading, list]) => ({ heading: `${heading} (${list.length})`, cards: list.map(card) })),
  decisions: [
    "<b>Approve the sheet</b>, or name the avatars to redo. Nothing is in the library until you do: the three avatars live today are still the old pictures.",
    "<b>Going live</b> writes the approved pictures and the 52 avatars into Blocky's library table. That is a change to the database, so it gets its own go.",
  ],
});
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`wrote ${path.join(outDir, "index.html")} (${(html.length / 1e6).toFixed(2)} MB): ${made.length} of ${ROSTER.length} made, ${pass.length} pass`);
