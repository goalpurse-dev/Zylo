// deno-lint-ignore-file no-explicit-any
// Phase 4c director run (failed on COST_CAP at window 4, $0.213): offline proof
// of the two fixes — the stray-"}" salvage and the per-window rewrite budget.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { parseBeatsOutput, runBeatDirector, applyRewriteBudget, rewriteBudget, type ModelCall } from "../../supabase/functions/_shared/stickman/beatDirector.ts";

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, import.meta.url)));
const run = await read("../fixtures/stickman/beats/myth-vs-reality.phase4c.json");
const narration = await read("../fixtures/stickman/audio/myth-vs-reality/narration.json");
const entries = run.cassette.entries.map((e: any) => ({ user: e.request.messages[0].content as string, input: e.response.content.find((x: any) => x.type === "tool_use").input, usage: e.response.usage }));

Deno.test("salvage: window 3's string-encoded array with a stray '}' now parses (no $0.06 full-window repair)", () => {
  const w3 = entries[4];
  assertEquals(typeof w3.input.b, "string");
  const p = parseBeatsOutput(w3.input);
  assertEquals(p.error, null);
  assert(p.beats.length >= 20, `${p.beats.length} beats`);
  // Truly broken strings still get the clear repair note.
  assert(parseBeatsOutput({ b: '[{"s":1,' }).error!.includes("not a valid JSON array"));
});

Deno.test("rewrite budget: at most a quarter of a window's beats (min 4), most severe first", () => {
  const beats = Array.from({ length: 20 }, (_, i) => ({ sequence: i, rewrite: true, needsFill: true, rewriteCodes: [i === 3 ? "undeclared_text" : i === 7 ? "concept_not_still" : "ungrounded_name"], subjects: [] }));
  const dropped = applyRewriteBudget(beats, rewriteBudget(beats.length));
  assertEquals([rewriteBudget(20), dropped], [5, 15]);
  const kept = beats.filter((b: any) => b.rewrite).map((b: any) => b.sequence);
  assert(kept.includes(3) && kept.includes(7), JSON.stringify(kept));
  assertEquals(rewriteBudget(8), 4);
});

Deno.test("the recorded run replayed with both fixes: windows 1-3 pass without a repair and fills shrink", async () => {
  const mains = entries.filter((e: any) => !e.user.includes("NEEDS CONTRACT") && !e.user.includes("FAILED VALIDATION"));
  const fills = entries.filter((e: any) => e.user.includes("NEEDS CONTRACT"));
  const fillBeats = new Map<string, any[]>();
  for (const f of fills) { const w = f.user.match(/^WINDOW (\d+)/)![1]; const b = parseBeatsOutput(f.input).beats; fillBeats.set(w, [...(fillBeats.get(w) ?? []), ...b]); }
  const fillSizes: number[] = [];
  const calls: string[] = [];
  let m = 0;
  const replay: ModelCall = async (req) => {
    const w = req.user.match(/^WINDOW (\d+)/)![1];
    const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    if (req.user.includes("NEEDS CONTRACT")) {
      const want = [...req.user.matchAll(/NEEDS CONTRACT C(\d+)\.\./g)].map((x) => Number(x[1]));
      fillSizes.push(want.length);
      calls.push(`fill ${w}`);
      // Recorded answers where they exist; the salvaged window-3 attempt has
      // different split parts than the recorded (repaired) one, so those get a stub.
      const rec = (fillBeats.get(w) ?? []).filter((b: any) => want.includes(b.s));
      const stub = want.filter((s) => !rec.some((b: any) => b.s === s)).map((s) => ({ s, e: Number(req.user.match(new RegExp(`NEEDS CONTRACT C${s}\\.\\.C(\\d+)`))![1]), v: "A stub still frame of the scene", t: "STORY_SCENE", c: "MEDIUM", f: "stub" }));
      return { input: { b: [...rec, ...stub] }, usage };
    }
    calls.push(req.user.includes("FAILED VALIDATION") ? `repair ${w}: ${req.user.slice(-700).split("\n").join(" | ")}` : `main ${w}`);
    if (!mains[m]) throw new Error(`no recorded main left; calls so far: ${calls.join(", ")}`);
    return { input: mains[m++].input, usage };
  };
  const res: any = await runBeatDirector({ planRules: false, segments: run.segments, bible: run.bible, narration, callback: run.callback, callModel: replay, maxWindows: 3 });
  assert(res.ok, JSON.stringify({ calls, issues: res.issues?.slice(0, 4) }));
  assertEquals(calls.filter((c) => c.startsWith("repair")), [], "no full-window repair");
  const recordedFill = fills.map((f: any) => [...f.user.matchAll(/NEEDS CONTRACT/g)].length);
  console.log(`fill beats per window: recorded ${JSON.stringify(recordedFill)} -> with budget ${JSON.stringify(fillSizes)}; rewrites dropped to warnings: ${res.stats.rewritesDropped}`);
  assert(fillSizes.reduce((a, b) => a + b, 0) < recordedFill.reduce((a: number, b: number) => a + b, 0));
});
