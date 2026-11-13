// STUDIO MODE (dev driver): the ONE fixed Sonnet checker (studio/checker.mjs) on a FINISHED run's final frames (the
// contact sheet's tiles, one per cut, already labelled), so different runs (run 1, A, B...) are judged the same way.
// Priced before the call against the run's own ledger. -> <run>/final-check.json { lines, cuts, failingLines }
//   node dev/studio/checkFinal.mjs --out <run dir> [--cap 5] --yes
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ledger } from "../../../studio/ledger.mjs";
import { checkSheets, CHECKER_MODEL } from "../../../studio/checker.mjs";
import { lineNeeds } from "../../../studio/agent.mjs";
import { creatureLines } from "../../../studio/prompt.mjs";
import { envKey } from "../../voice/eleven.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { costOf, PRICE } = await import(pathToFileURL(path.resolve(HERE, "../../../../../supabase/functions/_shared/blockyWorlds/llm.js")).href);
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = path.resolve(arg("out")), L = ledger(out, { capUsd: Number(arg("cap", 5)) });
const tl = JSON.parse(fs.readFileSync(path.join(out, "timeline.json"), "utf8"));
const tl0 = JSON.parse(fs.readFileSync(path.join(out, "base-timeline.json"), "utf8"));
const script = JSON.parse(fs.readFileSync(path.join(out, "results.json"), "utf8")).results[0].script;
const needs = lineNeeds(tl0, script);
const cs = path.join(out, arg("cs", "cs")), dir = path.join(out, "finalcheck"); fs.mkdirSync(dir, { recursive: true });
// sheets of 20 labelled tiles (5 x 4)
const tiles = tl.shots.map((s, i) => ({ f: path.join(cs, `${String(i).padStart(3, "0")}.jpg`), id: s.studio ?? `#${i}`, line: s.line })).filter((t) => fs.existsSync(t.f));
const sheets = [];
for (let k = 0; k < tiles.length; k += 20) {
  const part = tiles.slice(k, k + 20), list = path.join(dir, `list${k / 20}`); fs.mkdirSync(list, { recursive: true });
  part.forEach((t, i) => fs.copyFileSync(t.f, path.join(list, `${String(i).padStart(3, "0")}.jpg`)));
  const file = path.join(dir, `sheet${k / 20}.jpg`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", path.join(list, "%03d.jpg"), "-vf", `tile=5x${Math.ceil(part.length / 5)}:color=#111111`, "-frames:v", "1", file]);
  sheets.push({ file, cuts: part.map((t) => ({ id: t.id, line: t.line, declares: "" })) });
}
const P = PRICE[CHECKER_MODEL];
const worst = +((8000 * P.output + (sheets.length * 1800 + 4000) * P.cacheWrite) / 1e6).toFixed(4);
console.log(`${tiles.length} final frames in ${sheets.length} sheets; worst case $${worst}`);
if (!argv.includes("--yes")) process.exit(0);
const apiKey = envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY");
const call = async ({ label, model, messages, schema, maxTokens, eff, kind }) => {
  L.check(label, worst);
  const a = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-beta": "server-side-fallback-2026-07-01" }, body: JSON.stringify({ model, max_tokens: maxTokens, messages, thinking: { type: "adaptive" }, output_config: { effort: eff, format: { type: "json_schema", schema } }, fallbacks: "default" }), signal: AbortSignal.timeout(600_000) });
  const j = await res.json();
  const usd = costOf(j?.model ?? model, j?.usage ?? {});
  L.add(`${kind}_final`, usd);
  L.log({ step: "final_check", sec: +((Date.now() - a) / 1000).toFixed(1), usd, usage: j?.usage ?? null });
  fs.writeFileSync(path.join(dir, "answer.json"), JSON.stringify(j));
  if (!res.ok) throw new Error(`checker ${res.status} ${JSON.stringify(j?.error ?? j).slice(0, 300)}`);
  console.log(`checker: $${usd} in ${((Date.now() - a) / 1000).toFixed(0)} s`);
  return j;
};
const lines = Object.fromEntries(tl.lines.map((l, n) => [n, { text: l.text, mustShow: needs.mustShow[n] ?? [] }]));
const v = await checkSheets({ sheets, lines, call, label: "final checker", creature: tl0.monster ? { name: tl0.monster.name, lines: creatureLines(script, tl0) } : null });
const failingLines = Object.entries(v.lines).filter(([, l]) => !l.ok).map(([n, l]) => ({ line: Number(n), missing: l.missing }));
const badCuts = Object.entries(v.cuts).filter(([, c]) => !c.ok).map(([id, c]) => ({ id, problem: c.problem }));
fs.writeFileSync(path.join(out, "final-check.json"), JSON.stringify({ failingLines, badCuts, lines: v.lines, cuts: v.cuts }, null, 1));
console.log(`failing lines ${failingLines.length}/${tl.lines.length}: ${failingLines.map((l) => `L${l.line} (${l.missing.join(", ")})`).join("; ").slice(0, 900)}`);
console.log(`cuts flagged ${badCuts.length}/${tiles.length}`);
