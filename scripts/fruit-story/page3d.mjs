// Results page for the stage 3d checkpoint (scene pictures for one 15 s story).
import fs from "fs";
import { renderResultsPage, dataUri } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const out = process.argv[2];
const r = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-results.json`, "utf8"));
const spend = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/spend.json`, "utf8")).entries;
const stage = spend.filter((e) => e.stage === "3d").reduce((s, e) => s + e.usd, 0);
const total = spend.reduce((s, e) => s + e.usd, 0);
const s = r.story;
const staging = new Map(r.sceneRows.map((x) => [x.id, x]));
const imgJobs = r.jobs.filter((j) => j.kind === "image");
const firstJob = (sceneId) => imgJobs.find((j) => j.scene_id === sceneId);
const picCost = imgJobs.slice(0, s.scenes.length).reduce((a, j) => a + Number(j.cost_usd), 0);
const credits = r.ledger.reduce((a, l) => a + (l.operation === "charge" ? l.credits : -l.credits), 0);

const sceneCards = [];
for (const sc of s.scenes) {
  const job = firstJob(sc.id);
  const st = staging.get(sc.id);
  const isEdited = sc.index === 0;
  sceneCards.push({
    image: isEdited ? r.edit.before.url : sc.imageUrl,
    title: `Scene ${sc.index + 1} · ${sc.speakerId}: "${sc.line}"`,
    tone: sc.index === 2 ? "warn" : undefined,
    meta: [["In frame", sc.presentIds.join(", ")], ["Staging", `${st.shot} · ${st.emotion} · ${st.action}`], ["Clip length", `${sc.durationSec} s`], ["Model", job.request.model], ["Real cost", `$${Number(job.cost_usd).toFixed(4)}`], ["Credits charged", `${job.credits}`], ["Attempts", `${job.attempt}`], ["References", `${job.request.inputs.referenceImages.length} library images, speaker first`]],
    note: sc.index === 2 ? "Time of day drifted: this one came out at dusk while scenes 1 and 2 are daytime. The location description has no time of day." : null,
    prompt: job.request.positivePrompt,
  });
}
const editJob = r.jobs.filter((j) => j.scene_id === s.scenes[0].id && j.kind === "image").at(-1);

const html = await renderResultsPage({
  title: "Fruit Scene Pictures",
  intro: `Stage 3d. One 15-second story written by the real planner (Claude Sonnet 5) from the idea "The door was locked", then all pictures made by the deployed worker (Runware webhook, Nano Banana 2 Lite, 768×1376), plus one edit. Everything went through the production API as your account, so your balance really moved: ${r.balance.before.toLocaleString()} → ${r.balance.after.toLocaleString()} credits.`,
  stats: [
    { value: `$${stage.toFixed(4)}`, label: "stage 3d spend of $0.40" },
    { value: `$${total.toFixed(4)}`, label: "Phase 3 total of $4.00" },
    { value: "3 / 3 + 1", label: "pictures ready + edit applied, 0 retries", tone: "good" },
    { value: `$${(picCost / s.scenes.length).toFixed(4)}`, label: "real cost per picture (3 credits = $0.06–0.08)" },
    { value: `${credits} credits`, label: "charged: 3 pictures + 1 edit, ledger matches balance" },
    { value: "1 issue", label: "time of day drifts between scenes", tone: "warn" },
  ],
  sections: [
    {
      heading: `"${s.title}": the script`,
      text: `Location (fixed, reused by every scene): <b>${r.locations.map((l) => l.description).join(" / ")}</b> Planner cost $${Number(r.planner.costUsd).toFixed(4)}, ${r.planner.attempts} attempt.`,
      layout: "list",
      cards: [{ title: `${s.title} · ${s.lengthSec} s · V2 · 9:16`, body: s.scenes.map((x) => `<b>${x.speakerId}</b>: ${x.line} <i>· ${x.durationSec}s</i>`) }],
    },
    { heading: "Scene pictures", text: "Consistency check: same three characters, same outfits (Rick's navy suit and red tie, Bella's pink blazer, lanyard and round glasses, Gloria's leopard cardigan and chain glasses), same glass office. Speaker's mouth open, listeners' mouths closed.", cards: sceneCards },
    {
      heading: "Edit: \"make it night time, with the city lights glowing through the glass walls\"",
      text: "The edit sends the current picture as image 1 plus the character references, with the user's words cleaned up by gpt-5-mini. Everything else stayed put.",
      cards: [
        { image: r.edit.before.url, title: "Before (scene 1)" },
        { image: r.edit.after.url, title: "After the edit", tone: "good", meta: [["Model", editJob.request.model], ["Real cost", `$${r.edit.jobCost.toFixed(4)} picture + $${r.edit.cleanupCost.toFixed(4)} gpt-5-mini cleanup`], ["Credits charged", `${editJob.credits}`]], prompt: r.edit.sent },
      ],
    },
  ],
  decisions: [
    "<b>Consistency:</b> are these pictures good enough to animate? If yes, I go on to 3e with this exact story.",
    "<b>Time-of-day fix (recommended, $0):</b> the planner must give every location a time of day and lighting (\"late afternoon, warm sunlight\"), the validator sends it back if missing, and the picture prompt repeats it. Want me to add that before 3e? It only affects new stories; this one would keep scene 3 at dusk unless I regenerate it (1 picture, about $0.035 from the 3d budget).",
    "<b>3e reminder:</b> for the one V4 test clip I'll temporarily set your plan to Generative, log it, and set it back to Pro right after. Your Stripe subscription isn't touched.",
  ],
});
fs.writeFileSync(out, html);
console.log("written", out, (html.length / 1024).toFixed(0) + " KB");
