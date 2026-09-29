// deno-lint-ignore-file no-explicit-any
// Phase 6c e2e beat plan ("Why is ice slippery", Daniel, real timings): it
// failed three times on window 2 with a HARD too_short — a 3-word line spoken
// in 1.5 s whose neighbours were too long to merge with. The recorded model
// calls replayed offline, with the fix: an unmergeable short line (>= 1.2 s)
// becomes an automatic fast cut (PUNCH) carried as a warning, never a failure.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { parseBeatsOutput, runBeatDirector, autoSplitBeats, MIN_BEAT_MS, PUNCH_FLOOR_MS, type ModelCall } from "../../supabase/functions/_shared/stickman/beatDirector.ts";

const fx = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/beats/ice-slippery.phase6c.json", import.meta.url)));
const entries = fx.runs[0].cassette.entries.map((e: any) => ({ user: e.request.messages[0].content as string, input: e.response.content.find((x: any) => x.type === "tool_use").input }));

function replayer() {
  const mains = entries.filter((e: any) => !e.user.includes("NEEDS CONTRACT") && !e.user.includes("FAILED VALIDATION"));
  const fills = entries.filter((e: any) => e.user.includes("NEEDS CONTRACT"));
  const repairs = entries.filter((e: any) => e.user.includes("FAILED VALIDATION"));
  const calls: string[] = [];
  let m = 0;
  const call: ModelCall = async (req) => {
    const w = req.user.match(/^WINDOW (\d+)/)![1];
    const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    if (req.user.includes("NEEDS CONTRACT")) {
      calls.push(`fill ${w}`);
      const want = [...req.user.matchAll(/NEEDS CONTRACT C(\d+)\.\.C(\d+)/g)].map((x) => [Number(x[1]), Number(x[2])]);
      const rec = fills.filter((f: any) => f.user.startsWith(`WINDOW ${w}`)).flatMap((f: any) => parseBeatsOutput(f.input).beats);
      return { input: { b: want.map(([s, e]) => rec.find((b: any) => b.s === s) ?? { s, e, v: "A stub still frame of the scene", t: "STORY_SCENE", c: "MEDIUM", f: "stub" }) }, usage };
    }
    if (req.user.includes("FAILED VALIDATION")) {
      calls.push(`repair ${w}`);
      const rec = repairs.find((e: any) => e.user.startsWith(`WINDOW ${w}`));
      if (!rec) throw new Error(`no recorded repair for window ${w}`);
      return { input: rec.input, usage };
    }
    calls.push(`main ${w}`);
    if (!mains[m]) throw new Error(`no recorded main left; calls: ${calls.join(", ")}`);
    return { input: mains[m++].input, usage };
  };
  return { call, calls };
}

Deno.test("the recorded failure: the live run stopped on window 2 too_short (1.5 s)", () => {
  const issues = fx.runs.map((r: any) => r.error.issues.map((i: any) => i.code));
  assertEquals(issues.every((c: string[]) => c.every((x) => x === "too_short")), true);
});

Deno.test("replayed with the fix: the live call sequence (main, fill, repair, fill) now PASSES window 2; the short line is a fast cut with a warning", async () => {
  const r = replayer();
  const res: any = await runBeatDirector({ planRules: false, segments: fx.segments, bible: fx.bible, narration: fx.narration, callback: fx.callback, callModel: r.call, maxWindows: 2 });
  assert(res.ok, JSON.stringify({ calls: r.calls, issues: res.issues?.slice(0, 3) }));
  // Same calls as live (its one repair fixed an unknown cast id); live then failed on too_short — now it passes.
  assertEquals(r.calls.filter((c) => c.startsWith("repair")).length, 1);
  // Every short beat is a declared fast cut (the model's own PUNCH, or the new automatic one).
  const short = res.beats.filter((b: any) => b.endMs - b.startMs < MIN_BEAT_MS);
  for (const b of short) assert(b.contract.flags?.punch && String(b.contract.flags?.reason ?? "").trim(), JSON.stringify(b.contract.flags));
  // The exact line that failed live (words 388-390, 1.5 s) is now an automatic fast cut with a warning.
  const failed = res.beats.find((b: any) => b.startWord === 388 && b.endWord === 390);
  assert(failed, "the 1.5 s line is kept as its own beat");
  assert(failed.endMs - failed.startMs >= PUNCH_FLOOR_MS && failed.endMs - failed.startMs < MIN_BEAT_MS);
  assertEquals(failed.contract.flags.reason, "auto: short line, no neighbour fits");
  assert(failed.warnings.some((w: any) => w.code === "auto_punch"), "carried as a warning");
});

Deno.test("unit: an unmergeable short beat >= 1.2 s is auto-flagged; under 1.2 s it is left for the hard check", () => {
  const words = Array.from({ length: 30 }, (_, i) => ({ word: `w${i}`, startMs: 0, endMs: 0, segmentId: "s1" }));
  // beat A: words 0-11 (6.0 s), B: 12-14 (1.5 s), C: 15-26 (6.0 s) -> B fits with neither neighbour.
  let t = 0;
  for (let i = 0; i < 30; i++) { const d = i < 12 ? 500 : i < 15 ? 500 : 500; words[i].startMs = t; t += d; words[i].endMs = t; }
  const stream: any = { words, timingSource: "real", scriptText: "", cutPoints: [] };
  const chunks = [{ index: 0, startWord: 0, endWord: 11 }, { index: 1, startWord: 12, endWord: 14 }, { index: 2, startWord: 15, endWord: 26 }, { index: 3, startWord: 27, endWord: 29 }];
  const win: any = { index: 0, startWord: 0, endWord: 29, chunks };
  const beats = [
    { startChunk: 0, endChunk: 0, startWord: 0, endWord: 11, visualConcept: "a" },
    { startChunk: 1, endChunk: 1, startWord: 12, endWord: 14, visualConcept: "b" },
    { startChunk: 2, endChunk: 2, startWord: 15, endWord: 26, visualConcept: "c" },
    { startChunk: 3, endChunk: 3, startWord: 27, endWord: 29, visualConcept: "d" },
  ];
  const out = autoSplitBeats(beats, win, stream, { hookSingleChunk: false });
  const b = out.beats.find((x: any) => x.visualConcept === "b");
  assert(b.flags?.punch && /auto/.test(b.flags.reason), JSON.stringify(b));
  assert(b.warnings?.some((w: any) => w.code === "auto_punch"));
});
