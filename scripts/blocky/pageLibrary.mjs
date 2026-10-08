// The library sheet for the owner's review (makeLibrary.mjs): every avatar of the roster with the picture
// that was picked, its check score, which model made it, and what the check found. Nothing is live until the
// owner approves the sheet.
//   node scripts/blocky/pageLibrary.mjs <outDir> <ffmpegPath>     writes <outDir>/index.html
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";
import { ROSTER } from "./roster.mjs";

const [outDir, ffmpeg] = process.argv.slice(2);
const dir = path.join(ROOT, "data/blocky-tests/library");
const file = path.join(dir, "results.json");
const r = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { items: {}, checks: {}, avatars: {} };
fs.mkdirSync(outDir, { recursive: true });
const usd = (n) => `$${Number(n).toFixed(2)}`;
const modelName = (key) => (r.items[key]?.engine === "pro" ? "Nano Banana Pro" : "Nano Banana 2 Lite");
const versions = (id) => Object.keys(r.items).filter((k) => r.items[k].id === id).sort();
const short = (id, key) => key.replace(`${id}-`, "").replace(/^t-/, "test ").replace(/^b-/, "").replace("lite-", "Lite ").replace("pro-", "Pro ") + (/^[a-z]+-(lite|pro)-/.test(key) ? " (first wording)" : "");
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
    meta: [["Check score", `${av.score} of 100${av.ok ? "" : " (fails)"}`], ["Made by", modelName(av.picked)], ["All versions", versions(a.id).map((k) => `${short(a.id, k)}: ${score(k)}`).join(" · ")], ["Should have", a.look]],
    note: av.problems.length ? `The check: ${av.problems.join("; ")}.` : "",
  };
};
// All of them small, as on a phone: whole bodies in one row, then the round chips the app itself shows
// (the top of the picture in a circle), at the two sizes it uses.
const thumbs = {};
if (ffmpeg) {
  fs.mkdirSync(path.join(outDir, "thumbs"), { recursive: true });
  for (const a of made) {
    const picked = r.avatars[a.id].picked;
    if (!picked) continue;
    const to = path.join(outDir, "thumbs", `${a.id}.jpg`);
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", path.join(dir, r.items[picked].file), "-vf", "scale=144:-2:flags=lanczos", "-q:v", "4", to]);
    thumbs[a.id] = `data:image/jpeg;base64,${fs.readFileSync(to).toString("base64")}`;
  }
}
const withThumb = ROSTER.filter((a) => thumbs[a.id]);
const rowHtml = `<div style="display:flex;gap:6px;overflow-x:auto;padding:10px;background:#0C0F0D;border-radius:10px">${withThumb.map((a) => `<figure style="margin:0;flex:0 0 auto;width:60px;text-align:center"><img alt="${a.name}" src="${thumbs[a.id]}" style="width:60px;height:107px;object-fit:cover;border-radius:6px;background:#fff"><figcaption style="font-size:9.5px;color:rgba(244,246,251,.7);margin-top:3px">${a.name}</figcaption></figure>`).join("")}</div>`;
const chips = (px) => `<div style="display:flex;flex-wrap:wrap;gap:${px > 30 ? 8 : 6}px;padding:10px;background:#0C0F0D;border-radius:10px;max-width:390px">${withThumb.map((a) => `<img alt="${a.name}" title="${a.name}" src="${thumbs[a.id]}" style="width:${px}px;height:${px}px;border-radius:50%;object-fit:cover;object-position:top;background:#fff">`).join("")}</div>`;
const smallHtml = `<p>Whole bodies, 60 px wide, in one row (scroll sideways):</p>${rowHtml}<p style="margin-top:14px">As the app shows them on a phone: the round chip in the picker (40 px) and in an idea card (28 px), inside a 390 px wide box:</p>${chips(40)}<div style="height:10px"></div>${chips(28)}`;

const groups = [
  ["Fail the check: need your eye first", made.filter((a) => !r.avatars[a.id].ok)],
  ["Pass the check", pass],
  ["Not made yet", ROSTER.filter((a) => !r.avatars[a.id]?.done)],
].filter(([, list]) => list.length);

const html = await renderResultsPage({
  title: "Blocky Library Sheet",
  intro: "The avatar library's reference pictures, for your review before anything goes live. Every avatar was drawn twice on Nano Banana 2 Lite; the reference check scored both and the better one is shown; an avatar whose two pictures both failed was drawn once more on Nano Banana Pro. <b>The wording changed after the first eight avatars.</b> With the first wording nearly every mouth had a tongue in it, on Lite and on Pro alike, so I stopped the run, changed three sentences to say what the mouth, the head and the torso print ARE (the prompt no longer says \"open mouth\"), tested that on six avatars (no tongue in any) and drew the whole library with it. The check is a cheap vision model and can be wrong both ways: a \"fails\" is a reason to look, not a verdict. Several of its \"a human look\" fails are avatars with a tan, peach or brown head colour.",
  stats: [
    { value: `${made.length} of ${ROSTER.length}`, label: "avatars made" },
    { value: String(pass.length), label: "pass the check", tone: "good" },
    { value: String(made.length - pass.length), label: "fail the check", tone: made.length - pass.length ? "bad" : "good" },
    { value: String(onPro.length), label: "picked from Nano Banana Pro" },
    { value: usd(spent), label: "spent on the library so far" },
  ],
  sections: [
    ...(withThumb.length ? [{ heading: `All ${withThumb.length} together, small: are they easy to tell apart at phone size?`, html: smallHtml }] : []),
    ...groups.map(([heading, list]) => ({ heading: `${heading} (${list.length})`, cards: list.map(card) })),
  ],
  decisions: [
    "<b>Approve the sheet</b>, or name the avatars to redo. Nothing is in the library until you do: the three avatars live today are still the old pictures.",
    "<b>What I would look at first</b> (from the small row): the heads of Tank, Coral and Ruse are not clean cubes; Kodo, Rex, Bolt, Twig and Morel stand a little turned; the avatars are not all the same size in their pictures (Ruse is small, Pogo is large), which matters less for a reference than for this sheet.",
    "<b>Going live</b> writes the approved pictures and the 52 avatars into Blocky's library table. That is a change to the database, so it gets its own go.",
  ],
});
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`wrote ${path.join(outDir, "index.html")} (${(html.length / 1e6).toFixed(2)} MB): ${made.length} of ${ROSTER.length} made, ${pass.length} pass`);
