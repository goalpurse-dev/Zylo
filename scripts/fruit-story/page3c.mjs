// Results page for the stage 3c blind test (key revealed).
import fs from "fs";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const out = process.argv[2];
const results = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3c-blind-results.json`, "utf8"));
const key = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3c-blind-key.json`, "utf8"));
const NAMES = { "claude-sonnet-5": "Claude Sonnet 5", "gpt-5.6-sol": "GPT-5.6 Sol" };
const total = results.reduce((s, r) => s + r.cost, 0);
const cost = (m) => results.filter((r) => key[r.name][r.label] === m).reduce((s, r) => s + r.cost, 0);
const LEAD = { Idea: "Idea: \"The perfect revenge dinner\" (Mia, Marco, Pia)", Prompt: "Prompt: the CEO buys his wife and his intern the same birthday dress (Rick, Marg, Bella)", Script: "Script: your 3 lines, staged only (Lemz, Roxy, Uncle Tay)" };

const sections = ["Idea", "Prompt", "Script"].map((name) => ({
  heading: LEAD[name],
  text: name === "Script" ? "Both models got your lines and could not change them (script mode never lets the model write lines). Only title, location and staging differ." : "",
  cards: results.filter((r) => r.name === name).sort((a, b) => a.label.localeCompare(b.label)).map((r) => {
    const model = key[name][r.label];
    const picked = r.label === "B";
    return {
      title: `${name} ${r.label} · ${NAMES[model]}${picked ? " · your pick" : ""}`,
      tone: picked ? "good" : undefined,
      body: [`<b>${r.plan.title}</b> <i>(${r.plan.lengthSec} s)</i>`, ...r.plan.scenes.map((s) => `<b>${s.speakerId}</b>: ${s.line} <i>· ${s.durationSec}s · ${s.shot} · ${s.emotion}</i>`)],
      meta: [["Model", model], ["Real cost", `$${r.cost.toFixed(4)}`], ["Attempts", r.attempts === 2 ? "2 (one repair)" : "1"], ["Location", r.plan.locations.map((l) => l.description).join(" / ")]],
    };
  }),
}));

const html = await renderResultsPage({
  title: "Fruit Planner Blind Test",
  intro: "Stage 3c. The same three 15-second inputs went through both planners via the deployed production code path. You judged them blind and picked <b>B overall</b>. Here is the key.",
  stats: [
    { value: "Sonnet 5", label: "winner: B in 2 of 3 rounds", tone: "good" },
    { value: `$${total.toFixed(4)}`, label: "stage 3c spend of $0.40" },
    { value: `$${(cost("claude-sonnet-5") / 3).toFixed(4)} vs $${(cost("gpt-5.6-sol") / 3).toFixed(4)}`, label: "avg per script: Sonnet 5 vs GPT-5.6 Sol" },
    { value: "6 / 6", label: "valid plans (1 needed a repair)", tone: "good" },
    { value: "1,079", label: "hand-written ideas seeded" },
  ],
  sections,
  decisions: [
    "Nothing to decide. The planner is set to <b>Claude Sonnet 5</b> in <code>models.js</code> and deployed.",
    "Your new rule is live: every line must land when heard once, spoken aloud. The validator sends back lines that lean on punctuation, spelling or reading a note or text word for word (Prompt A's \"standard executive punctuation\" line would now be rejected and repaired).",
  ],
});
fs.writeFileSync(out, html);
console.log("written", out, html.length);
