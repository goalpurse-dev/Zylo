// Results page for the stage 3d follow-up (new staging rules, scenes 1 and 3 redone).
import fs from "fs";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const out = process.argv[2];
const first = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-results.json`, "utf8"));
const redo = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-redo.json`, "utf8"));
const spend = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/spend.json`, "utf8")).entries;
const stage = spend.filter((e) => e.stage === "3d").reduce((s, e) => s + e.usd, 0);
const total = spend.reduce((s, e) => s + e.usd, 0);
const s = redo.story;
const rows = new Map(redo.sceneRows.map((r) => [r.idx, r]));
const r1 = redo.redo.find((x) => x.idx === 0);
const r3 = redo.redo.find((x) => x.idx === 2);
const scene2Job = first.jobs.find((j) => j.scene_id === s.scenes[1].id);
const loc = redo.locations[0];
const staging = (idx) => { const r = rows.get(idx); return `${r.shot} · ${r.emotion}${r.placement ? ` · placement: ${r.placement}` : ""}`; };

const html = await renderResultsPage({
  title: "Fruit Scene Pictures Redo",
  intro: `Stage 3d follow-up on the same story, "${s.title}". The new rules are live in the planner and the picture prompt (time of day and lighting per location, spatial placement per scene, no wide shots for dialogue). I applied them to this story's staging and regenerated scenes 1 and 3 through the real regenerate path, sending exactly the prompt the builder produces.`,
  stats: [
    { value: `$${stage.toFixed(4)}`, label: "stage 3d spend of $0.40 (redo: $" + (r1.job.cost + r3.job.cost).toFixed(4) + ")" },
    { value: `$${total.toFixed(4)}`, label: "Phase 3 total of $4.00" },
    { value: "2 / 2", label: "regenerated, saved prompt == sent prompt", tone: "good" },
    { value: "Fixed", label: "time of day: scenes 1 and 3 now late afternoon", tone: "good" },
    { value: "Fixed", label: "scene 1 placement: Gloria outside, Rick + Bella inside", tone: "good" },
    { value: "Not yet", label: "scene 1 framing still too wide for lip sync", tone: "warn" },
  ],
  sections: [
    {
      heading: "The 3 pictures now",
      text: `Location loc1: <b>${loc.description}</b> Time of day: <b>${loc.timeOfDay}</b>. Lighting: <b>${loc.lighting}</b>.`,
      cards: [
        { image: r1.newUrl, tone: "warn", title: `Scene 1 (redone) · gloria: "${s.scenes[0].line}"`, meta: [["Staging", staging(0)], ["Model", r1.job.model], ["Real cost", `$${r1.job.cost.toFixed(4)}`], ["Credits charged", `${r1.job.credits}`], ["References", `${r1.job.refs}`]], note: "Placement and light are right. Framing isn't: the model went full-body to fit the glass wall and hallway, so Gloria's face is small. Needs a stronger framing instruction before it's good for lip sync.", prompt: r1.job.sent },
        { image: s.scenes[1].imageUrl, tone: "warn", title: `Scene 2 (unchanged) · rick: "${s.scenes[1].line}"`, meta: [["Staging", staging(1)], ["Model", scene2Job.request.model], ["Real cost", `$${Number(scene2Job.cost_usd).toFixed(4)}`], ["Credits charged", `${scene2Job.credits}`]], note: "Made before the time-of-day rule: cooler overcast daylight, a little off from the golden light in scenes 1 and 3.", prompt: scene2Job.request.positivePrompt },
        { image: r3.newUrl, tone: "good", title: `Scene 3 (redone) · bella: "${s.scenes[2].line}"`, meta: [["Staging", staging(2)], ["Model", r3.job.model], ["Real cost", `$${r3.job.cost.toFixed(4)}`], ["Credits charged", `${r3.job.credits}`], ["References", `${r3.job.refs}`]], prompt: r3.job.sent },
      ],
    },
    {
      heading: "Before the redo",
      text: "Scene 1 had Gloria inside the room with the others (and a later night edit); scene 3 had drifted to dusk.",
      cards: [
        { image: r1.previousUrl, title: "Scene 1 before (after the night edit)" },
        { image: first.edit.before.url, title: "Scene 1 original (daytime, everyone inside)" },
        { image: r3.previousUrl, title: "Scene 3 before (dusk)" },
      ],
    },
    {
      heading: "What changed in the rules ($0)",
      layout: "list",
      cards: [{
        title: "Now enforced for every new story",
        body: [
          "<b>Time of day:</b> every location has <i>timeOfDay</i> and <i>lighting</i>; the validator sends the plan back if either is missing; the picture prompt repeats them with \"keep exactly this time of day and lighting\".",
          "<b>Spatial staging:</b> every scene has a <i>placement</i>. If a line mentions glass, windows, walls, a door, a lock, inside or outside, the placement must say where each character is relative to it, or the plan is sent back (script mode too).",
          "<b>Lip-sync framing:</b> dialogue scenes can't be wide (it's no longer even offered to the model); the picture prompt asks for the speaker's face large and turned to the camera.",
          "<b>V4 test override:</b> an admin-only, single-use row in <i>fruit_test_overrides</i> lets exactly one job run above the user's plan, expires on its own (2 hours max), and is recorded on the job. Your plan and Stripe are untouched. Dry-run proof: refused without it, allowed once with it, refused on reuse, on a 2-clip step and after expiry.",
        ],
      }],
    },
  ],
  decisions: [
    "<b>Scene 1 framing (recommended):</b> I add an explicit framing line to the picture prompt (\"frame from the waist up; the speaker's head fills about a quarter of the frame height; show only as much of the room as fits\") and regenerate scene 1 once. About $0.035 (3d would be at ~$0.25 of $0.40).",
    "<b>Scene 2 lighting:</b> regenerate it with the new late-afternoon lighting so all three match? About $0.035.",
    "<b>Then 3e:</b> animate this story on V2 (3 clips) plus one 4 s V4 clip using the test override. I'll state the expected cost before starting.",
  ],
});
fs.writeFileSync(out, html);
console.log("written", out, (html.length / 1024).toFixed(0) + " KB");
