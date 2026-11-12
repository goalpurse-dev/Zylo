// THE FREE REPLAY (2026-11-12): a stopped run's script + scene list through the automatic storyboard + its checks,
// OFFLINE (no paid call), against the current code. The director's answers come from a saved storyboard.json (the
// worker uploads it since 2026-11-12) or, for runs before that, a MOCK director with a hand-written fixture:
//   { unfilmable: [words the board could not film then], rewrites: { "<line index>": "the reworded line" } }
// The mock files every line it can (a street shot), answers "unfilmable" lines with a place the kit lacks (as the real
// director did: the validation fails them), keeps failing them on the repair call, and returns the fixture's rewrites on
// the rewrite call: so the whole line-repair loop runs. Prints the lines that failed, the rewrites, the final kitCheck.
//   node dev/simple/replayStoryboard.mjs --run <shakedown dir> [--fixture <fixture.json>] [--max-fallback 0]
import fs from "node:fs";
import path from "node:path";
import { directStoryboard } from "../../lib/storyboardDirector.js";
import { kitCheck } from "../../../../../supabase/functions/_shared/blockyWorlds/kitCheck.js";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
export async function replay({ script, scenes, fixture = {}, maxFallback = 0 }) {
  const lines = script.lines.map((l) => String(l.text ?? l));
  const bad = new RegExp(`\\b(${(fixture.unfilmable?.length ? fixture.unfilmable : ["__none__"]).join("|")})s?\\b`, "i");
  const cast = { me: { name: "me", role: "kid" } };
  const calls = { bible: 0, scenes: 0, repair: 0, rewrite: 0, reask: 0, warm: 0 };
  const reply = (data) => ({ ok: true, json: async () => ({ model: "claude-sonnet-5-5", usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(data) }] }) });
  const entry = (n, text) => (bad.test(text) ? { line: n, place: "street", shots: [{ loc: "place:fountain_square", cam: "place_wide", light: "day", acts: [] }] } : { line: n, place: "street", shots: [{ loc: "street", cam: "street_wide", light: "day", people: [{ id: "me", where: "street:3" }], acts: [] }] });
  const fetchFn = async (url, init) => {
    const b = JSON.parse(init.body);
    if (b.max_tokens === 1) { calls.warm++; return reply([]); }
    if (/WORLD BIBLE of a vertical/.test(b.system)) { calls.bible++; return reply({ homes: { me: 0 }, houses: { "*": { cover: "curtained", bricks: false, painting: "none", light: "default" } }, events: [], rule: { text: lines[0], constraints: [] }, rooms: {} }); }
    if (/You fix single narration lines/.test(b.system)) { calls.rewrite++; const ids = JSON.parse(String(b.messages[0].content).split("FIX THESE LINES: ")[1]).map((x) => x.line); return reply(ids.filter((n) => fixture.rewrites?.[n]).map((n) => ({ line: n, text: fixture.rewrites[n] }))); }
    const ask = b.messages[0].content.at(-1).text;
    if (/REWORDED/.test(ask)) { calls.reask++; const ids = ask.match(/lines ([\d, ]+) only/)[1].split(",").map(Number); return reply(ids.map((n) => entry(n, fixture.rewrites?.[n] ?? lines[n]))); }
    const ids = ask.match(/lines ([\d, ]+) only/)[1].split(",").map(Number);
    if (/Fix these problems/.test(ask)) calls.repair++; else calls.scenes++;
    return reply(ids.map((n) => entry(n, lines[n])));
  };
  let finalLines = null, rw = [];
  const r = await directStoryboard({ apiKey: "replay", script, cast, scenes, fetchFn, maxFallback, kitCheckFn: (ls) => kitCheck(ls), onLinesFinal: (L, x) => { finalLines = L; rw = x; } }).catch((e) => ({ error: e, rewrites: e.rewrites ?? rw, fellBack: e.fellBack ?? [] }));
  const failed = lines.map((t, i) => [i, t]).filter(([, t]) => bad.test(t)).map(([i]) => i);
  return { failedFirst: failed, rewrites: r.rewrites ?? [], fellBack: r.fellBack ?? [], error: r.error ? `${r.error.code}: ${r.error.message}` : null, calls, kitCheck: kitCheck(finalLines ?? lines) };
}
if (process.argv[1] && /replayStoryboard\.mjs$/.test(process.argv[1])) {
  const dir = arg("run"), results = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
  const scenes = JSON.parse(fs.readFileSync(path.join(dir, "scenes.json"), "utf8"));
  const fixture = arg("fixture") ? JSON.parse(fs.readFileSync(arg("fixture"), "utf8")) : {};
  const out = await replay({ script: results.results[0].script, scenes, fixture, maxFallback: Number(arg("max-fallback", 0)) });
  console.log(JSON.stringify({ ...out, kitCheck: { ok: out.kitCheck.ok, missing: out.kitCheck.missing.map((m) => `${m.word} (${m.kind}) lines ${m.lines.map((i) => i + 1).join(",")}`) } }, null, 1));
}
