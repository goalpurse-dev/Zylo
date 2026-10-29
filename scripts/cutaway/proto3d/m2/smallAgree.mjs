// M2 cost round: the two small steps on a cheaper model, checked the same way as on Sonnet.
//  - re-anchoring a saved layout's words to a new script: every picked word must be in its sentence, and the solver
//    must pass; compared with Sonnet's picks for the same items (cached in the run's steps).
//  - the post text: a title under 60 characters ending in one emoji, a 1-2 sentence description, 8 lowercase hashtags.
//   node m2/smallAgree.mjs --model claude-haiku-5-5 --log spend.jsonl --saved <runDir of a saved-layout run> <runDir>...
import fs from "node:fs";
import path from "node:path";
import { callJSON, loadKey } from "./llm.mjs";
import { applyWords, missingWords } from "./planner.mjs";
import { solveLayout } from "./solver.js";

const argv = process.argv.slice(2), arg = (k) => argv[argv.indexOf(`--${k}`) + 1];
const model = arg("model"), log = arg("log"), savedRun = arg("saved");
const runs = []; for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith("--")) { i++; continue; } runs.push(argv[i]); }
const apiKey = loadKey(), here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const res = { model };

// 1. re-anchoring (the same prompt and schema as the planner's step)
const script = JSON.parse(fs.readFileSync(path.join(savedRun, "script.json"), "utf8"));
const saved = JSON.parse(fs.readFileSync(path.join(here, "layouts", "french_drain.template.json"), "utf8"));
const missing = missingWords(saved, script.sentences);
const WORDS_SCHEMA = { type: "object", additionalProperties: false, required: ["words"], properties: { words: { type: "array", items: { type: "object", additionalProperties: false, required: ["index", "word"], properties: { index: { type: "integer" }, word: { type: "string" } } } } } };
const r = await callJSON({ apiKey, model, log, label: "re-anchor words (test)", effort: "low", maxTokens: 4000, schema: WORDS_SCHEMA,
  system: "You re-anchor an animation to a new narration. For each item, pick the one word of the given sentence (copy it exactly, without punctuation) on which that action should happen: the word that names the thing or the action. Reply with every item.",
  user: `Items (index: sentence role: sentence | the action | the old word):\n${missing.map((m, i) => `${i}: ${m.s}: ${script.sentences.find((x) => x.role === m.s)?.text} | ${m.what} | ${m.w}`).join("\n")}` });
const next = applyWords(saved, missing, r.data.words);
const still = missingWords(next, script.sentences);
const sonnetStep = fs.readdirSync(path.join(savedRun, "steps")).find((f) => /re_anchor_words/.test(f));
const sonnet = sonnetStep ? JSON.parse(fs.readFileSync(path.join(savedRun, "steps", sonnetStep), "utf8")).data.words : [];
const same = r.data.words.filter((w) => sonnet.find((s) => s.index === w.index)?.word?.toLowerCase() === w.word.toLowerCase()).length;
res.reanchor = { words: r.data.words, items: missing.length, answered: r.data.words.length, notInSentence: still.length, solverProblems: solveLayout(next, script.sentences).problems.length, sameAsSonnet: same, sonnetItems: sonnet.length, costUsd: r.costUsd };
console.log("re-anchor:", JSON.stringify(res.reanchor));

// 2. the post text
const POST_SCHEMA = { type: "object", additionalProperties: false, required: ["title", "description", "hashtags"], properties: { title: { type: "string" }, description: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } } };
res.post = [];
for (const run of runs) {
  const s = JSON.parse(fs.readFileSync(path.join(run, "script.json"), "utf8"));
  const p = await callJSON({ apiKey, model, log, label: "post text (test)", effort: "low", maxTokens: 3000, schema: POST_SCHEMA,
    system: "You write the post text for a short vertical 3D explainer video on TikTok, YouTube Shorts and Reels: a title under 60 characters with one emoji at the end, a 1-2 sentence description that teases the most surprising fact, and 8 lowercase hashtags (no # in them).",
    user: `Title: ${s.title}\nNarration: ${s.sentences.map((x) => x.text).join(" ")}` });
  const d = p.data, emoji = /\p{Extended_Pictographic}/u;
  const ok = { titleLen: d.title.length < 60, emojiEnd: emoji.test(d.title.slice(-3)), sentences: (d.description.match(/[.!?](\s|$)/g) ?? []).length <= 2, tags8: d.hashtags.length === 8, lower: d.hashtags.every((h) => h === h.toLowerCase() && !h.startsWith("#")) };
  res.post.push({ run: path.basename(run), ...d, ok, pass: Object.values(ok).every(Boolean), costUsd: p.costUsd });
  console.log("post:", path.basename(run), JSON.stringify(ok), d.title);
}
fs.writeFileSync(path.join(path.dirname(savedRun), `small_agree_${model}.json`), JSON.stringify(res, null, 1));
